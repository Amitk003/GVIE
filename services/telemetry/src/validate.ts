/**
 * Check what the AI sent back before we believe a single number.
 *
 * Plain words: the answer must match the sector schema exactly. If it does not,
 * it never reaches the metadata fields. The raw answer is kept for the audit log
 * so a human can see what went wrong.
 */

import {
  isConfidentEnough,
  telemetryBySector,
  type SectorName,
  type VeriStatus,
} from '@gvie/schemas';

export type ValidationSuccess<T> = {
  ok: true;
  data: T;
  confidence: number;
  needsHuman: boolean;
};

export type ValidationFailure = {
  ok: false;
  reason: string;
  fields: string[];
  raw: unknown;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * The Analyze API wraps our answer in data or in an array of data. Pull the
 * object out without guessing.
 */
export function unwrapAnswer(raw: unknown): unknown {
  if (Array.isArray(raw)) {
    return raw.length > 0 ? unwrapAnswer(raw[0]) : null;
  }
  if (raw && typeof raw === 'object' && 'data' in raw) {
    const inner = (raw as { data: unknown }).data;
    return Array.isArray(inner) && inner.length > 0 ? inner[0] : inner;
  }
  return raw;
}

export function validateTelemetry<T>(input: {
  sector: SectorName;
  raw: unknown;
}): ValidationResult<T> {
  const candidate = unwrapAnswer(input.raw);
  const schema = telemetryBySector[input.sector] as unknown as {
    safeParse: (value: unknown) => { success: boolean; data?: T; error?: { issues: unknown[] } };
  };
  const parsed = schema.safeParse(candidate);

  if (!parsed.success) {
    return {
      ok: false,
      reason: 'ai answer did not match the sector schema',
      fields: describeIssues(parsed.error?.issues),
      raw: input.raw,
    };
  }

  const confidence = readConfidence(parsed.data);
  return {
    ok: true,
    data: parsed.data as T,
    confidence,
    needsHuman: !isConfidentEnough(confidence),
  };
}

export function describeIssues(issues: unknown): string[] {
  if (!Array.isArray(issues)) return ['unknown shape'];
  return issues.slice(0, 10).map((issue) => {
    const entry = issue as { path?: unknown[]; message?: string };
    const path = Array.isArray(entry.path) ? entry.path.join('.') : 'answer';
    return `${path}: ${entry.message ?? 'did not match'}`;
  });
}

export function readConfidence(data: unknown): number {
  if (!data || typeof data !== 'object') return 0;
  const value = (data as { confidence_rating?: unknown }).confidence_rating;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export type MappedTelemetry = {
  obj_count: number | null;
  ndvi_delta: number | null;
  impact_summary: string;
  operational_status: string | null;
  hazard_present: boolean | null;
  confidence: number;
};

export function mapTelemetryToFields(input: {
  sector: SectorName;
  data: unknown;
  confidence: number;
}): MappedTelemetry {
  const data = (input.data ?? {}) as Record<string, unknown>;
  const pickNumber = (...keys: string[]): number | null => {
    for (const key of keys) {
      const value = data[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
    }
    return null;
  };
  const pickBoolean = (...keys: string[]): boolean | null => {
    for (const key of keys) {
      const value = data[key];
      if (typeof value === 'boolean') return value;
    }
    return null;
  };
  const pickText = (...keys: string[]): string | null => {
    for (const key of keys) {
      const value = data[key];
      if (typeof value === 'string' && value.trim() !== '') return value.trim();
    }
    return null;
  };

  const objCount = pickNumber(
    'quantitative_unit_count',
    'sapling_count',
    'panel_count',
    'unit_count',
  );
  const ndvi = pickNumber('ndvi_delta');
  const status = pickText('operational_status');
  const hazard = pickBoolean('hazard_present');
  const canopy = pickNumber('canopy_cover_pct');
  const soiling = pickNumber('soiling_score');
  const tilt = pickBoolean('tilt_anomaly');

  return {
    obj_count: objCount,
    ndvi_delta: ndvi,
    operational_status: status,
    hazard_present: hazard,
    confidence: input.confidence,
    impact_summary: buildSummary({ sector: input.sector, status, objCount, ndvi, canopy, soiling, tilt, hazard }),
  };
}

function buildSummary(parts: {
  sector: SectorName;
  status: string | null;
  objCount: number | null;
  ndvi: number | null;
  canopy: number | null;
  soiling: number | null;
  tilt: boolean | null;
  hazard: boolean | null;
}): string {
  const sentences: string[] = [];
  if (parts.status) sentences.push(`Status ${parts.status}.`);
  if (parts.objCount !== null) sentences.push(`Counted ${parts.objCount} units.`);
  if (parts.canopy !== null) sentences.push(`Cover about ${parts.canopy} percent.`);
  if (parts.ndvi !== null) sentences.push(`Plant change ${parts.ndvi.toFixed(2)}.`);
  if (parts.soiling !== null) sentences.push(`Dirt score ${parts.soiling.toFixed(2)}.`);
  if (parts.tilt === true) sentences.push('Panel tilt looks wrong.');
  if (parts.hazard === true) sentences.push('Possible hazard seen.');
  if (sentences.length === 0) return `No readable facts for the ${parts.sector} sector.`;
  return sentences.join(' ').slice(0, 1000);
}

export function nextVeriStatus(input: {
  current: VeriStatus;
  canPromote: boolean;
}): VeriStatus {
  if (input.canPromote) return 'Verified';
  return input.current;
}
