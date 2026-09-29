/**
 * Turn a chosen photo into everything the API needs for a signed upload.
 *
 * Plain words: we work out the hash, we read the seal, we check the pin, and we
 * hand back one clean object. The screen then shows the truth badge from it.
 */

import { isSha256, readSealClaimFromBytes, sha256Hex, type SealClaim } from './seal.js';

export type CaptureInput = {
  file: ArrayBuffer;
  projId: string;
  tempoPhase: 'Baseline_Before' | 'Interim_Work' | 'Outcome_After';
  geoCoords: string | null;
  baseAssetId?: string | null;
  clientCapturedAt?: string;
  exifGps?: { lat: number; long: number } | null;
  ipGps?: { lat: number; long: number } | null;
};

export type CaptureResult = {
  ok: boolean;
  body: Record<string, unknown> | null;
  sha256: string | null;
  seal: SealClaim | null;
  errors: string[];
};

const GPS_DRIFT_LIMIT_M = 500;

export async function prepareCapture(input: CaptureInput): Promise<CaptureResult> {
  const errors: string[] = [];

  let sha256: string | null = null;
  try {
    sha256 = await sha256Hex(input.file);
  } catch {
    errors.push('could not read the file to make a hash');
  }

  const seal = readSealClaimFromBytes(new Uint8Array(input.file));

  if (!input.projId || input.projId.trim() === '') {
    errors.push('choose a project');
  }
  if (!input.geoCoords) {
    errors.push('we need the place of this photo');
  }
  if (sha256 !== null && !isSha256(sha256)) {
    errors.push('the file hash looks wrong');
  }

  const drift = gpsDriftMeters(input.exifGps, input.ipGps);
  if (drift !== null && drift > GPS_DRIFT_LIMIT_M) {
    errors.push('the photo pin and the network pin are far apart, check the place');
  }

  if (errors.length > 0 || sha256 === null) {
    return { ok: false, body: null, sha256, seal, errors };
  }

  return {
    ok: true,
    sha256,
    seal,
    errors: [],
    body: {
      proj_id: input.projId.trim(),
      tempo_phase: input.tempoPhase,
      geo_coords: input.geoCoords,
      c2pa_valid: seal.c2pa_valid,
      sha256,
      base_asset_id: input.baseAssetId ?? null,
      ...(input.clientCapturedAt ? { client_captured_at: input.clientCapturedAt } : {}),
      ...(drift !== null ? { gps_drift_meters: Math.round(drift) } : {}),
    },
  };
}

export function gpsDriftMeters(
  a: { lat: number; long: number } | null | undefined,
  b: { lat: number; long: number } | null | undefined,
): number | null {
  if (!a || !b) return null;
  return haversineMeters(a, b);
}

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(
  a: { lat: number; long: number },
  b: { lat: number; long: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLong = toRad(b.long - a.long);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLong / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The badge a field worker sees. We never promise Verified here. This is only
 * what the phone could read on its own.
 */
export type TrustBadge = {
  label: string;
  tone: 'good' | 'warn' | 'bad';
  detail: string;
};

export function badgeForSeal(claim: SealClaim | null): TrustBadge {
  if (!claim) {
    return { label: 'Not checked', tone: 'warn', detail: 'we could not look inside this file' };
  }
  if (claim.c2pa_valid) {
    return {
      label: 'Seal looks good',
      tone: 'good',
      detail: 'our server will still check it before anything is called Verified',
    };
  }
  return { label: 'No valid seal', tone: 'bad', detail: claim.reason };
}
