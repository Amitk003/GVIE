# Align service

This service lines up a new photo to its baseline so a change is easy to see.

It is a small Python service with FastAPI and OpenCV. It lives in
`services/align`.

## Steps in plain words

1. Download both photos from their links
2. Make each photo grey and shrink it if it is very large
3. Find sharp corners with SIFT, and try ORB if SIFT is unhappy
4. Match the corners and keep only the pairs with one clear best partner
5. Use RANSAC to throw away wrong pairs and work out the warp matrix
6. Warp the new photo onto the old camera view
7. Reply with the matrix, the numbers, and the aligned picture

## When it refuses to align

* Fewer than 15 good points
* Middle error more than 8 pixels
* View change more than 60 degrees

In that case the reply is `skipped` with a plain reason. We keep the raw file,
use smart crop `g_auto` on the web side, and set an alignment warning. A wrong
warp is worse than no warp.

## How to run it

```bash
cd services/align
pip install -r requirements-dev.txt
python -m pytest
uvicorn align_service.main:app --port 5001
```

## Routes

`GET /health` says the service is alive.

`POST /v1/align` needs `baseline_url`, `target_url`, and `public_id`. Optional:
`aligned_public_id`, `output_format` (`jpg`, `png`, `webp`), and
`return_image`.

```json
{
  "status": "aligned",
  "public_id": "gvie/WATER-01/after_1",
  "aligned_public_id": "gvie/WATER-01/aligned_1",
  "homography": [[1.0, 0.0, -5.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]],
  "elapsed_ms": 812.4,
  "aligned_image_base64": null,
  "metrics": {
    "keypoints_baseline": 2416,
    "keypoints_target": 2409,
    "good_matches": 2360,
    "inliers": 2281,
    "median_error_px": 0.42,
    "angle_degrees": 0.11,
    "detector": "sift"
  }
}
```

`aligned_image_base64` is only filled when you ask for it with
`"return_image": true`. That keeps normal replies small.

Answers: `400` for bytes that are not a picture or a link that is not http,
`413` for a photo over 25 MB, `502` when a photo cannot be downloaded, `422`
when the request body is wrong.

## Settings you can change

| Name | Default | What it does |
|---|---|---|
| `ALIGN_MAX_FEATURES` | 4000 | how many corners to look for |
| `ALIGN_LOWE_RATIO` | 0.75 | how strict the pairing is |
| `ALIGN_RANSAC_THRESHOLD_PX` | 5.0 | how far a match may be off |
| `ALIGN_MIN_INLIERS` | 15 | how many good points we insist on |
| `ALIGN_MAX_MEDIAN_ERROR_PX` | 8.0 | when to give up on quality |
| `ALIGN_MAX_ANGLE_DEGREES` | 60.0 | when the view is too different |
| `ALIGN_MAX_DIMENSION_PX` | 1600 | shrink big photos before working |
| `ALIGN_USE_ORB_FALLBACK` | true | try ORB after SIFT |

## Where the numbers go

The API stores `inliers`, `median_error_px`, `angle_degrees`, and the detector
name in the audit trail. That is how we show a funder that the comparison was
real and not a guess.

## URLs we build on the web side

* Split view: overlay the aligned file on the right half
* Wipe: small WebP that loops between the two frames

