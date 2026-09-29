import { describe, expect, it } from 'vitest';
import { prepareCapture, badgeForSeal, gpsDriftMeters, haversineMeters } from './capture.js';

function bytesWith(text: string): ArrayBuffer {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i);
  return out.buffer;
}

const goodInput = {
  file: bytesWith('c2pa manifest with certs'),
  projId: 'WATER-01',
  tempoPhase: 'Outcome_After' as const,
  geoCoords: '12.97, 77.59',
};

describe('distance helpers', () => {
  it('is zero for the same point', () => {
    expect(haversineMeters({ lat: 1, long: 1 }, { lat: 1, long: 1 })).toBe(0);
  });

  it('measures about 111 metres per degree of longitude at the equator', () => {
    const meters = haversineMeters({ lat: 0, long: 0 }, { lat: 0, long: 1 });
    expect(meters).toBeGreaterThan(110000);
    expect(meters).toBeLessThan(112000);
  });

  it('gives null when one side is missing', () => {
    expect(gpsDriftMeters({ lat: 1, long: 1 }, null)).toBeNull();
    expect(gpsDriftMeters(null, null)).toBeNull();
  });

  it('finds a small drift', () => {
    const drift = gpsDriftMeters({ lat: 12.97, long: 77.59 }, { lat: 12.9705, long: 77.5905 });
    expect(drift).not.toBeNull();
    expect(drift as number).toBeLessThan(200);
  });
});

describe('seal claim', () => {
  it('accepts a file with a manifest and a certificate', async () => {
    const result = await prepareCapture(goodInput);
    expect(result.ok).toBe(true);
    expect(result.seal?.c2pa_valid).toBe(true);
  });

  it('refuses a file with no manifest', async () => {
    const result = await prepareCapture({ ...goodInput, file: bytesWith('just a photo') });
    expect(result.ok).toBe(true);
    expect(result.seal?.c2pa_valid).toBe(false);
  });

  it('refuses a manifest with no certificate', async () => {
    const result = await prepareCapture({ ...goodInput, file: bytesWith('c2pa jumb only') });
    expect(result.seal?.c2pa_valid).toBe(false);
  });

  it('refuses an expired certificate', async () => {
    const result = await prepareCapture({
      ...goodInput,
      file: bytesWith('c2pa certs expiry   20200101'),
    });
    expect(result.seal?.c2pa_valid).toBe(false);
    expect(result.seal?.reason).toContain('expired');
  });

  it('accepts a certificate that has not expired', async () => {
    const result = await prepareCapture({
      ...goodInput,
      file: bytesWith('c2pa certs expiry   20990101'),
    });
    expect(result.seal?.c2pa_valid).toBe(true);
  });
});

describe('prepare capture', () => {
  it('builds a body with the hash and the claim', async () => {
    const result = await prepareCapture(goodInput);
    expect(result.body).not.toBeNull();
    expect(String(result.body?.sha256)).toMatch(/^[a-f0-9]{64}$/);
    expect(result.body?.c2pa_valid).toBe(true);
    expect(result.body?.geo_coords).toBe('12.97, 77.59');
  });

  it('sends the baseline link when there is one', async () => {
    const result = await prepareCapture({
      ...goodInput,
      baseAssetId: 'gvie/WATER-01/before_1',
    });
    expect(result.body?.base_asset_id).toBe('gvie/WATER-01/before_1');
  });

  it('sends the capture time when given', async () => {
    const result = await prepareCapture({
      ...goodInput,
      clientCapturedAt: '2026-09-29T10:00:00.000Z',
    });
    expect(result.body?.client_captured_at).toBe('2026-09-29T10:00:00.000Z');
  });

  it('refuses without a project', async () => {
    const result = await prepareCapture({ ...goodInput, projId: '' });
    expect(result.ok).toBe(false);
    expect(result.body).toBeNull();
    expect(result.errors.join(' ')).toContain('project');
  });

  it('refuses without a place', async () => {
    const result = await prepareCapture({ ...goodInput, geoCoords: null });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('place');
  });

  it('warns when the pins are far apart', async () => {
    const result = await prepareCapture({
      ...goodInput,
      exifGps: { lat: 12.97, long: 77.59 },
      ipGps: { lat: 13.5, long: 78.5 },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('far apart');
  });

  it('sends the drift when the pins are close', async () => {
    const result = await prepareCapture({
      ...goodInput,
      exifGps: { lat: 12.97, long: 77.59 },
      ipGps: { lat: 12.9701, long: 77.5901 },
    });
    expect(result.ok).toBe(true);
    expect(result.body?.gps_drift_meters).toBeLessThan(500);
  });
});

describe('trust badge', () => {
  it('never promises verified', async () => {
    const result = await prepareCapture(goodInput);
    const badge = badgeForSeal(result.seal);
    expect(badge.label).not.toContain('Verified');
    expect(badge.tone).toBe('good');
  });

  it('warns when the file could not be read', () => {
    expect(badgeForSeal(null).tone).toBe('warn');
  });

  it('is red when there is no valid seal', async () => {
    const result = await prepareCapture({ ...goodInput, file: bytesWith('plain photo') });
    expect(badgeForSeal(result.seal).tone).toBe('bad');
  });
});
