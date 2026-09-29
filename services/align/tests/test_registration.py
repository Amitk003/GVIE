"""Tests for the alignment math.

We make photos from a known warp, so we know the right answer before we start.
"""

from __future__ import annotations

import numpy as np
import pytest

from align_service.config import AlignSettings
from align_service.registration import (
    align,
    build_matcher,
    create_detector,
    detect_and_describe,
    estimate_homography,
    gate_reason,
    match_keypoints,
    resize_to_limit,
    rotation_angle_degrees,
    to_gray,
    warp_to_baseline,
)
from tests.factories import make_pair, make_texture, make_unrelated

TIGHT = AlignSettings(max_dimension_px=400, use_orb_fallback=False)


class TestImageHelpers:
    def test_to_gray_on_grey_image(self):
        grey = make_texture()
        assert to_gray(grey).ndim == 2

    def test_to_gray_on_colour_image(self):
        grey = make_texture()
        colour = np.repeat(grey[:, :, np.newaxis], 3, axis=2)
        assert to_gray(colour).shape == grey.shape

    def test_to_gray_on_image_with_alpha(self):
        grey = make_texture()
        with_alpha = np.repeat(grey[:, :, np.newaxis], 4, axis=2)
        assert to_gray(with_alpha).shape == grey.shape

    def test_resize_keeps_small_images(self):
        small = make_texture(height=80, width=100)
        assert resize_to_limit(small, 400).shape == small.shape

    def test_resize_caps_longest_side(self):
        big = make_texture(height=400, width=800)
        resized = resize_to_limit(big, 400)
        assert max(resized.shape[:2]) == 400

    def test_unknown_detector_raises(self):
        with pytest.raises(ValueError):
            create_detector("magic")


class TestMatchers:
    def test_sift_matcher_is_flann(self):
        assert build_matcher("sift").__class__.__name__ == "FlannBasedMatcher"

    def test_orb_matcher_uses_brace_matcher(self):
        assert build_matcher("orb").__class__.__name__ == "BFMatcher"

    def test_no_descriptors_gives_no_matches(self):
        assert match_keypoints(build_matcher("sift"), None, None, 0.75) == []

    def test_single_descriptor_gives_no_matches(self):
        one = np.zeros((1, 128), dtype=np.float32)
        assert match_keypoints(build_matcher("sift"), one, one, 0.75) == []

    def test_identical_pictures_match_well(self):
        picture = to_gray(make_texture())
        detector = create_detector("sift")
        _, desc_a = detect_and_describe(detector, picture)
        _, desc_b = detect_and_describe(detector, picture.copy())
        matches = match_keypoints(build_matcher("sift"), desc_a, desc_b, 0.75)
        assert len(matches) > 15


class TestHomographyHelpers:
    def test_too_few_points_gives_no_matrix(self):
        empty = np.empty((0, 1, 2), dtype=np.float32)
        assert estimate_homography(empty, empty, 5.0) == (None, None)

    def test_angle_of_identity_is_zero(self):
        identity = np.eye(3, dtype=np.float32)
        assert rotation_angle_degrees(identity) == pytest.approx(0.0)

    def test_angle_reads_the_tilt(self):
        matrix = np.array([[0.0, -1.0, 0.0], [1.0, 0.0, 0.0], [0.0, 0.0, 1.0]], dtype=np.float32)
        assert rotation_angle_degrees(matrix) == pytest.approx(90.0)

    def test_angle_of_missing_matrix_is_none(self):
        assert rotation_angle_degrees(None) is None

    def test_warp_uses_baseline_size(self):
        picture = make_texture(height=120, width=160)
        warped = warp_to_baseline(picture, np.eye(3, dtype=np.float32), (160, 120))
        assert warped.shape[:2] == (120, 160)


class TestGates:
    def test_too_few_inliers_is_refused(self):
        reason = gate_reason(4, 1.0, 0.0, TIGHT)
        assert "good points" in reason

    def test_high_error_is_refused(self):
        assert "error too high" in gate_reason(100, 40.0, 0.0, TIGHT)

    def test_big_angle_is_refused(self):
        assert "view changed too much" in gate_reason(100, 1.0, 75.0, TIGHT)

    def test_missing_error_is_refused(self):
        assert gate_reason(100, None, 0.0, TIGHT) is not None

    def test_good_numbers_pass(self):
        assert gate_reason(100, 1.5, 8.0, TIGHT) is None


class TestAlign:
    def test_same_photo_aligns_perfectly(self):
        picture = to_gray(make_texture())
        outcome = align(picture, picture.copy(), TIGHT)
        assert outcome.status == "aligned"
        assert outcome.inliers > 15
        assert outcome.median_error_px is not None
        assert outcome.median_error_px < 1.0

    def test_small_shift_is_recovered(self):
        baseline, target, _ = make_pair(shift_x=6, shift_y=4)
        outcome = align(baseline, target, TIGHT)
        assert outcome.status == "aligned"
        assert abs(outcome.angle_degrees) < 5.0

    def test_small_rotation_is_recovered(self):
        baseline, target, _ = make_pair(rotate_degrees=6.0)
        outcome = align(baseline, target, TIGHT)
        assert outcome.status == "aligned"
        assert abs(outcome.angle_degrees - 6.0) < 3.0

    def test_aligned_image_matches_baseline_size(self):
        baseline, target, _ = make_pair(shift_x=5, shift_y=0)
        outcome = align(baseline, target, TIGHT)
        assert outcome.aligned_image is not None
        assert outcome.aligned_image.shape[:2] == baseline.shape[:2]

    def test_aligned_image_is_close_to_baseline(self):
        baseline, target, _ = make_pair(shift_x=5, shift_y=3)
        outcome = align(baseline, target, TIGHT)
        assert np.abs(
            outcome.aligned_image.astype(np.int16) - baseline.astype(np.int16)
        ).mean() < 12.0

    def test_unrelated_photo_is_refused(self):
        outcome = align(to_gray(make_texture()), to_gray(make_unrelated()), TIGHT)
        assert outcome.status == "skipped"
        assert outcome.aligned_image is None
        assert outcome.reason

    def test_reason_mentions_the_detector(self):
        outcome = align(to_gray(make_texture()), to_gray(make_unrelated()), TIGHT)
        assert "sift" in str(outcome.reason)

    def test_orb_fallback_runs_when_enabled(self):
        settings = AlignSettings(max_dimension_px=400, use_orb_fallback=True)
        outcome = align(to_gray(make_texture()), to_gray(make_unrelated()), settings)
        assert outcome.detector in {"sift", "orb"}

    def test_high_inlier_gate_skips_a_good_pair(self):
        baseline, target, _ = make_pair(shift_x=4, shift_y=0)
        strict = AlignSettings(max_dimension_px=400, use_orb_fallback=False, min_inliers=100000)
        outcome = align(baseline, target, strict)
        assert outcome.status == "skipped"
        assert "good points" in str(outcome.reason)

    def test_big_images_are_shrunk_first(self):
        baseline, target, _ = make_pair(shift_x=8, shift_y=0)
        baseline = np.repeat(baseline[:, :, np.newaxis], 3, axis=2)[:600, :800]
        target = np.repeat(target[:, :, np.newaxis], 3, axis=2)[:600, :800]
        outcome = align(baseline, target, AlignSettings(max_dimension_px=400))
        assert outcome.status == "aligned"
        assert max(outcome.aligned_image.shape[:2]) <= 400
