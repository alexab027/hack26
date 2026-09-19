import json
import sys

import numpy as np
import pytest

from server import cli
from server.models.sound_model import SoundPrediction


class FakeSoundModel:
    def predict(self, audio: np.ndarray, sample_rate: int) -> list[SoundPrediction]:
        print("model diagnostic", file=sys.stderr)
        return [
            SoundPrediction("Music", 0.9),
            SoundPrediction("Laughter", 0.8),
            SoundPrediction("Giggle", 0.1),
        ]


def test_cli_prints_raw_mapped_and_final_predictions(monkeypatch, capsys) -> None:
    monkeypatch.setattr(
        cli, "load_audio_file", lambda path: (np.zeros(16_000, dtype=np.float32), 16_000)
    )
    monkeypatch.setattr(cli, "SoundModel", FakeSoundModel)
    monkeypatch.setattr(
        sys,
        "argv",
        ["server.cli", "example.wav", "--threshold", "0.2", "--top", "2"],
    )

    cli.main()
    output = capsys.readouterr().out

    assert "Window 1  0.00-1.00 sec" in output
    assert "Raw predictions:" in output
    assert "Mapped semantic cues:" in output
    assert "laughter = 0.800000" in output
    assert "Laughter" in output
    assert "Giggle" in output
    assert "Rejected semantic cues (< 0.200):" in output
    assert "Final merged cues:" in output
    assert "0.00-1.00 sec  [laughter]  confidence=0.800000" in output


def test_cli_json_is_clean_timestamped_audio_cue_output(monkeypatch, capsys) -> None:
    monkeypatch.setattr(
        cli, "load_audio_file", lambda path: (np.zeros(16_000, dtype=np.float32), 16_000)
    )
    monkeypatch.setattr(cli, "SoundModel", FakeSoundModel)
    monkeypatch.setattr(
        sys,
        "argv",
        ["server.cli", "example.wav", "--threshold", "0.2", "--json"],
    )

    cli.main()
    captured = capsys.readouterr()
    payload = json.loads(captured.out)

    assert captured.err == ""
    assert payload == [
        {
            "type": "audio_cue",
            "start": 0.0,
            "end": 1.0,
            "category": "environment",
            "label": "laughter",
            "confidence": 0.8,
        }
    ]


def test_cli_reports_audio_loading_errors_without_traceback(monkeypatch, capsys) -> None:
    monkeypatch.setattr(
        cli,
        "load_audio_file",
        lambda path: (_ for _ in ()).throw(RuntimeError("install ffmpeg")),
    )
    monkeypatch.setattr(sys, "argv", ["server.cli", "voice-memo.m4a"])

    with pytest.raises(SystemExit) as error:
        cli.main()

    assert error.value.code == 1
    assert capsys.readouterr().err == "error: install ffmpeg\n"
