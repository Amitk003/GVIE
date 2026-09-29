import { describe, expect, it } from 'vitest';
import {
  GPS_DRIFT_LIMIT_M,
  MIN_CONFIDENCE_FOR_VERIFIED,
  canPromoteToVerified,
  statusFromClientClaim,
  statusFromVerifiedSeal,
} from './verification.js';

describe('seal status from the server check', () => {
  it('fails closed when the seal is bad', () => {
    expect(statusFromVerifiedSeal({ c2paValid: false })).toBe('Failed_C2PA');
  });

  it('flags far gps drift', () => {
    expect(statusFromVerifiedSeal({ c2paValid: true, gpsDriftMeters: 900 })).toBe(
      'Flagged_Location',
    );
  });

  it('keeps pending when trust looks fine', () => {
    expect(statusFromVerifiedSeal({ c2paValid: true, gpsDriftMeters: 30 })).toBe('Pending_AI');
    expect(statusFromVerifiedSeal({ c2paValid: true })).toBe('Pending_AI');
  });

  it('treats the drift limit as inside range', () => {
    expect(statusFromVerifiedSeal({ c2paValid: true, gpsDriftMeters: GPS_DRIFT_LIMIT_M })).toBe(
      'Pending_AI',
    );
  });
});

describe('seal status from the client claim', () => {
  it('takes a reported broken seal at once', () => {
    expect(statusFromClientClaim({ c2paClaimedValid: false })).toBe('Failed_C2PA');
  });

  it('keeps a good claim pending until the server checks', () => {
    expect(statusFromClientClaim({ c2paClaimedValid: true })).toBe('Pending_AI');
  });

  it('still flags far gps drift', () => {
    expect(statusFromClientClaim({ c2paClaimedValid: true, gpsDriftMeters: 800 })).toBe(
      'Flagged_Location',
    );
  });
});

describe('promotion to verified', () => {
  const good = { status: 'Pending_AI' as const, c2paValid: true, confidence: 0.9 };

  it('allows a clean high confidence asset', () => {
    expect(canPromoteToVerified(good)).toBe(true);
  });

  it('blocks low confidence', () => {
    expect(canPromoteToVerified({ ...good, confidence: 0.4 })).toBe(false);
  });

  it('blocks right at the confidence edge', () => {
    expect(canPromoteToVerified({ ...good, confidence: MIN_CONFIDENCE_FOR_VERIFIED - 0.01 })).toBe(
      false,
    );
    expect(canPromoteToVerified({ ...good, confidence: MIN_CONFIDENCE_FOR_VERIFIED })).toBe(true);
  });

  it('blocks blurry photos', () => {
    expect(canPromoteToVerified({ ...good, iqaScore: 0.2 })).toBe(false);
  });

  it('blocks flagged and failed assets', () => {
    expect(canPromoteToVerified({ ...good, status: 'Flagged_Location' })).toBe(false);
    expect(canPromoteToVerified({ ...good, status: 'Failed_C2PA' })).toBe(false);
  });

  it('blocks when the seal check failed', () => {
    expect(canPromoteToVerified({ ...good, c2paValid: false })).toBe(false);
  });

  it('blocks an after photo with no baseline link', () => {
    expect(canPromoteToVerified({ ...good, tempoPhase: 'Outcome_After', baseAssetId: null })).toBe(
      false,
    );
    expect(
      canPromoteToVerified({ ...good, tempoPhase: 'Outcome_After', baseAssetId: 'gvie/a/b' }),
    ).toBe(true);
  });
});
