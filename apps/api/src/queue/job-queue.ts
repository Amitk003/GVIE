export type JobName = 'baseline_lookup' | 'align' | 'telemetry' | 'index';

export type Job<P = unknown> = {
  name: JobName;
  payload: P;
  attempts: number;
  enqueuedAt: string;
};

export type JobHandler<P = unknown> = (payload: P) => Promise<void>;

export type JobQueue = {
  publish<P>(name: JobName, payload: P): Promise<void>;
  drain(): Promise<number>;
  size(): number;
};

export type QueueWithHandlers = JobQueue & {
  register<P>(name: JobName, handler: JobHandler<P>): void;
  handlerNames(): JobName[];
};

export function createMemoryQueue(options: { maxAttempts?: number } = {}): QueueWithHandlers {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const jobs: Job[] = [];
  const handlers = new Map<JobName, JobHandler<never>>();

  async function runWithRetry(job: Job, handler: JobHandler<never>): Promise<void> {
    let lastError: unknown = null;
    while (job.attempts < maxAttempts) {
      job.attempts += 1;
      try {
        await handler(job.payload as never);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`job ${job.name} failed`);
  }

  return {
    async publish<P>(name: JobName, payload: P): Promise<void> {
      jobs.push({ name, payload, attempts: 0, enqueuedAt: new Date().toISOString() });
    },
    async drain(): Promise<number> {
      let handled = 0;
      while (jobs.length > 0) {
        const job = jobs.shift() as Job;
        const handler = handlers.get(job.name);
        if (!handler) throw new Error(`no handler for job ${job.name}`);
        await runWithRetry(job, handler);
        handled += 1;
      }
      return handled;
    },
    size(): number {
      return jobs.length;
    },
    register<P>(name: JobName, handler: JobHandler<P>): void {
      handlers.set(name, handler as JobHandler<never>);
    },
    handlerNames(): JobName[] {
      return [...handlers.keys()];
    },
  };
}

