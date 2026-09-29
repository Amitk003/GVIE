/**
 * Write the clean numbers back to Cloudinary.
 *
 * Only fields that passed the schema are sent. Anything the AI did not answer
 * stays empty rather than being filled with a guess.
 */

import type { TelemetryConfig } from './config.js';
import { basicAuthHeader } from './config.js';
import type { MappedTelemetry } from './validate.js';

export type CurrentMetadata = {
  proj_id: string;
  veri_status: string;
  c2pa_valid: boolean;
  tempo_phase: string;
  base_asset_id: string | null;
  iqa_score: number | null;
};

export type MetadataPatch = {
  obj_count: number | null;
  ndvi_delta: number | null;
  impact_summary: string;
  veri_status: string;
};

export function buildMetadataPatch(input: {
  mapped: MappedTelemetry;
  nextStatus: string;
}): MetadataPatch {
  return {
    obj_count: input.mapped.obj_count,
    ndvi_delta: input.mapped.ndvi_delta,
    impact_summary: input.mapped.impact_summary,
    veri_status: input.nextStatus,
  };
}

export type AdminWriteResult = { ok: true } | { ok: false; reason: string; status: number };

export async function writeMetadata(input: {
  config: TelemetryConfig;
  publicId: string;
  patch: MetadataPatch;
  fetchImpl?: typeof fetch;
}): Promise<AdminWriteResult> {
  const doFetch = input.fetchImpl ?? fetch;
  const { config, publicId, patch } = input;
  const url = `https://api.cloudinary.com/v1_1/${config.CLOUDINARY_CLOUD_NAME}/resources/image/upload/${publicId}`;

  const response = await doFetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: basicAuthHeader(config.CLOUDINARY_API_KEY, config.CLOUDINARY_API_SECRET),
    },
    body: JSON.stringify({
      metadata: toMetadataBody(patch),
      context: `ai_sector_written_at=${new Date().toISOString()}`,
    }),
    signal: AbortSignal.timeout(config.TELEMETRY_TIMEOUT_MS),
  });

  if (!response.ok) {
    return {
      ok: false,
      reason: `metadata write returned ${response.status}`,
      status: response.status,
    };
  }
  return { ok: true };
}

/**
 * Cloudinary wants a pipe separated string for structured metadata on upload.
 * Empty values are dropped so a missing answer does not overwrite good data.
 */
export function toMetadataBody(patch: MetadataPatch): string {
  const parts: string[] = [`veri_status=${patch.veri_status}`];
  if (patch.obj_count !== null) parts.push(`obj_count=${patch.obj_count}`);
  if (patch.ndvi_delta !== null) parts.push(`ndvi_delta=${patch.ndvi_delta}`);
  if (patch.impact_summary) parts.push(`impact_summary=${patch.impact_summary}`);
  return parts.join('|');
}
