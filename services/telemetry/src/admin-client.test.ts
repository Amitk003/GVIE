import { describe, expect, it } from 'vitest';
import { buildMetadataPatch, toMetadataBody, writeMetadata } from './admin-client.js';
import { fakeFetch, testConfig } from './testing.js';

const mapped = {
  obj_count: 3,
  ndvi_delta: 0.21,
  impact_summary: 'Status Fully Operational. Counted 3 units.',
  operational_status: 'Fully Operational',
  hazard_present: false,
  confidence: 0.9,
};

describe('metadata body', () => {
  it('joins the fields we have', () => {
    const body = toMetadataBody({
      obj_count: 3,
      ndvi_delta: 0.21,
      impact_summary: 'hello',
      veri_status: 'Verified',
    });
    expect(body).toBe('veri_status=Verified|obj_count=3|ndvi_delta=0.21|impact_summary=hello');
  });

  it('drops empty answers so good data is not overwritten', () => {
    const body = toMetadataBody({
      obj_count: null,
      ndvi_delta: null,
      impact_summary: '',
      veri_status: 'Pending_AI',
    });
    expect(body).toBe('veri_status=Pending_AI');
  });
});

describe('build patch', () => {
  it('carries the status and the numbers', () => {
    const patch = buildMetadataPatch({ mapped, nextStatus: 'Verified' });
    expect(patch.veri_status).toBe('Verified');
    expect(patch.obj_count).toBe(3);
    expect(patch.ndvi_delta).toBe(0.21);
  });
});

describe('write metadata', () => {
  it('posts to the image resource with auth', async () => {
    const { fetchImpl, calls } = fakeFetch({ json: { public_id: 'gvie/a/b' } });
    const result = await writeMetadata({
      config: testConfig,
      publicId: 'gvie/a/b',
      patch: buildMetadataPatch({ mapped, nextStatus: 'Verified' }),
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    expect(calls[0].url).toContain('/resources/image/upload/gvie/a/b');
    expect(calls[0].method).toBe('POST');
    expect(String((calls[0].body as { metadata: string }).metadata)).toContain('veri_status=Verified');
  });

  it('reports a refused write', async () => {
    const { fetchImpl } = fakeFetch({ status: 403 });
    const result = await writeMetadata({
      config: testConfig,
      publicId: 'gvie/a/b',
      patch: buildMetadataPatch({ mapped, nextStatus: 'Verified' }),
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });
});
