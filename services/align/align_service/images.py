"""Decode image bytes into something OpenCV can use.

Plain words: bytes go in, a picture comes out. If the bytes are not a picture we
say so instead of crashing.
"""

from __future__ import annotations

import numpy as np
from fastapi import HTTPException

from .registration import Array

IMAGE_FORMATS = ("jpg", "jpeg", "png", "webp", "bmp", "tif", "tiff")


def decode_image(payload: bytes) -> Array:
    """Turn raw file bytes into an OpenCV image."""
    if not payload:
        raise HTTPException(status_code=400, detail="empty image bytes")
    buffer = np.frombuffer(payload, dtype=np.uint8)
    image = cv2_imdecode(buffer)
    if image is None:
        raise HTTPException(status_code=400, detail="could not read the image bytes")
    return image


def cv2_imdecode(buffer: Array) -> Array | None:
    """Small wrapper so the cv2 import stays in one place."""
    import cv2

    return cv2.imdecode(buffer, cv2.IMREAD_COLOR)


def encode_image(image: Array, output_format: str) -> bytes:
    """Turn an aligned image back into bytes we can upload."""
    import cv2

    normalized = output_format.lower()
    if normalized == "jpg":
        normalized = "jpeg"
    if normalized not in IMAGE_FORMATS:
        raise HTTPException(status_code=400, detail=f"unsupported format: {output_format}")
    success, buffer = cv2.imencode(f".{normalized}", image)
    if not success:
        raise HTTPException(status_code=500, detail="could not encode the aligned image")
    return buffer.tobytes()
