import { describe, expect, it } from 'vitest';
import {
  GPS_DRIFT_LIMIT_M,
  canPromoteToVerified,
  haversineMeters,
  statusFromTrust,
} from './trust.js';

describe('trust status', () => {
  it('fails closed when seal check fails', () => {
    expect(statusFromTrust({ c2paValid: false })).toBe('Failed_C2PA');
  });

  it('flags far gps drift', () => {
    expect(statusFromTrust({ c2paValid: true, gpsDriftMeters: 900 })).toBe('Flagged_Location');
  });

  it('keeps pending when trust looks fine', () => {
    expect(statusFromTrust({ c2paValid: true, gpsDriftMeters: 30 })).toBe('Pending_AI');
    expect(statusFromTrust({ c2paValid: true })).toBe('Pending_AI');
  });

  it('treats the drift limit as inside range', () => {
    expect(statusFromTrust({ c2paValid: true, gpsDriftMeters: GPS_DRIFT_LIMIT_M })).toBe(
      'Pending_AI',
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

  it('blocks blurry photos', () => {
    expect(canPromoteToVerified({ ...good, iqaScore: 0.2 })).toBe(false);
  });

  it('blocks flagged and failed assets', () => {
    expect(canPromoteToVerified({ ...good, status: 'Flagged_Location' })).toBe(false);
    expect(canPromoteToVerified({ ...good, status: 'Failed_C2PA' })).toBe(false);
  });

  it('blocks when seal check fails', () => {
    expect(canPromoteToVerified({ ...good, c2paValid: false })).toBe(false);
  });
});

describe('haversine', () => {
  it('measures zero for same point', () => {
    expect(haversineMeters({ lat: 12.97, long: 77.59 }, { lat: 12.97, long: 77.59 })).toBe(0);
  });

  it('measures a known short distance', () => {
    const meters = haversineMeters({ lat: 12.97, long: 77.59 }, { lat: 12.971, long: 77.59 });
    expect(meters).toBeGreaterThan(100);
    expect(meters).toBeLessThan(115);
  });

  it('measures a long distance', () => {
    const meters = haversineMeters({ lat: 0, long: 0 }, { lat: 0, long: 1 });
    expect(meters).toBeGreaterThan(110000);
    expect(meters).toBeLessThan(112000);
  });
});
