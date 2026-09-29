/**
 * The worker that turns one job into clean metadata.
 *
 * Steps: call the AI, check the answer, map it onto our fields, decide the
 * status, then write. If any step fails we stop and say why. Nothing half done
 * is ever written.
 */

import { canPromoteToVerified, type SectorName } from '@gvie/schemas';
import { callAnalyze, type AnalyzeResult } from './analyze-client.js';
import { buildMetadataPatch, writeMetadata, type CurrentMetadata } from './admin-client.js';
import type { TelemetryConfig } from './config.js';
import { mapTelemetryToFields, nextVeriStatus, validateTelemetry } from './validate.js';

export type Job = {
  publicId: string;
  sector: SectorName;
  current: CurrentMetadata;
};

export type JobOutcome =
  | { ok: true; status: string; fieldsWritten: string[]; confidence: number; needsHuman: boolean }
  | { ok: false; reason: string; stage: 'analyze' | 'validate' | 'write' };

export type WorkerDeps = {
  config: TelemetryConfig;
  fetchImpl?: typeof fetch;
};

export async function runJob(job: Job, deps: WorkerDeps): Promise<JobOutcome> {
  const analyzed = await callAnalyze({
    config: deps.config,
    publicId: job.publicId,
    sector: job.sector,
    fetchImpl: deps.fetchImpl,
  });
  if (!analyzed.ok) {
    return { ok: false, stage: 'analyze', reason: analyzeReason(analyzed) };
  }

  const validated = validateTelemetry({
    sector: job.sector,
    raw: (analyzed as { ok: true; raw: unknown }).raw,
  });
  if (!validated.ok) {
    return { ok: false, stage: 'validate', reason: validated.reason };
  }

  const canPromote = canPromoteToVerified({
    status: job.current.veri_status as never,
    c2paValid: job.current.c2pa_valid,
    confidence: validated.confidence,
    iqaScore: job.current.iqa_score,
    tempoPhase: job.current.tempo_phase,
    baseAssetId: job.current.base_asset_id,
  });
  const status = nextVeriStatus({ current: job.current.veri_status as never, canPromote });
  const mapped = mapTelemetryToFields({
    sector: job.sector,
    data: validated.data,
    confidence: validated.confidence,
  });

  const patch = buildMetadataPatch({ mapped, nextStatus: status });
  const written = await writeMetadata({
    config: deps.config,
    publicId: job.publicId,
    patch,
    fetchImpl: deps.fetchImpl,
  });
  if (!written.ok) {
    return { ok: false, stage: 'write', reason: written.reason };
  }

  return {
    ok: true,
    status,
    fieldsWritten: Object.keys(patch),
    confidence: validated.confidence,
    needsHuman: validated.needsHuman,
  };
}

function analyzeReason(result: AnalyzeResult & { ok: false }): string {
  return `${result.reason} after ${result.attempts} attempt(s)`;
}
