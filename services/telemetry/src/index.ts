/**
 * Entry point for the telemetry worker.
 *
 * Today it runs one job from the command line, which is how we test it and how
 * we fix a single file by hand. The queue loop comes later and will call the same
 * runJob function, so the rules never change.
 */

import { readTelemetryConfig } from './config.js';
import { runJob, type Job } from './worker.js';
import type { CurrentMetadata } from './admin-client.js';
import { parseSector } from './sector.js';

const USAGE = `usage: npm run dev --workspace @gvie/telemetry -- <public_id> <sector> [proj_id] [tempo_phase] [base_asset_id] [c2pa_valid] [iqa_score]

example:
  npm run dev --workspace @gvie/telemetry -- gvie/WATER-01/after_1 water WATER-01 Outcome_After gvie/WATER-01/before_1 true 0.8
`;

export function buildJobFromArgs(args: string[], current: CurrentMetadata): Job | null {
  const [publicId, sectorText] = args;
  if (!publicId || !sectorText) return null;
  const sector = parseSector(sectorText);
  if (!sector) return null;
  return { publicId, sector, current };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help') {
    process.stdout.write(USAGE);
    return;
  }

  const config = readTelemetryConfig();
  const current: CurrentMetadata = {
    proj_id: args[2] ?? 'UNKNOWN',
    veri_status: 'Pending_AI',
    // The server verify step owns this field. The worker never sets it to true.
    c2pa_valid: (args[5] ?? 'false') === 'true',
    tempo_phase: args[3] ?? 'Baseline_Before',
    base_asset_id: args[4] ?? null,
    iqa_score: args[6] ? Number.parseFloat(args[6]) : null,
  };

  const job = buildJobFromArgs(args, current);
  if (!job) {
    process.stderr.write(USAGE);
    process.exitCode = 1;
    return;
  }

  const outcome = await runJob(job, { config });
  if (outcome.ok) {
    process.stdout.write(
      `${JSON.stringify({ ok: true, status: outcome.status, confidence: outcome.confidence })}\n`,
    );
    return;
  }
  process.stderr.write(`${JSON.stringify(outcome)}\n`);
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`telemetry worker failed: ${message}\n`);
  process.exitCode = 1;
});
