"""Request and reply shapes for the align service."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

AlignStatus = Literal["aligned", "skipped", "error"]


class AlignRequest(BaseModel):
    """Ask for one after photo to be lined up with its baseline."""

    baseline_url: str = Field(min_length=1)
    target_url: str = Field(min_length=1)
    public_id: str = Field(min_length=1)
    aligned_public_id: Optional[str] = None
    output_format: str = Field(default="jpg", pattern="^(jpg|png|webp)$")


class AlignMetrics(BaseModel):
    """Numbers we keep for the audit trail."""

    keypoints_baseline: int = 0
    keypoints_target: int = 0
    good_matches: int = 0
    inliers: int = 0
    median_error_px: Optional[float] = None
    angle_degrees: Optional[float] = None
    detector: Optional[str] = None


class AlignResponse(BaseModel):
    """What the service did, in plain words."""

    status: AlignStatus
    public_id: str
    aligned_public_id: Optional[str] = None
    aligned_url: Optional[str] = None
    reason: Optional[str] = None
    homography: Optional[list[list[float]]] = None
    metrics: AlignMetrics = Field(default_factory=AlignMetrics)
