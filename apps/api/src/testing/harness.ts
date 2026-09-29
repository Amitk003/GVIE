import { createHmac } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { readApiConfig, type ApiConfig } from '../config.js';
import { createMemoryQueue, type QueueWithHandlers } from '../queue/job-queue.js';
import type { AppDeps } from '../deps.js';

export const WEBHOOK_SECRET = 'hook-secret';
export const API_SECRET = 'api-secret';

export const baseEnv = {
  NODE_ENV: 'test',
  CLOUDINARY_CLOUD_NAME: 'impact-cloud',
  CLOUDINARY_API_KEY: 'key-123',
  CLOUDINARY_API_SECRET: API_SECRET,
  CLOUDINARY_WEBHOOK_SECRET: WEBHOOK_SECRET,
};

export const fixedNow = new Date('2026-09-29T10:20:30.000Z');

export type Harness = {
  app: FastifyInstance;
  queue: QueueWithHandlers;
  searchCalls: string[];
  close(): Promise<void>;
};

export function makeDeps(
  queue: QueueWithHandlers,
  searchCalls: string[],
  overrides: Partial<AppDeps> = {},
  env: Record<string, string> = baseEnv,
): AppDeps {
  return {
    config: readApiConfig(env),
    cloud: { cloudName: 'impact-cloud', apiKey: 'key-123', apiSecret: API_SECRET },
    queue,
    now: () => fixedNow,
    searchAssets: async (expression) => {
      searchCalls.push(expression);
      return [{ public_id: 'gvie/WATER-01/after_1', metadata: { proj_id: 'WATER-01' } }];
    },
    ...overrides,
  };
}

export function makeEnvWithoutWebhookSecret(): Record<string, string> {
  return {
    NODE_ENV: 'test',
    CLOUDINARY_CLOUD_NAME: 'impact-cloud',
    CLOUDINARY_API_KEY: 'key-123',
    CLOUDINARY_API_SECRET: API_SECRET,
  };
}

export function signWebhookBody(raw: string): Record<string, string> {
  const timestamp = '1720000001';
  const signature = createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}.${raw}`)
    .digest('hex');
  return {
    'content-type': 'application/json',
    'x-cld-timestamp': timestamp,
    'x-cld-signature': signature,
  };
}

export function webhookSample(): Record<string, unknown> {
  return {
    notification_type: 'upload',
    timestamp: 1720000001,
    public_id: 'gvie/WATER-01/after_1',
    resource_type: 'image',
    metadata: {
      proj_id: 'WATER-01',
      veri_status: 'Pending_AI',
      tempo_phase: 'Outcome_After',
      base_asset_id: 'gvie/WATER-01/before_1',
      geo_coords: '12.97, 77.59',
    },
    context: { custom: { sha256: 'b'.repeat(64), c2pa_claimed: 'true' } },
    image_metadata: { GPSLatitude: 12.97, GPSLongitude: 77.59 },
  };
}

export const signSample = {
  proj_id: 'WATER-01',
  tempo_phase: 'Outcome_After',
  geo_coords: '12.97, 77.59',
  c2pa_valid: true,
  sha256: 'a'.repeat(64),
  base_asset_id: 'gvie/WATER-01/before_1',
};

export async function makeHarness(overrides: Partial<AppDeps> = {}, env?: Record<string, string>) {
  const queue = createMemoryQueue();
  const searchCalls: string[] = [];
  const app = await buildApp(makeDeps(queue, searchCalls, overrides, env));
  await app.ready();
  return {
    app,
    queue,
    searchCalls,
    close: () => app.close(),
  };
}

export type HarnessConfig = ApiConfig;
