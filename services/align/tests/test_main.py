"""Tests for the HTTP layer of the align service.

We serve the test photos from a tiny local server so the download path is real.
"""

from __future__ import annotations

import base64
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import numpy as np
import pytest
from fastapi.testclient import TestClient

from align_service.config import AlignSettings
from align_service.images import decode_image, encode_image
from align_service.main import create_app
from tests.factories import make_pair, make_texture, make_unrelated

TIGHT = AlignSettings(max_dimension_px=400, use_orb_fallback=False)

BASELINE_PNG = base64.b64encode(encode_image(make_texture(), "png")).decode("ascii")
TARGET_PNG = base64.b64encode(encode_image(make_pair(shift_x=5, shift_y=0)[1], "png")).decode("ascii")
UNRELATED_PNG = base64.b64encode(encode_image(make_unrelated(), "png")).decode("ascii")
NOT_A_PICTURE = b"this is plain text, not a picture"

FILES = {
    "/baseline.png": BASELINE_PNG,
    "/target.png": TARGET_PNG,
    "/unrelated.png": UNRELATED_PNG,
    "/broken.png": None,
}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802 - name fixed by the base class
        if self.path not in FILES:
            self.send_error(404)
            return
        stored = FILES[self.path]
        body = NOT_A_PICTURE if stored is None else base64.b64decode(stored)
        self.send_response(200)
        self.send_header("content-type", "image/png")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args) -> None:
        return


@pytest.fixture(scope="module")
def photo_server():
    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()
    server.server_close()


@pytest.fixture
def client():
    return TestClient(create_app(TIGHT))


def body(baseline: str, target: str, **extra) -> dict:
    return {
        "baseline_url": baseline,
        "target_url": target,
        "public_id": "gvie/WATER-01/after_1",
        **extra,
    }


class TestImageCodec:
    def test_decode_reads_png_bytes(self):
        image = decode_image(base64.b64decode(BASELINE_PNG))
        assert image.ndim == 3

    def test_decode_rejects_empty(self):
        with pytest.raises(Exception):
            decode_image(b"")

    def test_decode_rejects_text(self):
        with pytest.raises(Exception):
            decode_image(NOT_A_PICTURE)

    def test_encode_round_trip(self):
        picture = make_texture(height=60, width=80)
        again = decode_image(encode_image(picture, "jpg"))
        assert again.shape[:2] == picture.shape[:2]

    def test_encode_rejects_unknown_format(self):
        with pytest.raises(Exception):
            encode_image(make_texture(), "tiffy")


class TestHealth:
    def test_health_says_ok(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["service"] == "gvie-align"


class TestAlignRoute:
    def test_matching_pair_is_aligned(self, client, photo_server):
        response = client.post(
            "/v1/align", json=body(f"{photo_server}/baseline.png", f"{photo_server}/target.png")
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "aligned"
        assert data["homography"] is not None
        assert len(data["homography"]) == 3
        assert data["metrics"]["detector"] == "sift"
        assert data["metrics"]["inliers"] > 15
        assert data["elapsed_ms"] >= 0

    def test_image_is_returned_only_when_asked(self, client, photo_server):
        request = body(
            f"{photo_server}/baseline.png",
            f"{photo_server}/target.png",
            return_image=True,
            output_format="png",
        )
        data = client.post("/v1/align", json=request).json()
        assert data["aligned_image_base64"]
        decoded = decode_image(base64.b64decode(data["aligned_image_base64"]))
        assert decoded.ndim == 3

    def test_no_image_by_default(self, client, photo_server):
        request = body(f"{photo_server}/baseline.png", f"{photo_server}/target.png")
        assert client.post("/v1/align", json=request).json()["aligned_image_base64"] is None

    def test_unrelated_pair_is_skipped_with_a_reason(self, client, photo_server):
        response = client.post(
            "/v1/align",
            json=body(f"{photo_server}/baseline.png", f"{photo_server}/unrelated.png"),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "skipped"
        assert data["reason"]
        assert data["homography"] is None
        assert data["aligned_image_base64"] is None
        assert data["metrics"]["inliers"] < 15

    def test_broken_picture_gives_400(self, client, photo_server):
        response = client.post(
            "/v1/align", json=body(f"{photo_server}/baseline.png", f"{photo_server}/broken.png")
        )
        assert response.status_code == 400

    def test_missing_picture_gives_502(self, client, photo_server):
        response = client.post(
            "/v1/align", json=body(f"{photo_server}/baseline.png", f"{photo_server}/nope.png")
        )
        assert response.status_code == 502

    def test_non_http_link_gives_400(self, client):
        response = client.post("/v1/align", json=body("file:///etc/passwd", "https://x.test/a.jpg"))
        assert response.status_code == 400

    def test_missing_public_id_gives_422(self, client, photo_server):
        request = body(f"{photo_server}/baseline.png", f"{photo_server}/target.png")
        del request["public_id"]
        assert client.post("/v1/align", json=request).status_code == 422

    def test_bad_output_format_gives_422(self, client, photo_server):
        request = body(
            f"{photo_server}/baseline.png",
            f"{photo_server}/target.png",
            output_format="exe",
        )
        assert client.post("/v1/align", json=request).status_code == 422

    def test_aligned_public_id_is_passed_back(self, client, photo_server):
        request = body(
            f"{photo_server}/baseline.png",
            f"{photo_server}/target.png",
            aligned_public_id="gvie/WATER-01/aligned_1",
        )
        data = client.post("/v1/align", json=request).json()
        assert data["aligned_public_id"] == "gvie/WATER-01/aligned_1"
