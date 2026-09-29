import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeHarness, type Harness } from './testing/harness.js';

let h: Harness;

beforeEach(async () => {
  h = await makeHarness();
});

afterEach(async () => {
  await h.close();
});

describe('asset routes', () => {
  it('searches with filters', async () => {
    const res = await h.app.inject({
      method: 'GET',
      url: '/v1/assets?proj_id=WATER-01&veri_status=Verified&max=5',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.count).toBe(1);
    expect(body.expression).toContain('metadata.proj_id="WATER-01"');
    expect(body.expression).toContain('metadata.veri_status="Verified"');
    expect(h.searchCalls).toHaveLength(1);
  });

  it('rejects a bad status value', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/v1/assets?veri_status=Nope' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a max above the limit', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/v1/assets?max=500' });
    expect(res.statusCode).toBe(400);
  });

  it('returns one asset by public id', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/v1/assets/gvie%2FWATER-01%2Fafter_1' });
    expect(res.statusCode).toBe(200);
    expect(res.json().asset.public_id).toBe('gvie/WATER-01/after_1');
  });

  it('returns 404 when nothing matches', async () => {
    const empty = await makeHarness({ searchAssets: async () => [] });
    const res = await empty.app.inject({ method: 'GET', url: '/v1/assets/gvie%2Fa%2Fb' });
    expect(res.statusCode).toBe(404);
    await empty.close();
  });

  it('returns 503 when search is not configured', async () => {
    const noSearch = await makeHarness({ searchAssets: undefined });
    const res = await noSearch.app.inject({ method: 'GET', url: '/v1/assets' });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe('search not configured');
    await noSearch.close();
  });
});

describe('telemetry route', () => {
  it('accepts a known sector and queues the job', async () => {
    const res = await h.app.inject({
      method: 'POST',
      url: '/v1/telemetry/run',
      payload: { public_id: 'gvie/WATER-01/after_1', sector: 'water' },
    });
    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.sector).toBe('water');
    expect(body.request.url).toContain('/analyze/ai_vision_tagging');
    expect(body.request.body.json_schema.additionalProperties).toBe(false);
    expect(h.queue.size()).toBe(1);
  });

  it('keeps the strict schema in the reply', async () => {
    const res = await h.app.inject({
      method: 'POST',
      url: '/v1/telemetry/run',
      payload: { public_id: 'gvie/WATER-01/after_1', sector: 'forest' },
    });
    expect(res.json().request.body.json_schema.required).toContain('canopy_cover_pct');
  });

  it('rejects an unknown sector', async () => {
    const res = await h.app.inject({
      method: 'POST',
      url: '/v1/telemetry/run',
      payload: { public_id: 'gvie/WATER-01/after_1', sector: 'mining' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('unknown sector');
  });

  it('rejects a bad public id', async () => {
    const res = await h.app.inject({
      method: 'POST',
      url: '/v1/telemetry/run',
      payload: { public_id: 'bad id', sector: 'water' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('reports a failed analyze call', async () => {
    const failing = await makeHarness({
      runAnalyze: async () => ({ ok: false, reason: 'analyze failed with 429' }),
    });
    const res = await failing.app.inject({
      method: 'POST',
      url: '/v1/telemetry/run',
      payload: { public_id: 'gvie/WATER-01/after_1', sector: 'solar' },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().reason).toContain('429');
    await failing.close();
  });
});

describe('export route', () => {
  const valid = {
    title: 'Water done',
    place: 'Block A',
    assets: [
      {
        public_id: 'gvie/WATER-01/before_1',
        aligned_id: 'gvie/WATER-01/aligned_1',
        sha256: 'a'.repeat(64),
        veri_status: 'Verified',
        obj_count: 3,
      },
    ],
    video_scene_ids: ['v/one', 'v/two'],
  };

  it('builds a proof manifest', async () => {
    const res = await h.app.inject({
      method: 'POST',
      url: '/v1/exports/proof',
      payload: valid,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json().manifest;
    expect(body.assetCount).toBe(1);
    expect(body.assets[0].compareUrl).toContain('l_gvie:WATER-01:aligned_1');
    expect(body.reelUrl).toContain('fl_splice');
    expect(body.generatedAt).toBe('2026-09-29T10:20:30.000Z');
  });

  it('leaves the reel empty without video scenes', async () => {
    const res = await h.app.inject({
      method: 'POST',
      url: '/v1/exports/proof',
      payload: { title: 'T', place: 'P', assets: [{ public_id: 'gvie/a/b' }] },
    });
    expect(res.json().manifest.reelUrl).toBeNull();
  });

  it('rejects an empty asset list', async () => {
    const res = await h.app.inject({
      method: 'POST',
      url: '/v1/exports/proof',
      payload: { title: 'T', place: 'P', assets: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects an out of range delta', async () => {
    const res = await h.app.inject({
      method: 'POST',
      url: '/v1/exports/proof',
      payload: { title: 'T', place: 'P', assets: [{ public_id: 'gvie/a/b', ndvi_delta: 4 }] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a short hash', async () => {
    const res = await h.app.inject({
      method: 'POST',
      url: '/v1/exports/proof',
      payload: {
        title: 'T',
        place: 'P',
        assets: [{ public_id: 'gvie/a/b', sha256: 'abc' }],
      },
    });
    expect(res.statusCode).toBe(400);
  });
});
