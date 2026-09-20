from types import SimpleNamespace

import numpy as np
import pytest
import torch

from server.models.emotion_model import EmotionModel


class FakeFeatureExtractor:
    def __call__(self, audio, **options):
        assert audio.dtype == np.float32
        assert options == {"sampling_rate": 16_000, "return_tensors": "pt"}
        return {"input_values": torch.from_numpy(audio).unsqueeze(0)}


class FakeClassifier:
    config = SimpleNamespace(id2label={0: "neu", 1: "hap", 2: "ang", 3: "sad"})

    def __call__(self, **inputs):
        assert inputs["input_values"].device.type == "cpu"
        return SimpleNamespace(logits=torch.tensor([[1.0, 2.0, 4.0, 3.0]]))


def test_emotion_model_returns_all_normalized_scores_in_descending_order() -> None:
    model = EmotionModel()
    model._feature_extractor = FakeFeatureExtractor()
    model._model = FakeClassifier()
    model._torch = torch

    predictions = model.predict(np.zeros(16_000, dtype=np.float32), 16_000)

    assert [prediction.label for prediction in predictions] == [
        "ang",
        "sad",
        "hap",
        "neu",
    ]
    assert sum(prediction.score for prediction in predictions) == pytest.approx(1.0)


def test_emotion_model_requires_preprocessed_16khz_audio() -> None:
    model = EmotionModel()

    with pytest.raises(ValueError, match="16000 Hz"):
        model.predict(np.zeros(8_000, dtype=np.float32), 8_000)


def test_emotion_model_warmup_uses_a_two_second_silent_window(monkeypatch) -> None:
    model = EmotionModel()
    captured: list[tuple[np.ndarray, int]] = []
    monkeypatch.setattr(
        model,
        "predict",
        lambda audio, sample_rate: captured.append((audio, sample_rate)),
    )

    model.warm_up()

    assert captured[0][0].shape == (32_000,)
    assert captured[0][0].dtype == np.float32
    assert np.count_nonzero(captured[0][0]) == 0
    assert captured[0][1] == 16_000
