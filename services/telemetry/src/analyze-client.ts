/**
 * Call Cloudinary Analyze API and hand back whatever came back, valid or not.
 *
 * We do not clean anything here. Cleaning happens in validate.ts so that a bad
 * answer can never reach the database.
 */

import type { SectorName } from '@gvie/schemas';
import { jsonSchemaBySector, sectorPromptBySector } from '@gvie/schemas';
import { analyzeUrl, assetUrl, basicAuthHeader, type TelemetryConfig } from './config.js';

export type AnalyzeCallInput = {
  config: TelemetryConfig;
  publicId: string;
  sector: SectorName;
  fetchImpl?: typeof fetch;
};

export type AnalyzeResult =
  | { ok: true; raw: unknown; attempts: number }
  | { ok: false; reason: string; status: number | null; attempts: number };

export function buildAnalyzeBody(input: {
  sector: SectorName;
  imageUrl: string;
  extraInstruction?: string;
}): Record<string, unknown> {
  const prompt = sectorPromptBySector[input.sector];
  return {
    source: { uri: input.imageUrl },
    prompts: input.extraInstruction ? [prompt, input.extraInstruction] : [prompt],
    json_schema: jsonSchemaBySector[input.sector],
  };
}

export async function callAnalyze(input: AnalyzeCallInput): Promise<AnalyzeResult> {
  const doFetch = input.fetchImpl ?? fetch;
  const { config, publicId, sector } = input;
  const url = analyzeUrl(config.CLOUDINARY_CLOUD_NAME);

  let lastStatus: number | null = null;
  let lastReason = 'no attempt was made';

  for (let attempt = 1; attempt <= config.TELEMETRY_MAX_ATTEMPTS; attempt += 1) {
    const body = buildAnalyzeBody({ sector, imageUrl: assetUrl(config.CLOUDINARY_CLOUD_NAME, publicId) });
    try {
      const response = await doFetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: basicAuthHeader(
            config.CLOUDINARY_API_KEY,
            config.CLOUDINARY_API_SECRET,
          ),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.TELEMETRY_TIMEOUT_MS),
      });
      lastStatus = response.status;
      if (!response.ok) {
        lastReason = `analyze call returned ${response.status}`;
        if (!isWorthRetrying(response.status)) {
          return { ok: false, reason: lastReason, status: response.status, attempts: attempt };
        }
        continue;
      }
      const raw: unknown = await response.json();
      return { ok: true, raw, attempts: attempt };
    } catch (error) {
      lastStatus = null;
      lastReason = error instanceof Error ? error.message : 'network error';
    }
  }

  return { ok: false, reason: lastReason, status: lastStatus, attempts: config.TELEMETRY_MAX_ATTEMPTS };
}

/**
 * A bad prompt or a bad key will not fix itself. A busy server or a timeout might.
 */
export function isWorthRetrying(status: number): boolean {
  if (status === 429) return true;
  if (status >= 500) return true;
  return false;
}
