"""The HTTP service.

It takes two picture links, lines up the new photo with the old one, and gives
back the aligned picture plus the numbers we keep for the audit trail.
"""

from __future__ import annotations

import base64
import os
import time
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .config import AlignSettings
from .images import decode_image, encode_image
from .registration import align
from .schemas import AlignMetrics, AlignRequest, AlignResponse

MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024


def create_app(settings: Optional[AlignSettings] = None) -> FastAPI:
    """Build the FastAPI app with all routes."""
    app = FastAPI(title="GVIE align service", version="0.1.0")
    app.state.settings = settings or AlignSettings()

    @app.get("/health")
    def health() -> dict:
        return {"ok": True, "service": "gvie-align", "time": time.strftime("%Y-%m-%dT%H:%M:%SZ")}

    @app.post("/v1/align", response_model=AlignResponse)
    async def run_align(request: AlignRequest) -> AlignResponse:
        started = time.perf_counter()
        baseline_bytes, target_bytes = await _fetch_both(request)
        baseline_image = decode_image(baseline_bytes)
        target_image = decode_image(target_bytes)

        outcome = align(baseline_image, target_image, app.state.settings)
        elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
        metrics = AlignMetrics(
            keypoints_baseline=outcome.keypoints_baseline,
            keypoints_target=outcome.keypoints_target,
            good_matches=outcome.good_matches,
            inliers=outcome.inliers,
            median_error_px=outcome.median_error_px,
            angle_degrees=outcome.angle_degrees,
            detector=outcome.detector,
        )

        if outcome.status != "aligned" or outcome.aligned_image is None:
            return AlignResponse(
                status="skipped",
                public_id=request.public_id,
                reason=outcome.reason,
                elapsed_ms=elapsed_ms,
                metrics=metrics,
            )

        encoded = None
        if request.return_image:
            encoded = base64.b64encode(
                encode_image(outcome.aligned_image, request.output_format)
            ).decode("ascii")

        return AlignResponse(
            status="aligned",
            public_id=request.public_id,
            aligned_public_id=request.aligned_public_id,
            reason=None,
            homography=_homography_to_list(outcome.homography),
            elapsed_ms=elapsed_ms,
            aligned_image_base64=encoded,
            metrics=metrics,
        )

    return app


async def _fetch_both(request: AlignRequest) -> tuple[bytes, bytes]:
    """Download both photos, or fail with a clear message."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            baseline = await _fetch_one(client, request.baseline_url)
            target = await _fetch_one(client, request.target_url)
        except httpx.HTTPError as error:
            raise HTTPException(status_code=502, detail=f"could not download a photo: {error}") from error
    return baseline, target


async def _fetch_one(client: httpx.AsyncClient, url: str) -> bytes:
    """Download one photo with a size limit."""
    if not url.lower().startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="photo links must start with http or https")
    response = await client.get(url)
    response.raise_for_status()
    payload = response.content
    if len(payload) > MAX_DOWNLOAD_BYTES:
        raise HTTPException(status_code=413, detail="photo is too large")
    return payload


def _homography_to_list(matrix) -> Optional[list[list[float]]]:
    """Make the 3 by 3 matrix safe to send as JSON."""
    if matrix is None:
        return None
    return [[float(value) for value in row] for row in matrix]


app = create_app()


def main() -> None:
    """Run the service with uvicorn."""
    import uvicorn

    uvicorn.run(
        "align_service.main:app",
        host=os.environ.get("ALIGN_HOST", "0.0.0.0"),
        port=int(os.environ.get("ALIGN_PORT", "5001")),
    )


if __name__ == "__main__":
    main()
