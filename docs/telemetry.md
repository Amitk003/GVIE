# Telemetry

This worker reads numbers out of a photo and writes them back to Cloudinary.

It lives in `services/telemetry`. Ordinary AI tagging gives you words like "tree"
or "good condition". This one only accepts typed numbers that match a fixed
schema, so a report can be built from them.

## Steps in plain words

1. Ask Cloudinary Analyze API v2 to read the photo, with a sector schema
2. Check the answer against the same schema again on our side
3. Map the answer onto our ten metadata fields
4. Decide the status: Verified, or keep it Pending_AI
5. Write only the fields we are sure about back to Cloudinary

## Sectors and what we expect

| Sector | Required fields |
|---|---|
| water | `infrastructure_category`, `operational_status`, `quantitative_unit_count`, `hazard_present`, `confidence_rating` |
| forest | `infrastructure_category`, `canopy_cover_pct`, `sapling_count`, `ndvi_delta`, `hazard_present`, `confidence_rating` |
| solar | `infrastructure_category`, `panel_count`, `soiling_score`, `tilt_anomaly`, `operational_status`, `confidence_rating` |

Every schema sets `additionalProperties` to false, so the AI cannot add fields we
do not know about.

## Rules that protect the data

* A wrong shape never reaches Cloudinary. The worker stops at the validate step.
* An empty answer is left empty. We never overwrite good data with a blank.
* A 429 or a 5xx is retried. A 400 or a 401 is not, because retrying will not help.
* The worker never sets `c2pa_valid`. Only the server seal check may do that.
* A file becomes `Verified` only when all of these are true: the seal passed, the
  status was `Pending_AI`, confidence is 0.6 or more, clarity is 0.4 or more, and
  an after photo has a baseline link.
* The raw answer is kept for the audit log when validation fails, so a person can
  see what the AI actually said.

## How to run one job by hand

```bash
npm run dev --workspace @gvie/telemetry -- gvie/WATER-01/after_1 water WATER-01 Outcome_After gvie/WATER-01/before_1 true 0.8
```

The last two values are the seal result and the clarity score. The worker prints
one line of JSON. A non zero exit code means it stopped and wrote nothing.

## Files

| File | Job |
|---|---|
| `src/config.ts` env keys, timeouts, attempt limit |
| `src/sector.ts` reads the sector name, refuses unknown ones |
| `src/analyze-client.ts` calls Analyze API, retries only what is worth retrying |
| `src/validate.ts` checks the answer, maps it to fields, decides the status |
| `src/admin-client.ts` writes the clean fields back |
| `src/worker.ts` runs one job end to end |
| `src/index.ts` command line entry |

## Tests

`npx --workspace @gvie/telemetry vitest run`

No test touches the network. A fake fetch stands in for Cloudinary, so we can
test a good answer, a broken answer, a busy server, and a refused write without
spending a single credit.

## Settings you can change

| Name | Default | What it does |
|---|---|---|
| `TELEMETRY_MAX_ATTEMPTS` | 2 | how many times we call the AI |
| `TELEMETRY_TIMEOUT_MS` | 30000 | how long we wait for a reply |
| `TELEMETRY_AUDIT_FOLDER` | gvie/audit | where raw answers are stored |

