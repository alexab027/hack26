from io import BytesIO
from types import SimpleNamespace

import numpy as np
import pytest
import soundfile as sf

from server.analysis.sounds import (
    canonical_sound_label,
    cues_from_predictions,
    merge_overlapping_cues,
)
from server.analysis.semantic_aliases import SEMANTIC_ALIAS_GROUPS
from server.audio import preprocess
from server.audio.preprocess import load_audio_file, preprocess_audio
from server.audio.windows import AudioWindow, iter_windows
from server.models.sound_model import SoundPrediction
from server.schemas import AudioCue


def test_preprocess_downmixes_resamples_and_normalizes() -> None:
    stereo = np.column_stack((np.full(8_000, 2.0), np.zeros(8_000)))
    audio, sample_rate = preprocess_audio(stereo, 8_000)

    assert sample_rate == 16_000
    assert audio.dtype == np.float32
    assert audio.ndim == 1
    assert len(audio) == 16_000
    assert np.max(np.abs(audio)) <= 1.0


def test_load_audio_file_continues_to_support_wav(tmp_path) -> None:
    path = tmp_path / "recording.wav"
    sf.write(path, np.zeros(8_000, dtype=np.float32), 8_000)

    audio, sample_rate = load_audio_file(path)

    assert sample_rate == 16_000
    assert len(audio) == 16_000


def test_m4a_explains_required_ffmpeg_setup(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(preprocess.shutil, "which", lambda name: None)

    with pytest.raises(RuntimeError, match=r"winget install --id Gyan\.FFmpeg"):
        load_audio_file(tmp_path / "voice-memo.m4a")


def test_m4a_uses_ffmpeg_output_then_existing_preprocessing(monkeypatch, tmp_path) -> None:
    decoded_wav = BytesIO()
    sf.write(decoded_wav, np.zeros(8_000, dtype=np.float32), 8_000, format="WAV")
    monkeypatch.setattr(preprocess.shutil, "which", lambda name: "ffmpeg")
    monkeypatch.setattr(
        preprocess.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(
            returncode=0, stdout=decoded_wav.getvalue(), stderr=b""
        ),
    )

    audio, sample_rate = load_audio_file(tmp_path / "voice-memo.m4a")

    assert sample_rate == 16_000
    assert len(audio) == 16_000


def test_windows_have_deterministic_timestamps_and_partial_tail() -> None:
    audio = np.zeros(11, dtype=np.float32)
    windows = iter_windows(audio, sample_rate=2, window_seconds=2, hop_seconds=1.5)

    assert [(window.start, window.end) for window in windows] == [
        (0.0, 2.0),
        (1.5, 3.5),
        (3.0, 5.0),
        (4.5, 5.5),
    ]


def test_default_windows_are_two_seconds_with_one_second_overlap() -> None:
    audio = np.zeros(5, dtype=np.float32)

    windows = iter_windows(audio, sample_rate=1)

    assert [(window.start, window.end) for window in windows] == [
        (0.0, 2.0),
        (1.0, 3.0),
        (2.0, 4.0),
        (3.0, 5.0),
    ]


def test_laughter_aliases_produce_one_cue_using_maximum_not_sum() -> None:
    window = AudioWindow(np.zeros(10, dtype=np.float32), 10, 1.0, 2.0)
    predictions = [
        SoundPrediction("Laughter", 0.81),
        SoundPrediction("Giggle", 0.55),
        SoundPrediction("Music", 0.99),
        SoundPrediction("Siren", 0.10),
    ]

    cues = cues_from_predictions(predictions, window, confidence_threshold=0.2)

    assert len(cues) == 1
    assert cues[0].label == "laughter"
    assert cues[0].confidence == 0.81


@pytest.mark.parametrize(
    ("raw_label", "semantic_label"),
    [
        ("Shout", "shout"),
        ("Yell", "shout"),
        ("Whispering", "whispering"),
        ("Laughter", "laughter"),
        ("Giggle", "laughter"),
        ("Crying, sobbing", "crying"),
        ("Sigh", "sigh"),
        ("Humming", "humming"),
        ("Groan", "groan"),
        ("Breathing", "breathing"),
        ("Wheeze", "wheeze"),
        ("Gasp", "gasp"),
        ("Pant", "pant"),
        ("Cough", "cough"),
        ("Throat clearing", "throat_clearing"),
        ("Sneeze", "sneeze"),
        ("Sniff", "sniff"),
        ("Chatter", "chatter"),
        ("Hubbub, speech noise, speech babble", "chatter"),
        ("Background music", "background_music"),
        ("Vehicle horn, car horn, honking", "car_horn"),
        ("Siren", "siren"),
        ("Knock", "door_knock"),
        ("Telephone bell ringing", "phone_ringing"),
    ],
)
def test_exact_audioset_labels_map_to_semantic_cues(
    raw_label: str, semantic_label: str
) -> None:
    assert canonical_sound_label(raw_label) == semantic_label


@pytest.mark.parametrize("raw_label", ["Engine knocking", "Mains hum", "Music"])
def test_similar_but_unintended_labels_are_not_mapped(raw_label: str) -> None:
    assert canonical_sound_label(raw_label) is None


def test_requested_semantic_cues_all_have_source_labels() -> None:
    requested = {
        "shout",
        "whispering",
        "laughter",
        "crying",
        "sigh",
        "humming",
        "groan",
        "breathing",
        "wheeze",
        "gasp",
        "pant",
        "cough",
        "throat_clearing",
        "sneeze",
        "sniff",
        "chatter",
        "background_music",
    }

    assert requested <= SEMANTIC_ALIAS_GROUPS.keys()
    assert all(SEMANTIC_ALIAS_GROUPS[label] for label in requested)


def test_cough_and_throat_clearing_remain_separate() -> None:
    window = AudioWindow(np.zeros(10, dtype=np.float32), 10, 0.0, 1.0)
    predictions = [
        SoundPrediction("Cough", 0.7),
        SoundPrediction("Throat clearing", 0.6),
    ]

    cues = cues_from_predictions(predictions, window, confidence_threshold=0.15)

    assert [(cue.label, cue.confidence) for cue in cues] == [
        ("cough", 0.7),
        ("throat_clearing", 0.6),
    ]


def test_audio_cue_rejects_invalid_interval() -> None:
    with pytest.raises(ValueError):
        AudioCue(
            start=2,
            end=1,
            category="environment",
            label="siren",
            confidence=0.9,
        )


def test_overlapping_duplicate_cues_are_merged() -> None:
    cues = [
        AudioCue(start=0, end=2, category="environment", label="laughter", confidence=0.6),
        AudioCue(start=1, end=3, category="environment", label="laughter", confidence=0.8),
        AudioCue(start=3, end=4, category="environment", label="siren", confidence=0.7),
    ]

    merged = merge_overlapping_cues(cues)

    assert [(cue.label, cue.start, cue.end) for cue in merged] == [
        ("laughter", 0.0, 3.0),
        ("siren", 3.0, 4.0),
    ]
    assert merged[0].confidence == 0.8
