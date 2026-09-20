import sys

import numpy as np

from server import emotion_cli
from server.models.emotion_model import EmotionPrediction


class FakeEmotionModel:
    model_id = "superb/wav2vec2-base-superb-er"

    def predict(
        self, audio: np.ndarray, sample_rate: int
    ) -> list[EmotionPrediction]:
        return [
            EmotionPrediction("ang", 0.81),
            EmotionPrediction("neu", 0.10),
            EmotionPrediction("sad", 0.06),
            EmotionPrediction("hap", 0.03),
        ]


def test_emotion_cli_prints_complete_offline_diagnostics(monkeypatch, capsys) -> None:
    monkeypatch.setattr(
        emotion_cli,
        "load_audio_file",
        lambda path: (np.zeros(32_000, dtype=np.float32), 16_000),
    )
    monkeypatch.setattr(emotion_cli, "EmotionModel", FakeEmotionModel)
    monkeypatch.setattr(sys, "argv", ["server.emotion_cli", "example.wav"])

    emotion_cli.main()
    output = capsys.readouterr().out

    assert "Model: superb/wav2vec2-base-superb-er" in output
    assert "Sample rate: 16000 Hz" in output
    assert "Audio duration: 2.00 sec" in output
    assert "angry_sounding       0.810000" in output
    assert "neutral              0.100000" in output
    assert "sad_sounding         0.060000" in output
    assert "positive_sounding    0.030000" in output
    assert "raw class: ang" in output
    assert "mapped label: angry_sounding" in output
    assert "confidence=0.810000" in output
    assert '"Angry-sounding speech detected"' in output
