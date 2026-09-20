"""Responsive live caption sizing based on fixed digital signal levels."""

from __future__ import annotations

import logging
from collections import deque
from typing import Literal

import numpy as np

from server.audio.features import dbfs
from server.schemas import AudioCue

logger = logging.getLogger(__name__)

# MVP tuning values. Levels are dBFS, not calibrated physical sound pressure.
VOLUME_FRAME_SECONDS = 0.2
VOLUME_SMOOTHING_SECONDS = 0.4
VOLUME_STATE_PERSISTENCE_SECONDS = 0.4
SILENCE_DBFS = -50.0
EXTRA_SMALL_TEXT_MAX_DBFS = -44.0
SMALL_TEXT_MAX_DBFS = -38.0
LARGE_TEXT_MIN_DBFS = -18.0
EXTRA_LARGE_TEXT_MIN_DBFS = -10.0

VolumeState = Literal["inactive", "xsmall", "small", "normal", "large", "xlarge"]
VolumeLabel = Literal[
    "volume_xsmall",
    "volume_small",
    "volume_large",
    "volume_xlarge",
]


class LiveVolumeTracker:
    """Emit persistent small/large caption metadata from fixed dBFS bands."""

    def __init__(
        self,
        sample_rate: int,
        frame_seconds: float = VOLUME_FRAME_SECONDS,
    ) -> None:
        if sample_rate <= 0:
            raise ValueError("sample rate must be positive")
        if frame_seconds <= 0:
            raise ValueError("frame duration must be positive")

        self.sample_rate = sample_rate
        self.frame_samples = max(1, round(frame_seconds * sample_rate))
        self.frame_seconds = self.frame_samples / sample_rate
        smoothing_frames = max(
            1, round(VOLUME_SMOOTHING_SECONDS / self.frame_seconds)
        )
        self.persistence_samples = max(
            self.frame_samples,
            round(VOLUME_STATE_PERSISTENCE_SECONDS * sample_rate),
        )

        self.total_samples = 0
        self._buffer_start = 0
        self._next_frame_start = 0
        self._samples = np.empty(0, dtype=np.float32)
        self._recent_levels: deque[float] = deque(maxlen=smoothing_frames)
        self._state: VolumeState = "inactive"
        self._candidate_state: VolumeState | None = None
        self._candidate_start = 0
        self._candidate_samples = 0
        self._active_style_start = 0

    @property
    def state(self) -> VolumeState:
        return self._state

    def add_samples(self, samples: np.ndarray) -> list[AudioCue]:
        """Consume continuous mono PCM and return new/extended style metadata."""
        chunk = np.asarray(samples, dtype=np.float32)
        if chunk.ndim != 1:
            raise ValueError("live volume PCM must be mono")
        if not np.isfinite(chunk).all():
            raise ValueError("live volume PCM contains NaN or infinite samples")
        if chunk.size:
            self._samples = np.concatenate((self._samples, chunk))
            self.total_samples += int(chunk.size)

        cues: list[AudioCue] = []
        buffered_end = self._buffer_start + self._samples.size
        while self._next_frame_start + self.frame_samples <= buffered_end:
            relative_start = self._next_frame_start - self._buffer_start
            relative_end = relative_start + self.frame_samples
            start_sample = self._next_frame_start
            end_sample = start_sample + self.frame_samples
            frame = self._samples[relative_start:relative_end]
            cue = self._analyze_frame(frame, start_sample, end_sample)
            if cue is not None:
                cues.append(cue)
            self._next_frame_start = end_sample

        discard_count = self._next_frame_start - self._buffer_start
        if discard_count > 0:
            self._samples = self._samples[discard_count:].copy()
            self._buffer_start = self._next_frame_start
        return cues

    def _analyze_frame(
        self,
        frame: np.ndarray,
        start_sample: int,
        end_sample: int,
    ) -> AudioCue | None:
        raw_level = dbfs(frame)
        if raw_level <= SILENCE_DBFS:
            self._recent_levels.clear()
            self._clear_candidate()
            self._state = "inactive"
            logger.info("[Volume] raw=%.1f state=inactive", raw_level)
            return None

        self._recent_levels.append(raw_level)
        smoothed_level = float(np.mean(self._recent_levels))
        target_state = self._classify_level(smoothed_level)

        if target_state == self._state:
            self._clear_candidate()
            cue = self._style_cue(
                target_state,
                self._active_style_start,
                end_sample,
                smoothed_level,
            )
            self._log_active(raw_level, smoothed_level)
            return cue

        if self._candidate_state == target_state:
            self._candidate_samples += self.frame_samples
        else:
            self._candidate_state = target_state
            self._candidate_start = start_sample
            self._candidate_samples = self.frame_samples

        if self._candidate_samples < self.persistence_samples:
            self._log_active(raw_level, smoothed_level)
            return None

        self._state = target_state
        self._active_style_start = self._candidate_start
        self._clear_candidate()
        cue = self._style_cue(
            target_state,
            self._active_style_start,
            end_sample,
            smoothed_level,
        )
        self._log_active(raw_level, smoothed_level)
        return cue

    @staticmethod
    def _classify_level(level: float) -> VolumeState:
        if level <= SILENCE_DBFS:
            return "inactive"
        if level < EXTRA_SMALL_TEXT_MAX_DBFS:
            return "xsmall"
        if level < SMALL_TEXT_MAX_DBFS:
            return "small"
        if level > EXTRA_LARGE_TEXT_MIN_DBFS:
            return "xlarge"
        if level > LARGE_TEXT_MIN_DBFS:
            return "large"
        return "normal"

    def _clear_candidate(self) -> None:
        self._candidate_state = None
        self._candidate_samples = 0

    def _style_cue(
        self,
        state: VolumeState,
        start_sample: int,
        end_sample: int,
        smoothed_level: float,
    ) -> AudioCue | None:
        if state not in ("xsmall", "small", "large", "xlarge"):
            return None

        if state == "xsmall":
            distance = EXTRA_SMALL_TEXT_MAX_DBFS - smoothed_level
            label: VolumeLabel = "volume_xsmall"
        elif state == "small":
            distance = SMALL_TEXT_MAX_DBFS - smoothed_level
            label = "volume_small"
        elif state == "large":
            distance = smoothed_level - LARGE_TEXT_MIN_DBFS
            label = "volume_large"
        else:
            distance = smoothed_level - EXTRA_LARGE_TEXT_MIN_DBFS
            label = "volume_xlarge"

        # This is a bounded style-strength indicator, not a probability.
        confidence = min(1.0, 0.6 + max(0.0, distance) / 20.0 * 0.4)
        return AudioCue(
            start=start_sample / self.sample_rate,
            end=end_sample / self.sample_rate,
            category="prosody",
            label=label,
            confidence=confidence,
        )

    def _log_active(self, raw_level: float, smoothed_level: float) -> None:
        logger.info(
            "[Volume] raw=%.1f smoothed=%.1f state=%s",
            raw_level,
            smoothed_level,
            self._state,
        )
