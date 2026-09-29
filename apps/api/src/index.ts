import { createMemoryQueue } from './queue/job-queue.js';
import { readApiConfig } from './config.js';
import { readCloudinaryEnv } from '@gvie/cloudinary';
import { buildApp } from './app.js';
import { createCloudinarySearch, createCloudinaryAnalyzeRunner } from './cloud/clients.js';

async function main(): Promise<void> {
  const config = readApiConfig();
  const cloud = readCloudinaryEnv();
  const queue = createMemoryQueue();

  queue.register('baseline_lookup', async () => undefined);
  queue.register('align', async () => undefined);
  queue.register('telemetry', async () => undefined);
  queue.register('index', async () => undefined);

  const search = createCloudinarySearch(cloud);
  const runAnalyze = createCloudinaryAnalyzeRunner(cloud);

  const app = await buildApp({
    config,
    cloud,
    queue,
    searchAssets: (expression, maxResults) => search.search(expression, maxResults),
    runAnalyze,
  });

  await app.listen({ port: config.API_PORT, host: config.API_HOST });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`api failed to start: ${message}\n`);
  process.exitCode = 1;
});
