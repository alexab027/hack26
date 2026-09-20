import numpy as np
import pytest

from server.analysis.emotion import (
    EmotionAnalysis,
    LiveEmotionTracker,
    analyze_emotion,
    canonical_emotion_label,
    future_alert_for,
)
from server.models.emotion_model import EmotionPrediction


class FakeEmotionModel:
    def __init__(self, predictions: list[EmotionPrediction]) -> None:
        self.predictions = predictions

    def predict(
        self, audio: np.ndarray, sample_rate: int
    ) -> list[EmotionPrediction]:
        return self.predictions


@pytest.mark.parametrize(
    ("raw_label", "internal_label"),
    [
        ("ang", "angry_sounding"),
        ("sad", "sad_sounding"),
        ("hap", "positive_sounding"),
        ("neu", "neutral"),
    ],
)
def test_raw_checkpoint_labels_map_to_cautious_internal_labels(
    raw_label: str, internal_label: str
) -> None:
    assert canonical_emotion_label(raw_label) == internal_label


def test_unknown_raw_label_fails_explicitly() -> None:
    with pytest.raises(ValueError, match="unknown emotion-model label"):
        canonical_emotion_label("surprised")


def test_neutral_has_no_future_alert() -> None:
    assert future_alert_for("neutral") is None


def test_analysis_selects_strongest_and_preserves_all_scores() -> None:
    model = FakeEmotionModel(
        [
            EmotionPrediction("neu", 0.10),
            EmotionPrediction("hap", 0.03),
            EmotionPrediction("ang", 0.81),
            EmotionPrediction("sad", 0.06),
        ]
    )

    result = analyze_emotion(np.zeros(16_000, dtype=np.float32), 16_000, model)

    assert result.label == "angry_sounding"
    assert result.raw_label == "ang"
    assert result.confidence == 0.81
    assert result.scores == {
        "neutral": 0.10,
        "positive_sounding": 0.03,
        "angry_sounding": 0.81,
        "sad_sounding": 0.06,
    }
    assert result.raw_scores == {
        "neu": 0.10,
        "hap": 0.03,
        "ang": 0.81,
        "sad": 0.06,
    }
    assert result.future_alert == "Angry-sounding speech detected"


def test_analysis_rejects_unknown_model_output() -> None:
    model = FakeEmotionModel([EmotionPrediction("surprised", 1.0)])

    with pytest.raises(ValueError, match="unknown emotion-model label"):
        analyze_emotion(np.zeros(16_000, dtype=np.float32), 16_000, model)


def expression_result(label: str, confidence: float) -> EmotionAnalysis:
    raw_labels = {
        "neutral": "neu",
        "positive_sounding": "hap",
        "angry_sounding": "ang",
        "sad_sounding": "sad",
    }
    return EmotionAnalysis(
        label=label,
        confidence=confidence,
        raw_label=raw_labels[label],
        scores={label: confidence},
        raw_scores={raw_labels[label]: confidence},
        future_alert=future_alert_for(label),
    )


def test_live_tracker_requires_persistence_and_emits_cautious_expression_cue() -> None:
    tracker = LiveEmotionTracker(
        confidence_threshold=0.55, persistence_windows=2, cooldown_seconds=8
    )
    angry = expression_result("angry_sounding", 0.81)

    assert tracker.add(angry, 0, 2) == []
    cues = tracker.add(angry, 1, 3)

    assert [(cue.category, cue.label, cue.confidence) for cue in cues] == [
        ("emotion", "angry_sounding", 0.81)
    ]


def test_live_tracker_emits_shift_after_new_expression_becomes_stable() -> None:
    tracker = LiveEmotionTracker(
        confidence_threshold=0.55, persistence_windows=2, cooldown_seconds=8
    )
    neutral = expression_result("neutral", 0.80)
    sad = expression_result("sad_sounding", 0.76)
    tracker.add(neutral, 0, 2)
    tracker.add(neutral, 1, 3)

    assert tracker.add(sad, 2, 4) == []
    cues = tracker.add(sad, 3, 5)

    assert [cue.label for cue in cues] == ["emotional_shift", "sad_sounding"]
    assert cues[0].confidence == pytest.approx(0.76)


def test_live_tracker_ignores_low_confidence_windows() -> None:
    tracker = LiveEmotionTracker(confidence_threshold=0.55, persistence_windows=1)

    assert tracker.add(expression_result("positive_sounding", 0.54), 0, 2) == []


def test_live_tracker_uses_higher_threshold_for_angry_sounding() -> None:
    tracker = LiveEmotionTracker(confidence_threshold=0.55, persistence_windows=1)

    assert tracker.add(expression_result("angry_sounding", 0.69), 0, 2) == []
    cues = tracker.add(expression_result("angry_sounding", 0.70), 1, 3)

    assert [cue.label for cue in cues] == ["angry_sounding"]


def test_live_tracker_uses_lower_threshold_for_sad_sounding() -> None:
    tracker = LiveEmotionTracker(confidence_threshold=0.55, persistence_windows=1)

    assert tracker.add(expression_result("sad_sounding", 0.44), 0, 2) == []
    cues = tracker.add(expression_result("sad_sounding", 0.45), 1, 3)

    assert [cue.label for cue in cues] == ["sad_sounding"]
