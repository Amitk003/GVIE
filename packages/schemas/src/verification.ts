/**
 * The rules that decide whether a file may be called Verified.
 *
 * They live in the shared package because the API and the telemetry worker both
 * have to agree. If they ever disagree, a file could be marked Verified by one
 * and unverified by the other, and that is exactly the kind of hole this project
 * exists to close.
 */

import type { VeriStatus } from './common.js';
import { needsBaselineLink, needsRecapture } from './metadata.js';

export const GPS_DRIFT_LIMIT_M = 500;
export const MIN_CONFIDENCE_FOR_VERIFIED = 0.6;

export type PromotionInput = {
  status: VeriStatus;
  c2paValid: boolean;
  confidence: number;
  iqaScore?: number | null;
  tempoPhase?: string | null;
  baseAssetId?: string | null;
};

export function canPromoteToVerified(input: PromotionInput): boolean {
  if (!input.c2paValid) return false;
  if (input.status !== 'Pending_AI') return false;
  if (input.confidence < MIN_CONFIDENCE_FOR_VERIFIED) return false;
  if (needsRecapture({ iqa_score: input.iqaScore ?? null })) return false;
  if (
    needsBaselineLink({
      tempo_phase: (input.tempoPhase ?? 'Baseline_Before') as never,
      base_asset_id: input.baseAssetId ?? null,
    })
  ) {
    return false;
  }
  return true;
}

/**
 * Called when the server itself has checked the seal.
 */
export function statusFromVerifiedSeal(input: {
  c2paValid: boolean;
  gpsDriftMeters?: number | null;
}): VeriStatus {
  if (!input.c2paValid) return 'Failed_C2PA';
  const drift = input.gpsDriftMeters;
  if (typeof drift === 'number' && Number.isFinite(drift) && drift > GPS_DRIFT_LIMIT_M) {
    return 'Flagged_Location';
  }
  return 'Pending_AI';
}

/**
 * Called at upload time. The client only reads the seal, so we never trust it.
 * A claim of "seal is broken" is taken at once, because there is nothing to gain
 * by keeping a known bad file. A claim of "seal is fine" stays unverified until
 * the server checks the manifest itself.
 */
export function statusFromClientClaim(input: {
  c2paClaimedValid: boolean;
  gpsDriftMeters?: number | null;
}): VeriStatus {
  if (!input.c2paClaimedValid) return 'Failed_C2PA';
  return statusFromVerifiedSeal({
    c2paValid: true,
    gpsDriftMeters: input.gpsDriftMeters ?? null,
  });
}
