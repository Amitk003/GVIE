/**
 * Test helpers: a fake fetch and a fake Cloudinary env.
 *
 * Nothing in the tests touches the network. We hand the code a function that
 * answers with whatever we want to test, good or bad.
 */

import type { CurrentMetadata } from './admin-client.js';
import type { TelemetryConfig } from './config.js';

export const testConfig: TelemetryConfig = {
  CLOUDINARY_CLOUD_NAME: 'impact-cloud',
  CLOUDINARY_API_KEY: 'key-123',
  CLOUDINARY_API_SECRET: 'secret-123',
  TELEMETRY_MAX_ATTEMPTS: 2,
  TELEMETRY_TIMEOUT_MS: 5000,
  TELEMETRY_AUDIT_FOLDER: 'gvie/audit',
};

export const currentMetadata: CurrentMetadata = {
  proj_id: 'WATER-01',
  veri_status: 'Pending_AI',
  c2pa_valid: true,
  tempo_phase: 'Outcome_After',
  base_asset_id: 'gvie/WATER-01/before_1',
  iqa_score: 0.8,
};

export type FakeCall = { url: string; body: Record<string, unknown> | null; method: string };

export type FakeResponse = {
  status?: number;
  json?: unknown;
  throws?: string;
};

export function fakeFetch(replies: FakeResponse[] | FakeResponse): {
  fetchImpl: typeof fetch;
  calls: FakeCall[];
} {
  const queue = Array.isArray(replies) ? [...replies] : [replies];
  const calls: FakeCall[] = [];

  const fetchImpl = (async (input: string, init?: RequestInit) => {
    const url = input;
    let body: Record<string, unknown> | null = null;
    if (typeof init?.body === 'string') {
      body = JSON.parse(init.body) as Record<string, unknown>;
    }
    calls.push({ url, body, method: init?.method ?? 'GET' });

    const next = queue.length > 1 ? (queue.shift() as FakeResponse) : (queue[0] as FakeResponse);
    if (next.throws) throw new Error(next.throws);
    const status = next.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => next.json ?? {},
    } as unknown as Response;
  }) as unknown as typeof fetch;

  return { fetchImpl, calls };
}

export const goodWaterAnswer = {
  data: {
    infrastructure_category: 'Water Access',
    operational_status: 'Fully Operational',
    quantitative_unit_count: 3,
    hazard_present: false,
    confidence_rating: 0.91,
  },
};
