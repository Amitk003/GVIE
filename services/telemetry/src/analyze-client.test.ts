import { describe, expect, it } from 'vitest';
import { analyzeUrl, assetUrl, basicAuthHeader, readTelemetryConfig } from './config.js';
import { buildAnalyzeBody, callAnalyze, isWorthRetrying } from './analyze-client.js';
import { fakeFetch, goodWaterAnswer, testConfig } from './testing.js';

describe('telemetry config', () => {
  it('reads keys and applies defaults', () => {
    const config = readTelemetryConfig({
      CLOUDINARY_CLOUD_NAME: 'c',
      CLOUDINARY_API_KEY: 'k',
      CLOUDINARY_API_SECRET: 's',
    });
    expect(config.TELEMETRY_MAX_ATTEMPTS).toBe(2);
    expect(config.TELEMETRY_AUDIT_FOLDER).toBe('gvie/audit');
  });

  it('fails when keys are missing', () => {
    expect(() => readTelemetryConfig({})).toThrow('bad telemetry env');
  });

  it('builds urls and auth header', () => {
    expect(analyzeUrl('impact-cloud')).toContain('/analyze/ai_vision_tagging');
    expect(assetUrl('impact-cloud', 'gvie/a/b')).toBe(
      'https://res.cloudinary.com/impact-cloud/image/upload/gvie/a/b',
    );
    expect(basicAuthHeader('k', 's')).toBe(`Basic ${Buffer.from('k:s').toString('base64')}`);
  });
});

describe('analyze body', () => {
  it('carries the sector schema and prompt', () => {
    const body = buildAnalyzeBody({ sector: 'water', imageUrl: 'https://x.test/a.jpg' });
    expect(body.source).toEqual({ uri: 'https://x.test/a.jpg' });
    expect(Array.isArray(body.prompts)).toBe(true);
    expect((body.json_schema as { additionalProperties: boolean }).additionalProperties).toBe(
      false,
    );
  });

  it('adds an extra instruction when asked', () => {
    const body = buildAnalyzeBody({
      sector: 'solar',
      imageUrl: 'u',
      extraInstruction: 'Look at the left row.',
    });
    expect((body.prompts as string[]).length).toBe(2);
  });
});

describe('retry rules', () => {
  it('retries a busy server and a broken server', () => {
    expect(isWorthRetrying(429)).toBe(true);
    expect(isWorthRetrying(500)).toBe(true);
    expect(isWorthRetrying(503)).toBe(true);
  });

  it('does not retry a bad request or a bad key', () => {
    expect(isWorthRetrying(400)).toBe(false);
    expect(isWorthRetrying(401)).toBe(false);
  });
});

describe('analyze call', () => {
  it('returns the raw answer on success', async () => {
    const { fetchImpl, calls } = fakeFetch({ json: goodWaterAnswer });
    const result = await callAnalyze({
      config: testConfig,
      publicId: 'gvie/WATER-01/after_1',
      sector: 'water',
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    expect(calls[0].url).toContain('api.cloudinary.com/v2/analysis');
    expect(calls[0].method).toBe('POST');
  });

  it('does not retry a bad key', async () => {
    const { fetchImpl, calls } = fakeFetch({ status: 401 });
    const result = await callAnalyze({
      config: testConfig,
      publicId: 'gvie/a/b',
      sector: 'water',
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    expect(calls.length).toBe(1);
  });

  it('retries a busy server then succeeds', async () => {
    const { fetchImpl, calls } = fakeFetch([{ status: 429 }, { json: goodWaterAnswer }]);
    const result = await callAnalyze({
      config: testConfig,
      publicId: 'gvie/a/b',
      sector: 'water',
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    expect(calls.length).toBe(2);
  });

  it('gives up after the attempt limit', async () => {
    const { fetchImpl, calls } = fakeFetch({ status: 500 });
    const result = await callAnalyze({
      config: testConfig,
      publicId: 'gvie/a/b',
      sector: 'water',
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    expect(calls.length).toBe(2);
  });

  it('survives a network error', async () => {
    const { fetchImpl } = fakeFetch({ throws: 'socket hang up' });
    const result = await callAnalyze({
      config: testConfig,
      publicId: 'gvie/a/b',
      sector: 'water',
      fetchImpl,
    });
    expect(result.ok).toBe(false);
  });
});
