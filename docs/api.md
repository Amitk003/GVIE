# API

Base URL is `http://localhost:4000`. Every answer is JSON. When something is wrong
you get `error` (a short reason) and `details` (a list of the bad fields).

## Health

`GET /health`

```json
{ "ok": true, "service": "gvie-api", "time": "2026-09-29T10:20:30.000Z" }
```

## Upload sign

`POST /v1/uploads/sign`

Give it the facts about the file. It builds the folder, the public id, the
metadata text, and the signature you need for a safe direct upload.

Body fields: `proj_id`, `tempo_phase` (`Baseline_Before`, `Interim_Work`,
`Outcome_After`), `geo_coords` (like `12.97, 77.59`), `c2pa_valid` (true or false
from the client check), `sha256` (64 hex characters). Optional:
`base_asset_id`, `public_id`, `gps_drift_meters`, `client_captured_at`.

```json
{
  "cloudName": "impact-cloud",
  "apiKey": "key-123",
  "timestamp": 1780000000,
  "signature": "9f2c...",
  "uploadUrl": "https://api.cloudinary.com/v1_1/impact-cloud/image/upload",
  "publicId": "water_01_20260929102030_aaaaaaaaaaaa_base",
  "folder": "gvie/WATER-01",
  "params": {
    "public_id": "water_01_20260929102030_aaaaaaaaaaaa_base",
    "folder": "gvie/WATER-01",
    "upload_preset": "gvie_signed",
    "metadata": "proj_id=WATER-01|veri_status=Pending_AI|c2pa_valid=false|...",
    "context": "sha256=aaaa...|c2pa_claimed=true"
  },
  "metadata": { "c2pa_valid": false, "veri_status": "Pending_AI" }
}
```

Two rules you should know:

- `c2pa_valid` is always `false` in this reply. The client only reads the seal,
  so the server must check the manifest itself before it can say true.
- If the client says the seal is broken, the answer is `Failed_C2PA` right away.

Bad input gives `400` with the field name in `details`.

## Webhook

`POST /v1/webhooks/cloudinary`

Cloudinary calls this after an upload. We check the signature, then push jobs on
the queue and answer fast so Cloudinary never waits on us.

We read two headers: `x-cld-timestamp` and `x-cld-signature`. The signature is
`HMAC-SHA256(timestamp + "." + rawBody, CLOUDINARY_WEBHOOK_SECRET)`.

```json
{
  "accepted": true,
  "publicId": "gvie/WATER-01/after_1",
  "jobs": ["baseline_lookup", "align", "telemetry", "index"]
}
```

- `Outcome_After` photos get all four jobs.
- `Baseline_Before` photos get `telemetry` and `index` only.
- Video gets `index` only.

`401` for a bad signature. `400` for a body without a public id. If
`CLOUDINARY_WEBHOOK_SECRET` is not set the route fails closed and returns `500`,
because we will not accept a webhook we cannot prove.

## Assets

`GET /v1/assets`

Query fields: `proj_id`, `veri_status`, `tempo_phase`, `text`, `max` (1 to 100,
default 50).

```json
{ "expression": "resource_type:image AND metadata.proj_id=\"WATER-01\" || ...",
  "count": 1, "results": [ ... ] }
```

`GET /v1/assets/:publicId` returns one asset, or `404` when nothing matches.
If search is not set up yet you get `503` instead of a broken answer.

## Telemetry

`POST /v1/telemetry/run`

Body fields: `public_id`, `sector` (`water`, `forest`, or `solar`). Optional:
`image_url`, `extra_instruction`.

The reply shows the exact call we will make to Cloudinary, so you can see the
schema that the AI must obey.

```json
{
  "accepted": true,
  "sector": "water",
  "request": {
    "url": "https://api.cloudinary.com/v2/analysis/impact-cloud/analyze/ai_vision_tagging",
    "body": {
      "source": { "uri": "..." },
      "prompts": ["..."],
      "json_schema": { "required": ["operational_status", "..."], "additionalProperties": false }
    }
  }
}
```

`400` for an unknown sector. `502` when Cloudinary refuses the call.

## Export

`POST /v1/exports/proof`

Body fields: `title`, `place`, and `assets` (at least 1, at most 200). Each asset
can have `public_id`, `aligned_id`, `sha256`, `veri_status`, `obj_count`,
`ndvi_delta`. Optional: `video_scene_ids`.

The answer is a manifest with a small image link, a before and after link for
every asset that has an aligned copy, and a reel link when video scenes are given.

```json
{
  "manifest": {
    "title": "Water done",
    "place": "Block A",
    "assetCount": 1,
    "assets": [
      {
        "publicId": "...",
        "thumbUrl": "...",
        "compareUrl": "...",
        "sha256": "aaaa...",
        "veri_status": "Verified",
        "objCount": 3,
        "ndviDelta": null
      }
    ],
    "reelUrl": "https://res.cloudinary.com/...fl_splice...",
    "generatedAt": "2026-09-29T10:20:30.000Z"
  }
}
```

## Jobs we put on the queue

`baseline_lookup` find the before photo near this place, `align` warp the new
photo to it, `telemetry` read numbers with the fixed schema, `index` refresh
search.
