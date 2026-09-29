import { describe, expect, it } from 'vitest';
import {
  cloudinaryWebhookSchema,
  parseGeoCoords,
  parseUploadEvent,
  planJobsFromEvent,
} from './webhook-event.js';

const rawUpload = {
  notification_type: 'upload',
  timestamp: 1720000000,
  signature: 'abc',
  public_id: 'gvie/WATER-01/water_001',
  resource_type: 'image',
  created_at: '2026-09-29T10:20:30Z',
  folder: 'gvie/WATER-01',
  secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/gvie/WATER-01/water_001.jpg',
  metadata: {
    proj_id: 'WATER-01',
    veri_status: 'Pending_AI',
    tempo_phase: 'Outcome_After',
    base_asset_id: 'gvie/WATER-01/water_000',
    geo_coords: '12.97, 77.59',
  },
  context: { custom: { sha256: 'b'.repeat(64), c2pa_claimed: 'true' } },
  image_metadata: { GPSLatitude: 12.97, GPSLongitude: 77.59 },
};

describe('webhook parse', () => {
  it('reads metadata and context', () => {
    const body = cloudinaryWebhookSchema.parse(rawUpload);
    const event = parseUploadEvent(body);
    expect(event.publicId).toBe('gvie/WATER-01/water_001');
    expect(event.metadata.tempo_phase).toBe('Outcome_After');
    expect(event.metadata.base_asset_id).toBe('gvie/WATER-01/water_000');
    expect(event.sha256).toBe('b'.repeat(64));
    expect(event.c2paClaimed).toBe(true);
    expect(event.exifGps).toEqual({ lat: 12.97, long: 77.59 });
  });

  it('reads flat context values too', () => {
    const body = cloudinaryWebhookSchema.parse({
      ...rawUpload,
      context: { sha256: 'c'.repeat(64), c2pa_claimed: 'false' },
    });
    const event = parseUploadEvent(body);
    expect(event.sha256).toBe('c'.repeat(64));
    expect(event.c2paClaimed).toBe(false);
  });

  it('applies south and west refs', () => {
    const body = cloudinaryWebhookSchema.parse({
      ...rawUpload,
      image_metadata: {
        GPSLatitude: 12.97,
        GPSLongitude: 77.59,
        GPSLatitudeRef: 'S',
        GPSLongitudeRef: 'W',
      },
    });
    const event = parseUploadEvent(body);
    expect(event.exifGps).toEqual({ lat: -12.97, long: -77.59 });
  });

  it('gives nulls when fields are absent', () => {
    const body = cloudinaryWebhookSchema.parse({
      notification_type: 'upload',
      timestamp: 1,
      public_id: 'a',
      resource_type: 'image',
    });
    const event = parseUploadEvent(body);
    expect(event.metadata.proj_id).toBeNull();
    expect(event.sha256).toBeNull();
    expect(event.c2paClaimed).toBeNull();
    expect(event.exifGps).toBeNull();
  });

  it('rejects a body without public id', () => {
    const out = cloudinaryWebhookSchema.safeParse({ notification_type: 'upload', timestamp: 1 });
    expect(out.success).toBe(false);
  });
});

describe('geo coords text', () => {
  it('parses a normal pair', () => {
    expect(parseGeoCoords('12.97, 77.59')).toEqual({ lat: 12.97, long: 77.59 });
  });

  it('parses negative values', () => {
    expect(parseGeoCoords('-12.97,-77.59')).toEqual({ lat: -12.97, long: -77.59 });
  });

  it('rejects junk', () => {
    expect(parseGeoCoords('north, south')).toBeNull();
    expect(parseGeoCoords('12.97')).toBeNull();
    expect(parseGeoCoords(null)).toBeNull();
  });

  it('rejects out of range values', () => {
    expect(parseGeoCoords('120.0, 77.59')).toBeNull();
    expect(parseGeoCoords('12.97, 200.0')).toBeNull();
  });
});

describe('job plan', () => {
  it('adds align steps for an after photo', () => {
    const body = cloudinaryWebhookSchema.parse(rawUpload);
    expect(planJobsFromEvent(parseUploadEvent(body))).toEqual([
      'baseline_lookup',
      'align',
      'telemetry',
      'index',
    ]);
  });

  it('skips align for a baseline photo', () => {
    const body = cloudinaryWebhookSchema.parse({
      ...rawUpload,
      metadata: { ...rawUpload.metadata, tempo_phase: 'Baseline_Before', base_asset_id: null },
    });
    expect(planJobsFromEvent(parseUploadEvent(body))).toEqual(['telemetry', 'index']);
  });

  it('only indexes video for now', () => {
    const body = cloudinaryWebhookSchema.parse({ ...rawUpload, resource_type: 'video' });
    expect(planJobsFromEvent(parseUploadEvent(body))).toEqual(['index']);
  });
});
