import json

import numpy as np
import pytest
from fastapi.testclient import TestClient

from server.audio.windows import AudioWindow
from server.analysis.emotion import EmotionAnalysis
from server.live_audio import (
    LiveCueMerger,
    LivePcmBuffer,
    _parse_start_message,
    analyze_live_window,
)
from server.main import app
from server.schemas import AudioCue


def test_pcm_buffer_emits_two_second_windows_with_one_second_hop() -> None:
    buffer = LivePcmBuffer(sample_rate=10)

    assert buffer.add_samples(np.arange(15, dtype=np.float32)) == []
    first = buffer.add_samples(np.arange(15, 25, dtype=np.float32))
    second = buffer.add_samples(np.arange(25, 30, dtype=np.float32))

    assert [(window.start, window.end) for window in first + second] == [
        (0.0, 2.0),
        (1.0, 3.0),
    ]
    assert np.array_equal(first[0].samples, np.arange(20, dtype=np.float32))
    assert np.array_equal(second[0].samples, np.arange(10, 30, dtype=np.float32))
    assert buffer.total_samples == 30
    assert buffer.next_window_start == 20


def test_pcm_byte_buffer_uses_little_endian_float32() -> None:
    buffer = LivePcmBuffer(sample_rate=2, window_seconds=1, hop_seconds=1)
    windows = buffer.add_bytes(np.array([0.25, -0.5], dtype="<f4").tobytes())

    assert len(windows) == 1
    assert windows[0].start == 0.0
    assert windows[0].end == 1.0
    assert np.allclose(windows[0].samples, [0.25, -0.5])


def test_live_merger_extends_overlap_and_uses_maximum_confidence() -> None:
    merger = LiveCueMerger()
    first = AudioCue(
        start=5, end=7, category="environment", label="laughter", confidence=0.16
    )
    second = AudioCue(
        start=6, end=8, category="environment", label="laughter", confidence=0.21
    )

    assert merger.add(first) == first
    assert merger.add(second) == AudioCue(
        start=5, end=8, category="environment", label="laughter", confidence=0.21
    )


def test_live_merger_does_not_duplicate_an_unchanged_update() -> None:
    merger = LiveCueMerger()
    cue = AudioCue(
        start=1, end=3, category="environment", label="cough", confidence=0.8
    )

    assert merger.add(cue) == cue
    assert merger.add(cue) is None


def test_live_window_is_resampled_without_changing_session_timestamps(
    monkeypatch,
) -> None:
    captured: list[AudioWindow] = []

    def fake_analyze(
        window: AudioWindow, model: object, confidence_threshold: float
    ) -> list[AudioCue]:
        captured.append(window)
        assert confidence_threshold == 0.15
        return []

    monkeypatch.setattr("server.live_audio.analyze_sounds", fake_analyze)
    native_window = AudioWindow(
        samples=np.zeros(96_000, dtype=np.float32),
        sample_rate=48_000,
        start=3.0,
        end=5.0,
    )

    assert analyze_live_window(native_window, object()) == []
    assert len(captured[0].samples) == 32_000
    assert captured[0].sample_rate == 16_000
    assert captured[0].start == 3.0
    assert captured[0].end == 5.0


def test_websocket_serializes_audio_cue_without_model_download(monkeypatch) -> None:
    def fake_analyze(window: AudioWindow, model: object) -> list[AudioCue]:
        assert window.start == 0.0
        assert window.end == 2.0
        assert window.sample_rate == 16_000
        return [
            AudioCue(
                start=window.start,
                end=window.end,
                category="environment",
                label="laughter",
                confidence=0.42,
            )
        ]

    monkeypatch.setattr("server.live_audio.analyze_live_window", fake_analyze)
    monkeypatch.setattr("server.main.sound_model.warm_up", lambda: None)
    monkeypatch.setattr("server.main.emotion_model.warm_up", lambda: None)
    samples = np.zeros(32_000, dtype="<f4")

    with TestClient(app).websocket_connect("/ws/analyze") as websocket:
        websocket.send_json(
            {"type": "start", "sample_rate": 16_000, "session_id": "offline-test"}
        )
        websocket.send_bytes(samples.tobytes())
        assert websocket.receive_json() == {
            "type": "audio_cue",
            "start": 0.0,
            "end": 2.0,
            "category": "environment",
            "label": "laughter",
            "confidence": 0.42,
        }
        websocket.send_json({"type": "stop"})


def test_start_message_enables_volume_only_when_explicitly_requested() -> None:
    base = {"type": "start", "sample_rate": 16_000, "session_id": "test"}

    assert _parse_start_message(json.dumps(base)) == (16_000, "test", False, False)
    assert _parse_start_message(json.dumps({**base, "enable_volume": True})) == (
        16_000,
        "test",
        True,
        False,
    )
    assert _parse_start_message(json.dumps({**base, "enable_emotion": True})) == (
        16_000,
        "test",
        False,
        True,
    )


def test_websocket_emits_nearby_volume_style_without_waiting_for_ast(monkeypatch) -> None:
    monkeypatch.setattr("server.live_audio.analyze_live_window", lambda *_: [])
    monkeypatch.setattr("server.main.sound_model.warm_up", lambda: None)
    monkeypatch.setattr("server.main.emotion_model.warm_up", lambda: None)
    normal = np.full(6_400, 10 ** (-30 / 20), dtype="<f4")
    loud = np.full(9_600, 10 ** (-14 / 20), dtype="<f4")

    with TestClient(app).websocket_connect("/ws/analyze") as websocket:
        websocket.send_json(
            {
                "type": "start",
                "sample_rate": 16_000,
                "session_id": "nearby-volume-test",
                "enable_volume": True,
            }
        )
        websocket.send_bytes(np.concatenate((normal, loud)).tobytes())

        cue = websocket.receive_json()
        assert cue["type"] == "audio_cue"
        assert cue["category"] == "prosody"
        assert cue["label"] == "volume_large"
        assert cue["start"] == pytest.approx(0.6)
        assert cue["end"] == pytest.approx(1.0)
        websocket.send_json({"type": "stop"})


def test_websocket_emits_persistent_nearby_emotion_alert(monkeypatch) -> None:
    monkeypatch.setattr("server.live_audio.analyze_live_window", lambda *_: [])
    monkeypatch.setattr("server.main.sound_model.warm_up", lambda: None)
    monkeypatch.setattr("server.main.emotion_model.warm_up", lambda: None)
    result = EmotionAnalysis(
        label="angry_sounding",
        confidence=0.81,
        raw_label="ang",
        scores={
            "neutral": 0.10,
            "positive_sounding": 0.03,
            "angry_sounding": 0.81,
            "sad_sounding": 0.06,
        },
        raw_scores={"neu": 0.10, "hap": 0.03, "ang": 0.81, "sad": 0.06},
        future_alert="Angry-sounding speech detected",
    )
    monkeypatch.setattr(
        "server.live_audio.analyze_live_emotion_window", lambda *_: result
    )
    samples = np.zeros(48_000, dtype="<f4")

    with TestClient(app).websocket_connect("/ws/analyze") as websocket:
        websocket.send_json(
            {
                "type": "start",
                "sample_rate": 16_000,
                "session_id": "nearby-emotion-test",
                "enable_emotion": True,
            }
        )
        websocket.send_bytes(samples.tobytes())
        assert websocket.receive_json() == {
            "type": "audio_cue",
            "start": 1.0,
            "end": 3.0,
            "category": "emotion",
            "label": "angry_sounding",
            "confidence": 0.81,
        }
        websocket.send_json({"type": "stop"})
