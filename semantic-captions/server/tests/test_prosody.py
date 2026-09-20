import numpy as np
import pytest

from server.analysis.prosody import (
    SILENCE_DBFS,
    VOLUME_FRAME_SECONDS,
    LiveVolumeTracker,
)
from server.audio.features import dbfs, rms_energy

SAMPLE_RATE = 1_000
FRAME_SAMPLES = round(VOLUME_FRAME_SECONDS * SAMPLE_RATE)
NORMAL_DBFS = -30.0
EXTRA_SMALL_DBFS = -47.0
SMALL_DBFS = -43.0
LARGE_DBFS = -14.0
EXTRA_LARGE_DBFS = -6.0


def amplitude_for_dbfs(level: float) -> float:
    return 10 ** (level / 20)


def frames_at(level: float, count: int) -> np.ndarray:
    return np.full(
        FRAME_SAMPLES * count,
        amplitude_for_dbfs(level),
        dtype=np.float32,
    )


def normal_tracker() -> LiveVolumeTracker:
    tracker = LiveVolumeTracker(SAMPLE_RATE)
    assert tracker.add_samples(frames_at(NORMAL_DBFS, 2)) == []
    assert tracker.state == "normal"
    return tracker


def test_rms_and_dbfs_have_predictable_relative_levels() -> None:
    full = np.full(1_000, 0.5, dtype=np.float32)
    half = np.full(1_000, 0.25, dtype=np.float32)

    assert rms_energy(full) == pytest.approx(0.5)
    assert rms_energy(half) == pytest.approx(0.25)
    assert dbfs(half) - dbfs(full) == pytest.approx(-6.0206, abs=0.001)


def test_feature_helpers_handle_empty_silence_and_non_finite_samples() -> None:
    assert rms_energy(np.array([], dtype=np.float32)) == 0.0
    assert dbfs(np.zeros(100, dtype=np.float32)) == pytest.approx(-160.0)
    with pytest.raises(ValueError, match="finite"):
        rms_energy(np.array([np.nan], dtype=np.float32))


def test_silence_is_inactive_and_never_emits_a_style() -> None:
    tracker = LiveVolumeTracker(SAMPLE_RATE)

    assert dbfs(np.zeros(FRAME_SAMPLES, dtype=np.float32)) <= SILENCE_DBFS
    assert tracker.add_samples(np.zeros(FRAME_SAMPLES * 5, dtype=np.float32)) == []
    assert tracker.state == "inactive"


def test_minus_30_dbfs_is_normal_and_emits_no_style() -> None:
    tracker = LiveVolumeTracker(SAMPLE_RATE)

    assert tracker.add_samples(frames_at(NORMAL_DBFS, 2)) == []
    assert tracker.state == "normal"


def test_minus_43_dbfs_sustained_becomes_small() -> None:
    tracker = LiveVolumeTracker(SAMPLE_RATE)

    cues = tracker.add_samples(frames_at(SMALL_DBFS, 2))

    assert tracker.state == "small"
    assert len(cues) == 1
    assert cues[0].category == "prosody"
    assert cues[0].label == "volume_small"
    assert cues[0].start == pytest.approx(0.0)
    assert cues[0].end == pytest.approx(0.4)


def test_minus_47_dbfs_sustained_becomes_extra_small() -> None:
    tracker = LiveVolumeTracker(SAMPLE_RATE)

    cues = tracker.add_samples(frames_at(EXTRA_SMALL_DBFS, 2))

    assert tracker.state == "xsmall"
    assert len(cues) == 1
    assert cues[0].label == "volume_xsmall"


def test_minus_14_dbfs_sustained_becomes_large() -> None:
    tracker = LiveVolumeTracker(SAMPLE_RATE)

    cues = tracker.add_samples(frames_at(LARGE_DBFS, 2))

    assert tracker.state == "large"
    assert len(cues) == 1
    assert cues[0].category == "prosody"
    assert cues[0].label == "volume_large"
    assert cues[0].start == pytest.approx(0.0)
    assert cues[0].end == pytest.approx(0.4)


def test_minus_6_dbfs_sustained_becomes_extra_large() -> None:
    tracker = LiveVolumeTracker(SAMPLE_RATE)

    cues = tracker.add_samples(frames_at(EXTRA_LARGE_DBFS, 2))

    assert tracker.state == "xlarge"
    assert len(cues) == 1
    assert cues[0].label == "volume_xlarge"


def test_short_loud_transient_does_not_change_normal_state() -> None:
    tracker = normal_tracker()

    assert tracker.add_samples(frames_at(LARGE_DBFS, 2)) == []
    assert tracker.add_samples(frames_at(NORMAL_DBFS, 1)) == []
    assert tracker.state == "normal"


def test_sustained_loud_level_changes_to_large_after_smoothing_and_persistence() -> None:
    tracker = normal_tracker()

    cues = tracker.add_samples(frames_at(LARGE_DBFS, 3))

    assert tracker.state == "large"
    assert len(cues) == 1
    assert cues[0].label == "volume_large"
    assert cues[0].start == pytest.approx(0.6)
    assert cues[0].end == pytest.approx(1.0)


def test_sustained_soft_level_changes_to_small_after_smoothing_and_persistence() -> None:
    tracker = normal_tracker()

    cues = tracker.add_samples(frames_at(SMALL_DBFS, 3))

    assert tracker.state == "small"
    assert len(cues) == 1
    assert cues[0].label == "volume_small"
    assert cues[0].start == pytest.approx(0.6)
    assert cues[0].end == pytest.approx(1.0)


def test_return_to_normal_restores_normal_state_and_stops_style_updates() -> None:
    tracker = normal_tracker()
    assert tracker.add_samples(frames_at(LARGE_DBFS, 3))[-1].label == "volume_large"

    assert tracker.add_samples(frames_at(NORMAL_DBFS, 2)) == []
    assert tracker.state == "normal"


def test_chunk_boundaries_do_not_change_sample_based_timestamps() -> None:
    tracker = LiveVolumeTracker(SAMPLE_RATE)
    loud = frames_at(LARGE_DBFS, 2)

    assert tracker.add_samples(loud[:100]) == []
    cues = tracker.add_samples(loud[100:])

    assert [(cue.start, cue.end) for cue in cues] == pytest.approx([(0.0, 0.4)])
