"""Tuning values for the alignment service.

Every gate here is a safety rule. If a check fails we do not align, we return the
raw file and log a warning, because a wrong warp is worse than no warp.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return float(raw)


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


@dataclass(frozen=True)
class AlignSettings:
    """Limits used while matching and checking two photos."""

    max_features: int = field(default_factory=lambda: _env_int("ALIGN_MAX_FEATURES", 4000))
    lowe_ratio: float = field(default_factory=lambda: _env_float("ALIGN_LOWE_RATIO", 0.75))
    ransac_reproj_threshold_px: float = field(
        default_factory=lambda: _env_float("ALIGN_RANSAC_THRESHOLD_PX", 5.0)
    )
    min_inliers: int = field(default_factory=lambda: _env_int("ALIGN_MIN_INLIERS", 15))
    max_median_error_px: float = field(
        default_factory=lambda: _env_float("ALIGN_MAX_MEDIAN_ERROR_PX", 8.0)
    )
    max_angle_degrees: float = field(
        default_factory=lambda: _env_float("ALIGN_MAX_ANGLE_DEGREES", 60.0)
    )
    max_dimension_px: int = field(default_factory=lambda: _env_int("ALIGN_MAX_DIMENSION_PX", 1600))
    use_orb_fallback: bool = field(
        default_factory=lambda: os.environ.get("ALIGN_USE_ORB_FALLBACK", "true").lower()
        == "true"
    )
