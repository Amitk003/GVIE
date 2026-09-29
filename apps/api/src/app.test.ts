import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeHarness, signSample, signWebhookBody, webhookSample, makeEnvWithoutWebhookSecret, type Harness } from './testing/harness.js';

let h: Harness;

beforeEach(async () => {
  h = await makeHarness();
});

afterEach(async () => {
  await h.close();
});

describe('health route', () => {
  it('answers ok', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, service: 'gvie-api' });
  });
});

describe('upload sign route', () => {
  it('returns a signed plan with a fail closed seal', async () => {
    const res = await h.app.inject({
      method: 'POST',
      url: '/v1/uploads/sign',
      payload: signSample,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.publicId).toBe('water_01_20260929102030_aaaaaaaaaaaa_base');
    expect(body.folder).toBe('gvie/WATER-01');
    expect(body.signature).toMatch(/^[a-f0-9]{40}$/);
    expect(body.metadata.c2pa_valid).toBe(false);
    expect(body.metadata.veri_status).toBe('Pending_AI');
    expect(body.params.metadata).toContain('proj_id=WATER-01');
  });

  it('marks a claimed broken seal as failed', async () => {
    const res = await h.app.inject({
      method: 'POST',
      url: '/v1/uploads/sign',
      payload: { ...signSample, c2pa_valid: false },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().metadata.veri_status).toBe('Failed_C2PA');
  });

  it('rejects bad coords with a field list', async () => {
    const res = await h.app.inject({
      method: 'POST',
      url: '/v1/uploads/sign',
      payload: { ...signSample, geo_coords: 'nowhere' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().details[0]).toContain('geo_coords');
  });

  it('rejects a missing hash', async () => {
    const res = await h.app.inject({
      method: 'POST',
      url: '/v1/uploads/sign',
      payload: { ...signSample, sha256: 'short' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('webhook route', () => {
  it('accepts a signed upload and queues the plan', async () => {
    const raw = JSON.stringify(webhookSample());
    const res = await h.app.inject({
      method: 'POST',
      url: '/v1/webhooks/cloudinary',
      headers: signWebhookBody(raw),
      payload: raw,
    });
    expect(res.statusCode).toBe(202);
    expect(res.json().jobs).toEqual(['baseline_lookup', 'align', 'telemetry', 'index']);
    expect(h.queue.size()).toBe(4);
  });

  it('rejects a bad signature with 401', async () => {
    const raw = JSON.stringify(webhookSample());
    const res = await h.app.inject({
      method: 'POST',
      url: '/v1/webhooks/cloudinary',
      headers: { 'content-type': 'application/json', 'x-cld-signature': 'wrong' },
      payload: raw,
    });
    expect(res.statusCode).toBe(401);
    expect(h.queue.size()).toBe(0);
  });

  it('rejects a body without a public id', async () => {
    const raw = JSON.stringify({ notification_type: 'upload', timestamp: 1 });
    const res = await h.app.inject({
      method: 'POST',
      url: '/v1/webhooks/cloudinary',
      headers: signWebhookBody(raw),
      payload: raw,
    });
    expect(res.statusCode).toBe(400);
  });

  it('fails closed when no webhook secret is set', async () => {
    const secretless = await makeHarness({}, makeEnvWithoutWebhookSecret());
    const res = await secretless.app.inject({
      method: 'POST',
      url: '/v1/webhooks/cloudinary',
      headers: { 'content-type': 'application/json', 'x-cld-signature': 'x' },
      payload: JSON.stringify(webhookSample()),
    });
    expect(res.statusCode).toBe(500);
    expect(res.json().error).toContain('CLOUDINARY_WEBHOOK_SECRET');
    await secretless.close();
  });
});

describe('unknown route', () => {
  it('returns 404 with a clear message', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/v1/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('route not found');
  });
});
