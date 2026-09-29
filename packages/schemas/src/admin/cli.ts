#!/usr/bin/env node
/**
 * Set up a Cloudinary account for GVIE.
 *
 * Plain words: this makes the ten metadata fields and the three value lists that
 * the whole system depends on. Run it once for a new account. Running it again
 * is safe, it will simply say what is already there.
 *
 *   npm run metadata:apply -- --dry-run
 *   npm run metadata:apply --
 */

import { applyPlan, createAdminClient } from './admin-client.js';
import { buildPlan, summarizePlan } from './setup-metadata.js';

const USAGE = `usage: npm run metadata:apply -- [--dry-run]

needs these in .env:
  CLOUDINARY_CLOUD_NAME
  CLOUDINARY_API_KEY
  CLOUDINARY_API_SECRET

flags:
  --dry-run   show what would happen, change nothing
`;

function readEnv(): { cloudName: string; apiKey: string; apiSecret: string } {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME ?? '').trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY ?? '').trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET ?? '').trim();
  const missing = [
    ['CLOUDINARY_CLOUD_NAME', cloudName],
    ['CLOUDINARY_API_KEY', apiKey],
    ['CLOUDINARY_API_SECRET', apiSecret],
  ]
    .filter(([, value]) => value === '')
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`missing ${missing.join(', ')}`);
  }
  return { cloudName, apiKey, apiSecret };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(USAGE);
    return;
  }
  const dryRun = args.includes('--dry-run');

  const env = readEnv();
  const client = createAdminClient(env);
  const plan = buildPlan({
    existingFields: await client.listFields(),
    existingDatasources: await client.listDatasources(),
  });

  const summary = summarizePlan(plan);
  for (const line of summary.lines) process.stdout.write(`${line}\n`);

  if (dryRun) {
    process.stdout.write(`\ndry run, nothing was changed. ${summary.create} would be made.\n`);
    return;
  }

  const result = await applyPlan(plan, client, (line) => process.stdout.write(`${line}\n`));
  process.stdout.write(`\ndone. ${result.created} made, ${result.skipped} already there.\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`metadata setup failed: ${message}\n`);
  process.stderr.write(`\n${USAGE}`);
  process.exitCode = 1;
});
