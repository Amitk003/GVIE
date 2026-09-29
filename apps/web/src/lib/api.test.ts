import { describe, expect, it } from 'vitest';
import {
  ApiError,
  readApiBase,
  requestUploadSignature,
  searchAssets,
  toAssetSummary,
} from './api.js';

type Call = { url: string; init?: RequestInit };

function stubFetch(reply: {
  status?: number;
  json?: unknown;
  throws?: string;
  jsonThrows?: string;
}) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string, init?: RequestInit) => {
    calls.push({ url: input, init });
    if (reply.throws) throw new Error(reply.throws);
    const status = reply.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (reply.jsonThrows) throw new Error(reply.jsonThrows);
        return reply.json ?? {};
      },
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('api base', () => {
  it('defaults to localhost', () => {
    expect(readApiBase(undefined)).toBe('http://localhost:4000');
  });

  it('accepts an https address', () => {
    expect(readApiBase('https://api.gvie.test')).toBe('https://api.gvie.test');
  });

  it('refuses a plain http address that is not localhost', () => {
    expect(readApiBase('http://api.example.com')).toBe('http://localhost:4000');
  });
});

describe('asset summary', () => {
  it('reads fields out of a search result', () => {
    const summary = toAssetSummary({
      public_id: 'gvie/WATER-01/after_1',
      metadata: { veri_status: 'Verified', obj_count: 3, ndvi_delta: 0.2 },
      sha256: 'a'.repeat(64),
    });
    expect(summary.publicId).toBe('gvie/WATER-01/after_1');
    expect(summary.veriStatus).toBe('Verified');
    expect(summary.objCount).toBe(3);
    expect(summary.ndviDelta).toBe(0.2);
    expect(summary.sha256).toHaveLength(64);
  });

  it('copes with a thin result', () => {
    const summary = toAssetSummary({ public_id: 'a/b' });
    expect(summary.objCount).toBeNull();
    expect(summary.veriStatus).toBeNull();
    expect(summary.thumbUrl).toContain('a/b');
  });

  it('copes with nothing at all', () => {
    expect(toAssetSummary(null).publicId).toBe('');
  });

  it('reads numbers that came as text', () => {
    expect(toAssetSummary({ public_id: 'a/b', metadata: { obj_count: '7' } }).objCount).toBe(7);
  });
});

describe('request upload signature', () => {
  it('posts and returns the signed plan', async () => {
    const { fetchImpl, calls } = stubFetch({
      json: {
        uploadUrl: 'https://api.cloudinary.com/v1_1/c/image/upload',
        cloudName: 'c',
        apiKey: 'k',
        timestamp: 1,
        signature: 'abc',
        publicId: 'a/b',
        folder: 'gvie',
        params: { folder: 'gvie' },
      },
    });
    const out = await requestUploadSignature(
      'http://localhost:4000',
      { proj_id: 'WATER-01' },
      fetchImpl,
    );
    expect(out.signature).toBe('abc');
    expect(calls[0].url).toContain('/v1/uploads/sign');
    expect(calls[0].init?.method).toBe('POST');
  });

  it('turns an api refusal into a clear error', async () => {
    const { fetchImpl } = stubFetch({
      status: 400,
      json: { error: 'bad body', details: ['sha256'] },
    });
    await expect(requestUploadSignature('http://localhost:4000', {}, fetchImpl)).rejects.toThrow(
      'bad body',
    );
  });

  it('keeps the field list in the error', async () => {
    const { fetchImpl } = stubFetch({
      status: 400,
      json: { error: 'bad body', details: ['sha256'] },
    });
    try {
      await requestUploadSignature('http://localhost:4000', {}, fetchImpl);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).details).toEqual(['sha256']);
    }
  });

  it('turns an unreadable error body into a clear message', async () => {
    const { fetchImpl } = stubFetch({ status: 500, jsonThrows: 'not json' });
    await expect(requestUploadSignature('http://localhost:4000', {}, fetchImpl)).rejects.toThrow(
      'answered 500',
    );
  });

  it('turns a dead network into a clear message', async () => {
    const { fetchImpl } = stubFetch({ throws: 'network down' });
    await expect(requestUploadSignature('http://localhost:4000', {}, fetchImpl)).rejects.toThrow(
      'could not reach the api',
    );
  });

  it('copes with a success body that cannot be read', async () => {
    const { fetchImpl } = stubFetch({ status: 200, jsonThrows: 'truncated' });
    await expect(requestUploadSignature('http://localhost:4000', {}, fetchImpl)).rejects.toThrow(
      'could not read',
    );
  });
});

describe('search assets', () => {
  it('sends only the filters that were given', async () => {
    const { fetchImpl, calls } = stubFetch({ json: { results: [] } });
    await searchAssets('http://localhost:4000', { projId: 'WATER-01' }, fetchImpl);
    expect(calls[0].url).toContain('proj_id=WATER-01');
    expect(calls[0].url).not.toContain('veri_status');
  });

  it('maps the results', async () => {
    const { fetchImpl } = stubFetch({
      json: { results: [{ public_id: 'a/b', metadata: { veri_status: 'Pending_AI' } }] },
    });
    const out = await searchAssets('http://localhost:4000', {}, fetchImpl);
    expect(out).toHaveLength(1);
    expect(out[0].veriStatus).toBe('Pending_AI');
  });

  it('copes with a missing results list', async () => {
    const { fetchImpl } = stubFetch({ json: {} });
    expect(await searchAssets('http://localhost:4000', {}, fetchImpl)).toEqual([]);
  });
});
