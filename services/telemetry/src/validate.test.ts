import { describe, expect, it } from 'vitest';
import {
  describeIssues,
  mapTelemetryToFields,
  nextVeriStatus,
  readConfidence,
  unwrapAnswer,
  validateTelemetry,
} from './validate.js';

const waterAnswer = {
  infrastructure_category: 'Water Access',
  operational_status: 'Fully Operational',
  quantitative_unit_count: 3,
  hazard_present: false,
  confidence_rating: 0.91,
};

const forestAnswer = {
  infrastructure_category: 'Reforestation',
  canopy_cover_pct: 62,
  sapling_count: 140,
  ndvi_delta: 0.22,
  hazard_present: false,
  confidence_rating: 0.8,
};

const solarAnswer = {
  infrastructure_category: 'Solar Array',
  panel_count: 24,
  soiling_score: 0.31,
  tilt_anomaly: true,
  operational_status: 'Damaged',
  confidence_rating: 0.72,
};

describe('unwrap answer', () => {
  it('finds the object inside data', () => {
    expect(unwrapAnswer({ data: waterAnswer })).toEqual(waterAnswer);
  });

  it('finds the object inside an array', () => {
    expect(unwrapAnswer([{ data: waterAnswer }])).toEqual(waterAnswer);
  });

  it('gives a plain object straight back', () => {
    expect(unwrapAnswer(waterAnswer)).toEqual(waterAnswer);
  });

  it('gives null for an empty list', () => {
    expect(unwrapAnswer([])).toBeNull();
  });
});

describe('validate telemetry', () => {
  it('accepts a good water answer', () => {
    const result = validateTelemetry({ sector: 'water', raw: { data: waterAnswer } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.confidence).toBe(0.91);
      expect(result.needsHuman).toBe(false);
    }
  });

  it('rejects an extra field', () => {
    const result = validateTelemetry({
      sector: 'water',
      raw: { data: { ...waterAnswer, extra: 'nope' } },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a missing required field', () => {
    const broken = { ...waterAnswer } as Record<string, unknown>;
    delete broken.operational_status;
    const result = validateTelemetry({ sector: 'water', raw: { data: broken } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fields.join(' ')).toContain('operational_status');
  });

  it('rejects a count that is not a number', () => {
    const result = validateTelemetry({
      sector: 'water',
      raw: { data: { ...waterAnswer, quantitative_unit_count: 'three' } },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects free text where a number belongs', () => {
    const result = validateTelemetry({
      sector: 'water',
      raw: { data: { ...waterAnswer, operational_status: 'good' } },
    });
    expect(result.ok).toBe(false);
  });

  it('keeps the raw answer for the audit log', () => {
    const result = validateTelemetry({ sector: 'water', raw: { data: { bad: true } } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.raw).toEqual({ data: { bad: true } });
  });

  it('asks for a human when confidence is low', () => {
    const result = validateTelemetry({
      sector: 'water',
      raw: { data: { ...waterAnswer, confidence_rating: 0.4 } },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.needsHuman).toBe(true);
  });

  it('checks the sector matches the answer', () => {
    const result = validateTelemetry({ sector: 'forest', raw: { data: waterAnswer } });
    expect(result.ok).toBe(false);
  });
});

describe('issue text', () => {
  it('turns issues into readable lines', () => {
    const text = describeIssues([{ path: ['a', 'b'], message: 'bad' }]);
    expect(text[0]).toBe('a.b: bad');

    describe('map telemetry to fields', () => {
      it('maps water facts', () => {
        const mapped = mapTelemetryToFields({
          sector: 'water',
          data: waterAnswer,
          confidence: 0.91,
        });
        expect(mapped.obj_count).toBe(3);
        expect(mapped.operational_status).toBe('Fully Operational');
        expect(mapped.hazard_present).toBe(false);
        expect(mapped.impact_summary).toContain('Counted 3 units');
      });

      it('maps forest facts', () => {
        const mapped = mapTelemetryToFields({
          sector: 'forest',
          data: forestAnswer,
          confidence: 0.8,
        });
        expect(mapped.obj_count).toBe(140);
        expect(mapped.ndvi_delta).toBe(0.22);
        expect(mapped.impact_summary).toContain('Cover about 62 percent');
      });

      it('maps solar facts and the tilt warning', () => {
        const mapped = mapTelemetryToFields({
          sector: 'solar',
          data: solarAnswer,
          confidence: 0.72,
        });
        expect(mapped.obj_count).toBe(24);
        expect(mapped.impact_summary).toContain('tilt looks wrong');
      });

      it('mentions a hazard', () => {
        const mapped = mapTelemetryToFields({
          sector: 'water',
          data: { ...waterAnswer, hazard_present: true },
          confidence: 0.9,
        });
        expect(mapped.impact_summary).toContain('hazard');
      });

      it('leaves unknown numbers empty instead of guessing', () => {
        const mapped = mapTelemetryToFields({ sector: 'water', data: {}, confidence: 0 });
        expect(mapped.obj_count).toBeNull();
        expect(mapped.ndvi_delta).toBeNull();
      });

      it('keeps the summary under the field limit', () => {
        const mapped = mapTelemetryToFields({
          sector: 'solar',
          data: solarAnswer,
          confidence: 0.7,
        });
        expect(mapped.impact_summary.length).toBeLessThanOrEqual(1000);
      });
    });

    describe('next status', () => {
      it('promotes when allowed', () => {
        expect(nextVeriStatus({ current: 'Pending_AI', canPromote: true })).toBe('Verified');
      });

      it('keeps the current status otherwise', () => {
        expect(nextVeriStatus({ current: 'Pending_AI', canPromote: false })).toBe('Pending_AI');
        expect(nextVeriStatus({ current: 'Flagged_Location', canPromote: false })).toBe(
          'Flagged_Location',
        );
      });
    });
  });

  it('copes with an unknown shape', () => {
    expect(describeIssues(undefined)).toEqual(['unknown shape']);
  });

  it('reads confidence safely', () => {
    expect(readConfidence({ confidence_rating: 0.5 })).toBe(0.5);
    expect(readConfidence({})).toBe(0);
    expect(readConfidence(null)).toBe(0);
  });
});
