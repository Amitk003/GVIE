import type { VeriStatus } from '@gvie/schemas';
import { needsRecapture } from '@gvie/schemas';

export const GPS_DRIFT_LIMIT_M = 500;
export const MIN_CONFIDENCE_FOR_VERIFIED = 0.6;

export type TrustInput = {
  c2paValid: boolean;
  gpsDriftMeters?: number | null;
};

/**
 * Used when the server itself has verified the seal.
 */
export function statusFromTrust(input: TrustInput): VeriStatus {
  if (!input.c2paValid) return 'Failed_C2PA';
  const drift = input.gpsDriftMeters;
  if (typeof drift === 'number' && Number.isFinite(drift) && drift > GPS_DRIFT_LIMIT_M) {
    return 'Flagged_Location';
  }
  return 'Pending_AI';
}

/**
 * Used at upload time. The client only reads the seal, so we never trust it.
 * A claim of "seal is broken" is accepted at once because there is nothing to gain
 * by keeping a known bad file. A claim of "seal is fine" stays unverified until the
 * server checks the manifest itself.
 */
export function initialStatusFromClaim(input: {
  c2paClaimedValid: boolean;
  gpsDriftMeters?: number | null;
}): VeriStatus {
  if (!input.c2paClaimedValid) return 'Failed_C2PA';
  const drift = input.gpsDriftMeters;
  if (typeof drift === 'number' && Number.isFinite(drift) && drift > GPS_DRIFT_LIMIT_M) {
    return 'Flagged_Location';
  }
  return 'Pending_AI';
}


export function canPromoteToVerified(input: {
  status: VeriStatus;
  c2paValid: boolean;
  confidence: number;
  iqaScore?: number | null;
}): boolean {
  if (!input.c2paValid) return false;
  if (input.status !== 'Pending_AI') return false;
  if (input.confidence < MIN_CONFIDENCE_FOR_VERIFIED) return false;
  if (needsRecapture({ iqa_score: input.iqaScore ?? null })) return false;
  return true;
}

export function haversineMeters(
  a: { lat: number; long: number },
  b: { lat: number; long: number },
): number {
  const earth = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLong = toRad(b.long - a.long);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLong / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}
