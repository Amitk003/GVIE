import { describe, expect, it } from 'vitest';
import { runJob, type Job } from './worker.js';
import { currentMetadata, fakeFetch, goodWaterAnswer, testConfig } from './testing.js';

const waterJob: Job = {
  publicId: 'gvie/WATER-01/after_1',
  sector: 'water',
  current: currentMetadata,
};

const forestJob: Job = {
  publicId: 'gvie/FOREST-01/after_1',
  sector: 'forest',
  current: { ...currentMetadata, proj_id: 'FOREST-01' },
};

const solarJob: Job = {
  publicId: 'gvie/SOLAR-01/after_1',
  sector: 'solar',
  current: { ...currentMetadata, proj_id: 'SOLAR-01' },
};

const good = { status: 200, json: goodWaterAnswer };
const writeOk = { status: 200, json: { public_id: 'gvie/a/b' } };

describe('happy path', () => {
  it('writes clean numbers and promotes to verified', async () => {
    const { fetchImpl } = fakeFetch([good, writeOk]);
    const result = await runJob(waterJob, { config: testConfig, fetchImpl });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe('Verified');
      expect(result.confidence).toBeCloseTo(0.91);
      expect(result.needsHuman).toBe(false);
      expect(result.fieldsWritten).toContain('obj_count');
    }
  });

  it('handles a forest answer', async () => {
    const { fetchImpl } = fakeFetch([
      {
        status: 200,
        json: {
          data: {
            infrastructure_category: 'Reforestation',
            canopy_cover_pct: 62,
            sapling_count: 140,
            ndvi_delta: 0.22,
            hazard_present: false,
            confidence_rating: 0.8,
          },
        },
      },
      writeOk,
    ]);
    const result = await runJob(forestJob, { config: testConfig, fetchImpl });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status).toBe('Verified');
  });

  it('handles a solar answer', async () => {
    const { fetchImpl } = fakeFetch([
      {
        status: 200,
        json: {
          data: {
            infrastructure_category: 'Solar Array',
            panel_count: 24,
            soiling_score: 0.31,
            tilt_anomaly: true,
            operational_status: 'Damaged',
            confidence_rating: 0.72,
          },
        },
      },
      writeOk,
    ]);
    const result = await runJob(solarJob, { config: testConfig, fetchImpl });
    expect(result.ok).toBe(true);
  });
});

describe('the seal is never ignored', () => {
  it('stays pending when the seal check failed', async () => {
    const { fetchImpl } = fakeFetch([good, writeOk]);
    const result = await runJob(
      { ...waterJob, current: { ...currentMetadata, c2pa_valid: false } },
      { config: testConfig, fetchImpl },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status).not.toBe('Verified');
  });

  it('stays pending when the location is flagged', async () => {
    const { fetchImpl } = fakeFetch([good, writeOk]);
    const result = await runJob(
      { ...waterJob, current: { ...currentMetadata, veri_status: 'Flagged_Location' } },
      { config: testConfig, fetchImpl },
    );
    if (result.ok) expect(result.status).toBe('Flagged_Location');
  });

  it('stays pending when confidence is low', async () => {
    const { fetchImpl } = fakeFetch([
      {
        status: 200,
        json: {
          data: { ...goodWaterAnswer.data, confidence_rating: 0.42 },
        },
      },
      writeOk,
    ]);
    const result = await runJob(waterJob, { config: testConfig, fetchImpl });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe('Pending_AI');
      expect(result.needsHuman).toBe(true);
    }
  });

  it('stays pending when the photo is blurry', async () => {
    const { fetchImpl } = fakeFetch([good, writeOk]);
    const result = await runJob(
      { ...waterJob, current: { ...currentMetadata, iqa_score: 0.2 } },
      { config: testConfig, fetchImpl },
    );
    if (result.ok) expect(result.status).toBe('Pending_AI');
  });

  it('stays pending when an after photo has no baseline', async () => {
    const { fetchImpl } = fakeFetch([good, writeOk]);
    const result = await runJob(
      { ...waterJob, current: { ...currentMetadata, base_asset_id: null } },
      { config: testConfig, fetchImpl },
    );
    if (result.ok) expect(result.status).toBe('Pending_AI');
  });
});

describe('nothing bad is ever written', () => {
  it('stops at analyze when the call fails', async () => {
    const { fetchImpl, calls } = fakeFetch({ status: 401 });
    const result = await runJob(waterJob, { config: testConfig, fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.stage).toBe('analyze');
    expect(calls.length).toBe(1);
  });

  it('stops at validate when the answer is junk', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { status: 200, json: { data: { text: 'looks good' } } },
    ]);
    const result = await runJob(waterJob, { config: testConfig, fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.stage).toBe('validate');
    expect(calls.length).toBe(1);
  });

  it('stops at write when cloudinary refuses', async () => {
    const { fetchImpl } = fakeFetch([good, { status: 500 }]);
    const result = await runJob(waterJob, { config: testConfig, fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.stage).toBe('write');
  });
});
