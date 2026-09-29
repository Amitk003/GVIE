# GeoVeri Impact Engine

**Proof you can trust. Every photo, every site, every number.**

GeoVeri Impact Engine (GVIE) helps teams prove real work on the ground. It takes field photos and videos, checks they are real, lines up before and after shots, reads numbers with AI, and builds ready donor reels. All inside one clean flow powered by Cloudinary.

## Why teams pick GVIE

- **Real proof, not claims.** Each file keeps its camera data, location, hash, and signature. If a file is edited or fake, the system flags it.
- **Before and after that line up.** Our vision service warps the new photo to match the old camera view, so change is clear even when staff stand in a new spot.
- **Numbers, not tags.** Instead of tags like tree or outdoor, you get typed facts: how many units, what status, what score, how sure the AI is.
- **Video in one click.** No editing app needed. GVIE joins clips with Cloudinary URLs into reels and wipes.
- **Search that works.** Find by project, place, date, status, or look alike images with plain words.

## How it works

1. Field staff capture media in the app. The app reads EXIF and checks the content signature, then uploads with a signed request.
2. Cloudinary stores the file and fires a webhook. We queue it so busy days never break limits.
3. If a baseline exists for that place and project, the align service matches points and warps the new image to the old frame.
4. The telemetry service asks Cloudinary Analyze API with a strict schema and writes clean fields back to structured metadata.
5. Dashboards, reports, and video reels read from one source of truth.

## What is inside this repo

- `apps/web` Next.js dashboard and field upload flow
- `apps/api` Fastify API for ingest, webhooks, search proxy, export
- `services/align` Python FastAPI microservice with OpenCV SIFT and homography
- `services/telemetry` Worker for Analyze API v2 with JSON schema checks
- `packages/schemas` Shared Zod and JSON schemas plus Cloudinary metadata DDL
- `packages/cloudinary` Signed upload, webhook verify, transform URL helpers
- `infra` Terraform for AWS plus Cloudinary setup scripts
- `docs` Simple guides for setup, design, API, and daily use

## Quick start

You need Node 20, Python 3.11, and a Cloudinary account.

```bash
# 1. copy env
cp .env.example .env

# 2. fill Cloudinary keys in .env
# CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

# 3. install and run
npm install
npm run dev
```

Open `http://localhost:3000` for the web app and `http://localhost:4000/docs` for the API docs.

## Core ideas in plain words

- `c2pa_valid` is false until the signature check passes. No pass, no Verified tag.
- `base_asset_id` links each after photo to its before photo.
- `veri_status` controls what donors see: Verified, Pending_AI, Flagged_Location, Failed_C2PA.
- `ndvi_delta`, `obj_count`, `iqa_score` hold the measured change, count, and clarity.
- All AI output must match a fixed schema or it is retried, never saved raw.

## Docs

Start with `docs/README.md`, then `docs/setup.md`, `docs/architecture.md`, and `docs/api.md`.

## Status

Active build. See `docs/roadmap.md` for what is live and what is next.

## License

MIT. See `LICENSE`.
