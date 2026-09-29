# Web app

This is the screen a field worker and a reviewer use. It lives in `apps/web`.

## Two screens

**Add proof of work** at `/`. The worker picks a photo, fills in the project and
the place, and presses send. Before anything leaves the phone we work out the
file hash, read the seal, and check the pin.

**Project proof** at `/projects/WATER-01`. A reviewer sees how many photos there
are, how many are checked, and how many still need a person.

## The rule that matters most

The browser must never say Verified. Only the server can, after it checks the
seal on its own. The badge on the field screen can say "Seal looks good" and it
still says underneath that our server will check it again. There is a test that
fails if anyone ever changes that wording.

## What the phone checks before sending

* the file hash, so the same file always has the same name
* the content manifest, so we can tell a real photo from an edited one
* the certificate inside the manifest, and whether it has expired
* the distance between the photo pin and the network pin, over 500 m is a warning

## What the phone does not do

* it does not hold Cloudinary keys, it asks our API for a signature
* it does not decide the status
* it does not talk to Cloudinary Admin

## How to run it

```bash
npm run dev --workspace @gvie/web
```

Then open http://localhost:3000. The API must be running on port 4000, or the
page tells you plainly that it could not reach it. That is on purpose: a
reviewer must never see a clean page that is quietly showing nothing.

## Tests

```bash
npx --workspace @gvie/web vitest run
```

Tests run in a fake browser made by jsdom. Nothing touches the network.

## Files

| File | Job |
|---|---|
| `src/lib/seal.ts` read the content manifest out of the file bytes |
| `src/lib/capture.ts` hash, seal, pin check, and the trust badge wording |
| `src/lib/api.ts` talk to our API, turn every failure into plain words |
| `src/components/CaptureForm.tsx` the field screen |
| `src/components/ProjectSummary.tsx` the reviewer screen |
| `src/components/AssetRow.tsx` one photo in the list |
| `src/components/TrustBadge.tsx` the good, warn, red badge |
| `src/app/page.tsx` and `src/app/projects/[proj_id]/page.tsx` the two pages |

## Settings

| Name | Default | What it does |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | http://localhost:4000 | where our API lives |
| `NEXT_PUBLIC_CLOUD_NAME` | demo | used to build a fallback thumbnail link |
