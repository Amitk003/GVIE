import { describe, expect, it } from 'vitest';
import { createMemoryQueue } from './job-queue.js';

describe('memory queue', () => {
  it('publishes and drains jobs in order', async () => {
    const queue = createMemoryQueue();
    const seen: string[] = [];
    queue.register<{ id: string }>('index', async (payload) => {
      seen.push(payload.id);
    });
    await queue.publish('index', { id: 'a' });
    await queue.publish('index', { id: 'b' });
    expect(queue.size()).toBe(2);

    const handled = await queue.drain();
    expect(handled).toBe(2);
    expect(seen).toEqual(['a', 'b']);
    expect(queue.size()).toBe(0);
  });

  it('retries a failing job then gives up', async () => {
    const queue = createMemoryQueue({ maxAttempts: 3 });
    let calls = 0;
    queue.register('index', async () => {
      calls += 1;
      throw new Error('boom');
    });
    await queue.publish('index', {});
    await expect(queue.drain()).rejects.toThrow('boom');
    expect(calls).toBe(3);
  });

  it('stops failing after a retry succeeds', async () => {
    const queue = createMemoryQueue({ maxAttempts: 3 });
    let calls = 0;
    queue.register('align', async () => {
      calls += 1;
      if (calls < 2) throw new Error('flaky');
    });
    await queue.publish('align', {});
    await expect(queue.drain()).resolves.toBe(1);
    expect(calls).toBe(2);
  });

  it('throws when a job has no handler', async () => {
    const queue = createMemoryQueue();
    await queue.publish('telemetry', {});
    await expect(queue.drain()).rejects.toThrow('no handler for job telemetry');
  });

  it('lists registered handler names', () => {
    const queue = createMemoryQueue();
    queue.register('align', async () => undefined);
    expect(queue.handlerNames()).toEqual(['align']);
  });

  it('forces at least one attempt', async () => {
    const queue = createMemoryQueue({ maxAttempts: 0 });
    let calls = 0;
    queue.register('index', async () => {
      calls += 1;
    });
    await queue.publish('index', {});
    await queue.drain();
    expect(calls).toBe(1);
  });
});
