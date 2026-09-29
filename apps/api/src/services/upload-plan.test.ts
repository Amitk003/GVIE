import { describe, expect, it } from 'vitest';
import { buildUploadPlan, encodeMetadataParam, slugify } from './upload-plan.js';

const config = { CLOUDINARY_UPLOAD_PRESET: 'gvie_signed', CLOUDINARY_FOLDER_ROOT: 'gvie' };

const basePayload = {
  proj_id: 'WATER-01',
  tempo_phase: 'Outcome_After' as const,
  geo_coords: '12.97, 77.59',
  c2pa_valid: true,
  sha256: 'a'.repeat(64),
  base_asset_id: 'gvie/WATER-01/water_001_base',
};

const fixedNow = new Date('2026-09-29T10:20:30.000Z');

describe('slugify', () => {
  it('makes safe id parts', () => {
    expect(slugify('WATER-01')).toBe('water_01');
    expect(slugify('  Forest Plot A! ')).toBe('forest_plot_a');
  });

  it('drops leading and trailing separators', () => {
    expect(slugify('---abc---')).toBe('abc');
  });
});

describe('metadata param', () => {
  it('joins core fields with pipes', () => {
    const plan = buildUploadPlan({ config, payload: basePayload, now: fixedNow });
    const text = encodeMetadataParam(plan.metadata);
    expect(text).toContain('proj_id=WATER-01');
    expect(text).toContain('c2pa_valid=false');
    expect(text).toContain('tempo_phase=Outcome_After');
    expect(text.split('|').length).toBe(6);
  });

  it('omits baseline when there is none', () => {
    const plan = buildUploadPlan({
      config,
      payload: { ...basePayload, tempo_phase: 'Baseline_Before', base_asset_id: null },
      now: fixedNow,
    });
    expect(encodeMetadataParam(plan.metadata)).not.toContain('base_asset_id');
  });
});

describe('upload plan', () => {
  it('builds a deterministic public id', () => {
    const plan = buildUploadPlan({ config, payload: basePayload, now: fixedNow });
    expect(plan.publicId).toBe('water_01_20260929102030_aaaaaaaaaaaa_base');
    expect(plan.folder).toBe('gvie/WATER-01');
  });

  it('keeps a client public id when given', () => {
    const plan = buildUploadPlan({
      config,
      payload: { ...basePayload, public_id: 'gvie/WATER-01/custom_1' },
      now: fixedNow,
    });
    expect(plan.publicId).toBe('gvie/WATER-01/custom_1');
  });

  it('keeps seal unverified even when the client says it is fine', () => {
    const plan = buildUploadPlan({ config, payload: basePayload, now: fixedNow });
    expect(plan.metadata.c2pa_valid).toBe(false);
    expect(plan.metadata.veri_status).toBe('Pending_AI');
    expect(plan.params.context).toContain('c2pa_claimed=true');
  });

  it('trusts a client report of a broken seal', () => {
    const plan = buildUploadPlan({
      config,
      payload: { ...basePayload, c2pa_valid: false },
      now: fixedNow,
    });
    expect(plan.metadata.c2pa_valid).toBe(false);
    expect(plan.metadata.veri_status).toBe('Failed_C2PA');
    expect(plan.params.context).toContain('c2pa_claimed=false');
  });

  it('flags large gps drift', () => {
    const plan = buildUploadPlan({
      config,
      payload: { ...basePayload, gps_drift_meters: 1200 },
      now: fixedNow,
    });
    expect(plan.metadata.veri_status).toBe('Flagged_Location');
  });

  it('put hash and claim in context and preset in params', () => {
    const plan = buildUploadPlan({ config, payload: basePayload, now: fixedNow });
    expect(plan.params.context).toContain(`sha256=${'a'.repeat(64)}`);
    expect(plan.params.context).toContain('c2pa_claimed=true');
    expect(plan.params.upload_preset).toBe('gvie_signed');
    expect(plan.params.metadata).toContain('proj_id=WATER-01');
  });

  it('adds capture time to context when given', () => {
    const plan = buildUploadPlan({
      config,
      payload: { ...basePayload, client_captured_at: '2026-09-29T09:00:00.000Z' },
      now: fixedNow,
    });
    expect(plan.params.context).toContain('captured_at=2026-09-29T09:00:00.000Z');
  });
});
