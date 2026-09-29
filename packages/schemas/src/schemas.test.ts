import { describe, expect, it } from 'vitest';
import { assetMetadataSchema, canShowPublic, needsRecapture } from './metadata.js';
import { defaultMetadataForUpload } from './metadata.js';
import { waterTelemetrySchema } from './telemetry.js';

describe('metadata model', () => {
  it('sets safe defaults for new upload', () => {
    const meta = defaultMetadataForUpload({
      proj_id: 'WATER-01',
      geo_coords: '12.97, 77.59',
      tempo_phase: 'Outcome_After',
      base_asset_id: 'proj/base_001',
    });
    expect(meta.veri_status).toBe('Pending_AI');
    expect(meta.c2pa_valid).toBe(false);
  });

  it('rejects bad geo text', () => {
    const out = assetMetadataSchema.safeParse({
      proj_id: 'WATER-01',
      veri_status: 'Pending_AI',
      c2pa_valid: false,
      geo_coords: 'not-a-place',
      tempo_phase: 'Baseline_Before',
      base_asset_id: null,
      ndvi_delta: null,
      obj_count: null,
      iqa_score: null,
      impact_summary: '',
    });
    expect(out.success).toBe(false);
  });

  it('hides non verified assets from public', () => {
    expect(canShowPublic({ veri_status: 'Pending_AI', c2pa_valid: true })).toBe(false);
    expect(canShowPublic({ veri_status: 'Verified', c2pa_valid: false })).toBe(false);
    expect(canShowPublic({ veri_status: 'Verified', c2pa_valid: true })).toBe(true);
  });

  it('flags blurry photos for recapture', () => {
    expect(needsRecapture({ iqa_score: 0.2 })).toBe(true);
    expect(needsRecapture({ iqa_score: 0.9 })).toBe(false);
  });
});

describe('telemetry model', () => {
  it('rejects extra fields in strict mode', () => {
    const out = waterTelemetrySchema.safeParse({
      infrastructure_category: 'Water Access',
      operational_status: 'Fully Operational',
      quantitative_unit_count: 2,
      hazard_present: false,
      confidence_rating: 0.9,
      extra: 'nope',
    });
    expect(out.success).toBe(false);
  });
});
