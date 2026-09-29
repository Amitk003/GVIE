import { z } from 'zod';

const gpsValue = z.union([z.number(), z.string()]).nullish();

export const cloudinaryWebhookSchema = z.object({
  notification_type: z.string().min(1),
  timestamp: z.union([z.number(), z.string()]),
  signature: z.string().optional(),
  public_id: z.string().min(1),
  resource_type: z.string().min(1),
  type: z.string().optional(),
  created_at: z.string().optional(),
  folder: z.string().optional(),
  bytes: z.number().optional(),
  format: z.string().optional(),
  secure_url: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  image_metadata: z
    .object({
      GPSLatitude: gpsValue,
      GPSLongitude: gpsValue,
      GPSLatitudeRef: z.string().nullish(),
      GPSLongitudeRef: z.string().nullish(),
    })
    .partial()
    .nullish(),
});

export type CloudinaryWebhookBody = z.infer<typeof cloudinaryWebhookSchema>;

export type ParsedUploadEvent = {
  notificationType: string;
  publicId: string;
  resourceType: string;
  folder: string | null;
  createdAt: string | null;
  secureUrl: string | null;
  metadata: {
    proj_id: string | null;
    veri_status: string | null;
    tempo_phase: string | null;
    base_asset_id: string | null;
    geo_coords: string | null;
  };
  sha256: string | null;
  c2paClaimed: boolean | null;
  exifGps: { lat: number; long: number } | null;
};

function readText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function readContextValue(context: CloudinaryWebhookBody['context'], key: string): string | null {
  if (!context) return null;
  const direct = readText(context[key]);
  if (direct) return direct;
  const custom = context.custom;
  if (custom && typeof custom === 'object' && !Array.isArray(custom)) {
    return readText((custom as Record<string, unknown>)[key]);
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function parseUploadEvent(body: CloudinaryWebhookBody): ParsedUploadEvent {
  const meta = body.metadata ?? {};
  const lat = toNumber(body.image_metadata?.GPSLatitude);
  const long = toNumber(body.image_metadata?.GPSLongitude);
  const latRef = body.image_metadata?.GPSLatitudeRef;
  const longRef = body.image_metadata?.GPSLongitudeRef;

  const signedLat = lat !== null && latRef === 'S' ? -Math.abs(lat) : lat;
  const signedLong = long !== null && longRef === 'W' ? -Math.abs(long) : long;

  const c2paText = readContextValue(body.context, 'c2pa_claimed');

  return {
    notificationType: body.notification_type,
    publicId: body.public_id,
    resourceType: body.resource_type,
    folder: body.folder ?? null,
    createdAt: body.created_at ?? null,
    secureUrl: body.secure_url ?? null,
    metadata: {
      proj_id: readText(meta.proj_id),
      veri_status: readText(meta.veri_status),
      tempo_phase: readText(meta.tempo_phase),
      base_asset_id: readText(meta.base_asset_id),
      geo_coords: readText(meta.geo_coords),
    },
    sha256: readContextValue(body.context, 'sha256'),
    c2paClaimed: c2paText === null ? null : c2paText === 'true',
    exifGps:
      signedLat !== null && signedLong !== null ? { lat: signedLat, long: signedLong } : null,
  };
}

export function parseGeoCoords(text: string | null): { lat: number; long: number } | null {
  if (!text) return null;
  const parts = text.split(',');
  if (parts.length !== 2) return null;
  const lat = Number.parseFloat(parts[0].trim());
  const long = Number.parseFloat(parts[1].trim());
  if (!Number.isFinite(lat) || !Number.isFinite(long)) return null;
  if (lat < -90 || lat > 90 || long < -180 || long > 180) return null;
  return { lat, long };
}

export function planJobsFromEvent(
  event: ParsedUploadEvent,
): ('baseline_lookup' | 'align' | 'telemetry' | 'index')[] {
  if (event.resourceType !== 'image') return ['index'];
  if (event.metadata.tempo_phase === 'Outcome_After') {
    return ['baseline_lookup', 'align', 'telemetry', 'index'];
  }
  return ['telemetry', 'index'];
}
