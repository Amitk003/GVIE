import { z } from 'zod';
import { geoCoordsSchema, projectIdSchema, publicIdSchema, tempoPhaseSchema } from './common.js';
import { veriStatusSchema } from './common.js';

export const assetMetadataSchema = z.object({
  proj_id: projectIdSchema,
  veri_status: veriStatusSchema,
  c2pa_valid: z.boolean(),
  geo_coords: geoCoordsSchema,
  tempo_phase: tempoPhaseSchema,
  base_asset_id: publicIdSchema.nullable().default(null),
  ndvi_delta: z.number().gt(-1).lt(1).nullable().default(null),
  obj_count: z.number().int().min(0).nullable().default(null),
  iqa_score: z.number().min(0).max(1).nullable().default(null),
  impact_summary: z.string().max(1000).default(''),
});

export type AssetMetadata = z.infer<typeof assetMetadataSchema>;

export function defaultMetadataForUpload(input: {
  proj_id: string;
  geo_coords: string;
  tempo_phase: z.infer<typeof tempoPhaseSchema>;
  base_asset_id?: string | null;
}): AssetMetadata {
  return assetMetadataSchema.parse({
    proj_id: input.proj_id,
    veri_status: 'Pending_AI',
    c2pa_valid: false,
    geo_coords: input.geo_coords,
    tempo_phase: input.tempo_phase,
    base_asset_id: input.base_asset_id ?? null,
    ndvi_delta: null,
    obj_count: null,
    iqa_score: null,
    impact_summary: '',
  });
}

export function canShowPublic(meta: Pick<AssetMetadata, 'veri_status' | 'c2pa_valid'>): boolean {
  if (meta.veri_status === 'Failed_C2PA') return false;
  if (meta.veri_status !== 'Verified') return false;
  return meta.c2pa_valid === true;
}

export function needsRecapture(meta: Pick<AssetMetadata, 'iqa_score'>): boolean {
  if (meta.iqa_score === null || meta.iqa_score === undefined) return false;
  return meta.iqa_score < 0.4;
}

export function needsBaselineLink(
  meta: Pick<AssetMetadata, 'tempo_phase' | 'base_asset_id'>,
): boolean {
  return meta.tempo_phase === 'Outcome_After' && !meta.base_asset_id;
}
