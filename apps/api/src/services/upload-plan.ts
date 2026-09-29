import { z } from 'zod';
import {
  geoCoordsSchema,
  projectIdSchema,
  publicIdSchema,
  sha256Schema,
  tempoPhaseSchema,
} from '@gvie/schemas';
import { defaultMetadataForUpload, type AssetMetadata } from '@gvie/schemas';
import type { ApiConfig } from '../config.js';
import { assetFolder } from '../config.js';
import { statusFromTrust } from './trust.js';

export const uploadSignInputSchema = z.object({
  proj_id: projectIdSchema,
  tempo_phase: tempoPhaseSchema,
  geo_coords: geoCoordsSchema,
  c2pa_valid: z.boolean(),
  sha256: sha256Schema,
  base_asset_id: publicIdSchema.nullish(),
  public_id: publicIdSchema.optional(),
  gps_drift_meters: z.number().min(0).nullish(),
  client_captured_at: z.string().datetime().optional(),
});

export type UploadSignInput = z.infer<typeof uploadSignInputSchema>;

export type UploadPlan = {
  publicId: string;
  folder: string;
  metadata: AssetMetadata;
  params: Record<string, string>;
};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

export function encodeMetadataParam(metadata: AssetMetadata): string {
  const pairs: string[] = [
    `proj_id=${metadata.proj_id}`,
    `veri_status=${metadata.veri_status}`,
    `c2pa_valid=${metadata.c2pa_valid ? 'true' : 'false'}`,
    `geo_coords=${metadata.geo_coords}`,
    `tempo_phase=${metadata.tempo_phase}`,
  ];
  if (metadata.base_asset_id) pairs.push(`base_asset_id=${metadata.base_asset_id}`);
  return pairs.join('|');
}

export function buildUploadPlan(input: {
  config: Pick<ApiConfig, 'CLOUDINARY_UPLOAD_PRESET' | 'CLOUDINARY_FOLDER_ROOT'>;
  payload: UploadSignInput;
  now?: Date;
}): UploadPlan {
  const { config, payload } = input;
  const now = input.now ?? new Date();
  const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const baseId = payload.base_asset_id ? `_base` : '';
  const publicId =
    payload.public_id ??
    `${slugify(payload.proj_id)}_${stamp}_${payload.sha256.slice(0, 12)}${baseId}`;
  const folder = assetFolder(config, payload.proj_id);

  const metadata = defaultMetadataForUpload({
    proj_id: payload.proj_id,
    geo_coords: payload.geo_coords,
    tempo_phase: payload.tempo_phase,
    base_asset_id: payload.base_asset_id ?? null,
  });
  metadata.veri_status = statusFromTrust({
    c2paValid: payload.c2pa_valid,
    gpsDriftMeters: payload.gps_drift_meters ?? null,
  });

  const params: Record<string, string> = {
    public_id: publicId,
    folder,
    upload_preset: config.CLOUDINARY_UPLOAD_PRESET,
    metadata: encodeMetadataParam(metadata),
  };
  if (payload.client_captured_at) {
    params.context = `captured_at=${payload.client_captured_at}|sha256=${payload.sha256}`;
  } else {
    params.context = `sha256=${payload.sha256}`;
  }

  return { publicId, folder, metadata, params };
}
