"""Detect non-speech events such as horns, knocks, laughter, sirens, or barking."""

from collections.abc import Iterable

import numpy as np

from server.analysis.semantic_aliases import RAW_LABEL_TO_SEMANTIC
from server.audio.windows import (
    DEFAULT_HOP_SECONDS,
    DEFAULT_WINDOW_SECONDS,
    AudioWindow,
)
from server.models.sound_model import SoundModel, SoundPrediction
from server.schemas import AudioCue


def canonical_sound_label(model_label: str) -> str | None:
    """Map an exact checkpoint AudioSet label onto the UI vocabulary."""
    return RAW_LABEL_TO_SEMANTIC.get(model_label)


def group_semantic_evidence(
    predictions: Iterable[SoundPrediction],
) -> dict[str, list[SoundPrediction]]:
    """Group raw predictions by semantic cue, ordered strongest evidence first."""
    groups: dict[str, list[SoundPrediction]] = {}
    for prediction in predictions:
        semantic_label = canonical_sound_label(prediction.label)
        if semantic_label is not None:
            groups.setdefault(semantic_label, []).append(prediction)
    for evidence in groups.values():
        evidence.sort(key=lambda prediction: prediction.score, reverse=True)
    return groups


def cues_from_predictions(
    predictions: Iterable[SoundPrediction],
    audio_window: AudioWindow,
    confidence_threshold: float,
) -> list[AudioCue]:
    """Emit one cue per group using its strongest raw score, never a sum."""
    groups = group_semantic_evidence(predictions)
    strongest = {
        semantic_label: evidence[0].score
        for semantic_label, evidence in groups.items()
        if evidence[0].score >= confidence_threshold
    }

    return [
        AudioCue(
            start=audio_window.start,
            end=audio_window.end,
            category="environment",
            label=label,
            confidence=score,
        )
        for label, score in sorted(strongest.items(), key=lambda item: item[1], reverse=True)
    ]


def analyze_sounds(
    audio_window: AudioWindow,
    model: SoundModel,
    confidence_threshold: float = 0.15,
) -> list[AudioCue]:
    """Return useful environmental cues for one timestamped audio window."""
    predictions = model.predict(audio_window.samples, audio_window.sample_rate)
    return cues_from_predictions(predictions, audio_window, confidence_threshold)


def analyze_environmental_audio(
    audio: np.ndarray,
    sample_rate: int,
    model: SoundModel,
    confidence_threshold: float = 0.15,
    window_seconds: float = DEFAULT_WINDOW_SECONDS,
    hop_seconds: float = DEFAULT_HOP_SECONDS,
) -> list[AudioCue]:
    """Analyze a full preprocessed waveform using overlapping windows."""
    from server.audio.windows import iter_windows

    cues: list[AudioCue] = []
    for audio_window in iter_windows(
        audio, sample_rate, window_seconds=window_seconds, hop_seconds=hop_seconds
    ):
        cues.extend(analyze_sounds(audio_window, model, confidence_threshold))
    return merge_overlapping_cues(cues)


def merge_overlapping_cues(cues: Iterable[AudioCue]) -> list[AudioCue]:
    """Collapse repeat detections caused by overlapping analysis windows."""
    merged: list[AudioCue] = []
    ordered = sorted(cues, key=lambda cue: (cue.label, cue.start, cue.end))
    for cue in ordered:
        previous = merged[-1] if merged else None
        if previous and previous.label == cue.label and cue.start < previous.end:
            merged[-1] = AudioCue(
                start=previous.start,
                end=max(previous.end, cue.end),
                category="environment",
                label=cue.label,
                confidence=max(previous.confidence, cue.confidence),
            )
        else:
            merged.append(cue)
    return sorted(merged, key=lambda cue: (cue.start, cue.end, cue.label))
