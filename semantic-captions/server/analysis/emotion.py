"""Offline vocal-expression analysis for preprocessed speech recordings.

Results describe how speech sounds acoustically. They are not claims about a
speaker's internal emotional or psychological state.
"""

from dataclasses import dataclass
from types import MappingProxyType
from typing import Mapping

import numpy as np

from server.models.emotion_model import EmotionModel
from server.schemas import AudioCue


RAW_EMOTION_LABELS: Mapping[str, str] = MappingProxyType(
    {
        "neu": "neutral",
        "hap": "positive_sounding",
        "ang": "angry_sounding",
        "sad": "sad_sounding",
    }
)

FUTURE_ALERT_TEXT: Mapping[str, str] = MappingProxyType(
    {
        "positive_sounding": "Positive vocal expression detected",
        "angry_sounding": "Angry-sounding speech detected",
        "sad_sounding": "Sad-sounding speech detected",
    }
)

# Initial live-demo tuning. Requiring two overlapping windows reduces brief
# one-window classification spikes while keeping latency near three seconds.
LIVE_EMOTION_CONFIDENCE_THRESHOLD = 0.55
LIVE_EMOTION_LABEL_THRESHOLDS: Mapping[str, float] = MappingProxyType(
    {
        "angry_sounding": 0.70,
        "sad_sounding": 0.45,
    }
)
LIVE_EMOTION_PERSISTENCE_WINDOWS = 2
LIVE_EMOTION_COOLDOWN_SECONDS = 8.0
EMOTIONAL_SHIFT_LABEL = "emotional_shift"


@dataclass(frozen=True, slots=True)
class EmotionAnalysis:
    """A single-clip result suitable for later sequential comparison."""

    label: str
    confidence: float
    raw_label: str
    scores: dict[str, float]
    raw_scores: dict[str, float]
    future_alert: str | None


class LiveEmotionTracker:
    """Turn sequential expression results into persistent, cooldown-limited cues."""

    def __init__(
        self,
        confidence_threshold: float = LIVE_EMOTION_CONFIDENCE_THRESHOLD,
        persistence_windows: int = LIVE_EMOTION_PERSISTENCE_WINDOWS,
        cooldown_seconds: float = LIVE_EMOTION_COOLDOWN_SECONDS,
    ) -> None:
        if not 0 <= confidence_threshold <= 1:
            raise ValueError("emotion confidence threshold must be between 0 and 1")
        if persistence_windows <= 0:
            raise ValueError("emotion persistence must be positive")
        if cooldown_seconds < 0:
            raise ValueError("emotion cooldown cannot be negative")
        self.confidence_threshold = confidence_threshold
        self.persistence_windows = persistence_windows
        self.cooldown_seconds = cooldown_seconds
        self._candidate_label: str | None = None
        self._candidate_count = 0
        self._stable_label: str | None = None
        self._stable_confidence = 0.0
        self._last_emitted_at: dict[str, float] = {}

    def add(
        self,
        result: EmotionAnalysis,
        start: float,
        end: float,
    ) -> list[AudioCue]:
        """Observe one window and emit expression/shift alerts when stable."""
        required_confidence = LIVE_EMOTION_LABEL_THRESHOLDS.get(
            result.label, self.confidence_threshold
        )
        if result.confidence < required_confidence:
            self._candidate_label = None
            self._candidate_count = 0
            return []

        if result.label == self._candidate_label:
            self._candidate_count += 1
        else:
            self._candidate_label = result.label
            self._candidate_count = 1

        if self._candidate_count < self.persistence_windows:
            return []

        previous_label = self._stable_label
        previous_confidence = self._stable_confidence
        changed = previous_label is not None and previous_label != result.label
        if previous_label != result.label:
            self._stable_label = result.label
            self._stable_confidence = result.confidence
        else:
            self._stable_confidence = max(self._stable_confidence, result.confidence)

        cues: list[AudioCue] = []
        if changed and self._can_emit(EMOTIONAL_SHIFT_LABEL, end):
            cues.append(
                AudioCue(
                    start=start,
                    end=end,
                    category="emotion",
                    label=EMOTIONAL_SHIFT_LABEL,
                    confidence=min(previous_confidence, result.confidence),
                )
            )
            self._last_emitted_at[EMOTIONAL_SHIFT_LABEL] = end

        if result.label != "neutral" and self._can_emit(result.label, end):
            cues.append(
                AudioCue(
                    start=start,
                    end=end,
                    category="emotion",
                    label=result.label,
                    confidence=result.confidence,
                )
            )
            self._last_emitted_at[result.label] = end
        return cues

    def _can_emit(self, label: str, end: float) -> bool:
        last_emitted = self._last_emitted_at.get(label)
        return (
            last_emitted is None
            or end - last_emitted >= self.cooldown_seconds
        )


def canonical_emotion_label(raw_label: str) -> str:
    """Map an exact checkpoint label, failing explicitly for unknown classes."""
    try:
        return RAW_EMOTION_LABELS[raw_label]
    except KeyError as exc:
        raise ValueError(f"unknown emotion-model label: {raw_label!r}") from exc


def future_alert_for(label: str) -> str | None:
    """Return cautious future product language; neutral intentionally has none."""
    if label == "neutral":
        return None
    try:
        return FUTURE_ALERT_TEXT[label]
    except KeyError as exc:
        raise ValueError(f"unknown internal expression label: {label!r}") from exc


def analyze_emotion(
    audio: np.ndarray,
    sample_rate: int,
    model: EmotionModel,
) -> EmotionAnalysis:
    """Classify one preprocessed speech clip without thresholding its scores."""
    predictions = model.predict(audio, sample_rate)
    if not predictions:
        raise ValueError("emotion model returned no predictions")

    raw_scores: dict[str, float] = {}
    scores: dict[str, float] = {}
    for prediction in predictions:
        internal_label = canonical_emotion_label(prediction.label)
        raw_scores[prediction.label] = prediction.score
        scores[internal_label] = prediction.score

    strongest = max(predictions, key=lambda prediction: prediction.score)
    label = canonical_emotion_label(strongest.label)
    return EmotionAnalysis(
        label=label,
        confidence=strongest.score,
        raw_label=strongest.label,
        scores=scores,
        raw_scores=raw_scores,
        future_alert=future_alert_for(label),
    )
