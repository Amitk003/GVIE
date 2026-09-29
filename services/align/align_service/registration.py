"""The alignment math.

Plain words: we look for the same corners in both photos, drop the pairs that do
not agree, and work out the single warp that turns the new photo into the old
camera view.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Optional

import cv2
import numpy as np

from .config import AlignSettings

Array = np.ndarray


@dataclass
class AlignOutcome:
    """Result of one alignment attempt."""

    status: str
    reason: Optional[str] = None
    aligned_image: Optional[Array] = None
    homography: Optional[Array] = None
    detector: Optional[str] = None
    keypoints_baseline: int = 0
    keypoints_target: int = 0
    good_matches: int = 0
    inliers: int = 0
    median_error_px: Optional[float] = None
    angle_degrees: Optional[float] = None
    extra: dict[str, Any] = field(default_factory=dict)


def to_gray(image: Array) -> Array:
    """Return a single channel grey image."""
    if image.ndim == 2:
        return image
    if image.shape[2] == 4:
        return cv2.cvtColor(image, cv2.COLOR_BGRA2GRAY)
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def resize_to_limit(image: Array, max_dimension: int) -> Array:
    """Make the longest side small enough so the work stays fast."""
    height, width = image.shape[:2]
    longest = max(height, width)
    if longest <= max_dimension:
        return image
    scale = max_dimension / float(longest)
    new_size = (max(1, int(round(width * scale))), max(1, int(round(height * scale))))
    return cv2.resize(image, new_size, interpolation=cv2.INTER_AREA)


def create_detector(name: str) -> Any:
    """Build a keypoint detector by name."""
    if name == "sift":
        return cv2.SIFT_create(nfeatures=4000)
    if name == "orb":
        return cv2.ORB_create(nfeatures=4000)
    raise ValueError(f"unknown detector: {name}")


def detect_and_describe(detector: Any, gray: Array) -> tuple[list[Any], Optional[Array]]:
    """Find corners and describe them so they can be matched."""
    keypoints, descriptors = detector.detectAndCompute(gray, None)
    return list(keypoints), descriptors


def build_matcher(detector_name: str) -> Any:
    """SIFT descriptors are floats, ORB descriptors are bits."""
    if detector_name == "sift":
        index_params = {"algorithm": 1, "trees": 5}
        search_params = {"checks": 50}
        return cv2.FlannBasedMatcher(index_params, search_params)
    return cv2.BFMatcher(cv2.NORM_HAMMING)


def match_keypoints(
    matcher: Any,
    descriptors_a: Optional[Array],
    descriptors_b: Optional[Array],
    lowe_ratio: float,
) -> list[Any]:
    """Keep only pairs that have one clear best partner (Lowe ratio test)."""
    if descriptors_a is None or descriptors_b is None:
        return []
    if len(descriptors_a) < 2 or len(descriptors_b) < 2:
        return []
    pairs = matcher.knnMatch(descriptors_a, descriptors_b, k=2)
    good: list[Any] = []
    for pair in pairs:
        if len(pair) < 2:
            continue
        best, second = pair[0], pair[1]
        if best.distance < lowe_ratio * second.distance:
            good.append(best)
    return good


def points_from(keypoints: list[Any], matches: list[Any], use_train_index: bool) -> Array:
    """Stack the coordinates of the matched keypoints into an array.

    knnMatch gives queryIdx for the first descriptor set and trainIdx for the
    second one. Remember which side each set was on, or the points get mixed up.
    """
    if not matches:
        return np.empty((0, 1, 2), dtype=np.float32)
    indexes = [m.trainIdx if use_train_index else m.queryIdx for m in matches]
    stack = np.array([keypoints[i].pt for i in indexes], dtype=np.float32)
    return stack.reshape(-1, 1, 2)


def estimate_homography(
    source_points: Array,
    destination_points: Array,
    ransac_threshold_px: float,
) -> tuple[Optional[Array], Optional[Array]]:
    """Find the warp that moves source points onto destination points."""
    if len(source_points) < 4:
        return None, None
    matrix, mask = cv2.findHomography(
        source_points,
        destination_points,
        cv2.RANSAC,
        ransac_threshold_px,
    )
    if matrix is None or mask is None:
        return None, None
    return matrix, mask


def median_reprojection_error(
    source_points: Array,
    destination_points: Array,
    homography: Array,
    inlier_mask: Array,
) -> Optional[float]:
    """Average how far the inlier points land from where they should land."""
    keep = inlier_mask.ravel().astype(bool)
    if not keep.any():
        return None
    source = source_points[keep].reshape(-1, 2)
    target = destination_points[keep].reshape(-1, 2)
    projected = cv2.perspectiveTransform(source.reshape(-1, 1, 2), homography).reshape(-1, 2)
    distances = np.linalg.norm(projected - target, axis=1)
    return float(np.median(distances))


def rotation_angle_degrees(homography: Optional[Array]) -> Optional[float]:
    """Read the tilt of the warp so we can refuse big viewpoint changes."""
    if homography is None or homography.shape != (3, 3):
        return None
    if abs(homography[2, 2]) < 1e-12:
        return None
    normalized = homography / homography[2, 2]
    return math.degrees(math.atan2(float(normalized[1, 0]), float(normalized[0, 0])))


def warp_to_baseline(target: Array, homography: Array, baseline_size: tuple[int, int]) -> Array:
    """Reshape the new photo so it sits exactly on the old camera view."""
    width, height = baseline_size
    return cv2.warpPerspective(target, homography, (width, height))


def align(
    baseline_image: Array,
    target_image: Array,
    settings: AlignSettings,
) -> AlignOutcome:
    """Try to line up target_image with baseline_image.

    We try SIFT first. If it cannot find enough shared points we try ORB before
    giving up, because ORB sometimes survives a soft or low light photo.
    """
    baseline = resize_to_limit(baseline_image, settings.max_dimension_px)
    target = resize_to_limit(target_image, settings.max_dimension_px)
    baseline_gray = to_gray(baseline)
    target_gray = to_gray(target)

    detector_names = ["sift", "orb"] if settings.use_orb_fallback else ["sift"]
    outcome = AlignOutcome(status="skipped", reason="no detector found enough shared points")

    for detector_name in detector_names:
        candidate = _try_detector(detector_name, baseline, target, baseline_gray, target_gray, settings)
        if candidate.status == "aligned":
            return candidate
        outcome = candidate

    return outcome


def _try_detector(
    detector_name: str,
    baseline: Array,
    target: Array,
    baseline_gray: Array,
    target_gray: Array,
    settings: AlignSettings,
) -> AlignOutcome:
    """Run one detector through the whole pipeline."""
    detector = create_detector(detector_name)
    baseline_points, baseline_desc = detect_and_describe(detector, baseline_gray)
    target_points, target_desc = detect_and_describe(detector, target_gray)
    matcher = build_matcher(detector_name)
    matches = match_keypoints(matcher, target_desc, baseline_desc, settings.lowe_ratio)

    outcome = AlignOutcome(
        status="skipped",
        reason=f"{detector_name}: only {len(matches)} good points, need {settings.min_inliers}",
        detector=detector_name,
        keypoints_baseline=len(baseline_points),
        keypoints_target=len(target_points),
        good_matches=len(matches),
    )

    if len(matches) < settings.min_inliers:
        return outcome

    # The warp must move points from the target view into the baseline view.
    source = points_from(target_points, matches, use_train_index=False)
    destination = points_from(baseline_points, matches, use_train_index=True)
    homography, inlier_mask = estimate_homography(
        source, destination, settings.ransac_reproj_threshold_px
    )
    if homography is None or inlier_mask is None:
        outcome.reason = f"{detector_name}: could not find a warp"
        return outcome

    inliers = int(inlier_mask.ravel().astype(bool).sum())
    median_error = median_reprojection_error(source, destination, homography, inlier_mask)
    angle = rotation_angle_degrees(homography)
    outcome.homography = homography
    outcome.inliers = inliers
    outcome.median_error_px = median_error
    outcome.angle_degrees = angle

    reason = gate_reason(inliers, median_error, angle, settings)
    if reason is not None:
        outcome.reason = f"{detector_name}: {reason}"
        return outcome

    outcome.status = "aligned"
    outcome.reason = None
    outcome.aligned_image = warp_to_baseline(
        target, homography, (baseline.shape[1], baseline.shape[0])
    )
    return outcome



def gate_reason(
    inliers: int,
    median_error: Optional[float],
    angle: Optional[float],
    settings: AlignSettings,
) -> Optional[str]:
    """Return a plain reason when we must refuse to align."""
    if inliers < settings.min_inliers:
        return f"only {inliers} good points, need {settings.min_inliers}"
    if median_error is None or median_error > settings.max_median_error_px:
        return f"error too high: {median_error}"
    if angle is not None and abs(angle) > settings.max_angle_degrees:
        return f"view changed too much: {round(angle, 1)} degrees"
    return None
