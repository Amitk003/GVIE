# Setup and running

## One time setup for a new Cloudinary account

### 1. Fill in the keys

Copy `.env.example` to `.env` and fill in:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_WEBHOOK_SECRET` (make this up yourself, keep it out of git)

### 2. Make the metadata fields

This is the step people forget. The whole system has nowhere to put its numbers
until these ten fields and three value lists exist in the account.

```bash
npm run metadata:apply --workspace @gvie/schemas -- --dry-run
```

Read the plan. It lists what would be made and what is already there. Then:

```bash
npm run metadata:apply --workspace @gvie/schemas
```

Running it twice is safe. Anything already there is kept, and the script says so.
If the keys are missing it stops with a clear list and changes nothing.

### 3. Make a signed upload preset in the Cloudinary console

- turn off unsigned uploading
- turn on returning the EXIF data
- copy the preset name into `CLOUDINARY_UPLOAD_PRESET`

## The ten fields it makes

| Field            | Type    | Rule                                                |
| ---------------- | ------- | --------------------------------------------------- |
| `proj_id`        | list    | which project owns the file                         |
| `veri_status`    | list    | Verified, Pending_AI, Flagged_Location, Failed_C2PA |
| `c2pa_valid`     | boolean | only the server seal check may set it true          |
| `geo_coords`     | text    | must look like a real place, `12.97, 77.59`         |
| `tempo_phase`    | list    | Baseline_Before, Interim_Work, Outcome_After        |
| `base_asset_id`  | text    | up to 255 characters                                |
| `ndvi_delta`     | number  | between minus one and one                           |
| `obj_count`      | number  | zero or more                                        |
| `iqa_score`      | number  | between zero and one                                |
| `impact_summary` | text    | up to 1000 characters                               |

Those rules are the point. A pin that is not a place, or a plant change of 5, is
refused at the door instead of quietly entering a donor report.

## The container image for the align service

`services/align/Dockerfile` builds the align service for Lambda. It uses a slim
Debian base and the headless build of OpenCV, because a server does not need a
window system.

```bash
docker build -t gvie-align -f services/align/Dockerfile services/align
```

## Checks that run on every pull request

`.github/workflows/checks.yml` runs three jobs:

- **typescript tests and types**: all workspace tests, then a type check for the
  api, the web app, the telemetry worker, and both shared packages
- **python align tests**: installs the dev requirements and runs pytest
- **lint and format**: eslint with zero warnings allowed, then a prettier check

Run them yourself with:

```bash
npm run test --workspaces --if-present
npm run lint
npm run format:check
cd services/align && python -m pytest
```

## Envs and deploys

dev, staging and prod are separate Cloudinary product envs and separate AWS
accounts. Never point a dev build at a prod account.

- Web on Vercel or Amplify
- API on Fargate or EC2
- Align on Lambda with the container image above
- Telemetry worker on a queue

## Watch

- time from upload to indexed
- time to align, time to read numbers, time to search
- webhook failures, queue growth, how often an answer fails the schema
- keep a dead letter queue and a replay button

## Cost

- watch Analyze calls, transform counts, and bandwidth
- archive raw files after one year, keep the aligned copies and the reels

## If something goes wrong

| What you see                                    | What it means                                        | What to do                                |
| ----------------------------------------------- | ---------------------------------------------------- | ----------------------------------------- |
| `metadata setup failed: missing CLOUDINARY_...` | keys are not in `.env`                               | fill them in and run again                |
| webhook answers `401`                           | the secret does not match                            | check `CLOUDINARY_WEBHOOK_SECRET`         |
| webhook answers `500` mentioning the secret     | the secret is not set at all                         | set it, the route fails closed on purpose |
| align answers `skipped`                         | not enough shared points, or the view moved too much | take a closer photo from a similar spot   |
| `could not reach the api` in the browser        | the API is not running                               | start it, the phone is offline            |
| every status stays `Pending_AI`                 | the worker has not run, or a gate is not met         | check the confidence and clarity scores   |
