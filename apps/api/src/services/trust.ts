import {
  GPS_DRIFT_LIMIT_M,
  MIN_CONFIDENCE_FOR_VERIFIED,
  canPromoteToVerified,
  statusFromClientClaim,
  statusFromVerifiedSeal,
  type VeriStatus,
} from '@gvie/schemas';
import { haversineMeters } from './geo.js';

export { GPS_DRIFT_LIMIT_M, MIN_CONFIDENCE_FOR_VERIFIED, canPromoteToVerified, haversineMeters };

export type TrustInput = {
  c2paValid: boolean;
  gpsDriftMeters?: number | null;
};

/**
 * Used when the server itself has verified the seal. The rule now lives in the
 * shared schemas package, so the API and the telemetry worker cannot disagree
 * about what Verified means.
 */
export function statusFromTrust(input: TrustInput): VeriStatus {
  return statusFromVerifiedSeal(input);
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
  return statusFromClientClaim(input);
}
