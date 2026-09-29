# API

Base URL is `http://localhost:4000`.

## Health

`GET /health` returns ok and time.

## Upload sign

`POST /v1/uploads/sign` takes folder and public_id and returns signature, timestamp, and api_key for a safe direct upload.

## Webhook

`POST /v1/webhooks/cloudinary` gets upload events from Cloudinary. It checks the signature, puts the job in queue, and returns accepted.

## Assets

`GET /v1/assets?proj_id=WATER-01&veri_status=Verified` proxies Cloudinary Search API with safe filters.

`GET /v1/assets/:public_id` returns one asset with metadata and URLs for thumb, compare, and wipe.

## Telemetry

`POST /v1/telemetry/run` takes public_id and schema name like water or forest and starts AI reading.

## Export

`POST /v1/exports/proof` takes a list of public_ids and makes a proof pack with images, hashes, signatures, AI logs, and video links.
