"""Test helpers: make simple photos that we know the answer for."""

from __future__ import annotations

import cv2
import numpy as np


def make_texture(height: int = 240, width: int = 320, seed: int = 7) -> np.ndarray:
    """A busy grey picture with plenty of corners for the matcher to find."""
    rng = np.random.default_rng(seed)
    base = rng.integers(0, 255, size=(height, width), dtype=np.uint8)
    picture = cv2.GaussianBlur(base, (5, 5), 0)
    for _ in range(120):
        x = int(rng.integers(0, width - 12))
        y = int(rng.integers(0, height - 12))
        size = int(rng.integers(6, 18))
        value = int(rng.integers(0, 255))
        cv2.rectangle(picture, (x, y), (x + size, y + size), value, -1)
    return picture


def make_pair(
    shift_x: int = 0,
    shift_y: int = 0,
    rotate_degrees: float = 0.0,
    seed: int = 7,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Build a baseline and a target that is the baseline seen from a new spot.

    Returns the baseline, the target, and the homography that turns the target
    back into the baseline view.
    """
    baseline = make_texture(seed=seed)
    height, width = baseline.shape[:2]
    center = np.array([width / 2.0, height / 2.0], dtype=np.float32)
    matrix = cv2.getRotationMatrix2D(tuple(center), rotate_degrees, 1.0)
    matrix[0, 2] += shift_x
    matrix[1, 2] += shift_y
    homography = np.vstack([matrix, [0.0, 0.0, 1.0]]).astype(np.float32)
    target = cv2.warpPerspective(
        baseline,
        homography,
        (width, height),
        borderMode=cv2.BORDER_REFLECT,
    )
    return baseline, target, homography


def make_unrelated(height: int = 240, width: int = 320, seed: int = 99) -> np.ndarray:
    """A picture with nothing in common with the baseline."""
    return make_texture(height=height, width=width, seed=seed)
