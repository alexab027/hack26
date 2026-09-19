"""Convert file or array audio to model-ready mono 16 kHz float arrays."""

from io import BytesIO
from pathlib import Path
import shutil
import subprocess

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

TARGET_SAMPLE_RATE = 16_000


def preprocess_audio(
    audio: np.ndarray, sample_rate: int, target_sample_rate: int = TARGET_SAMPLE_RATE
) -> tuple[np.ndarray, int]:
    """Return finite, peak-normalized mono float32 audio at the target rate."""
    if sample_rate <= 0 or target_sample_rate <= 0:
        raise ValueError("sample rates must be positive")

    waveform = np.asarray(audio)
    if waveform.ndim == 2:
        waveform = waveform.mean(axis=1)
    elif waveform.ndim != 1:
        raise ValueError("audio must be a mono vector or a frames-by-channels matrix")
    if waveform.size == 0:
        raise ValueError("audio is empty")

    waveform = waveform.astype(np.float32, copy=False)
    if not np.isfinite(waveform).all():
        raise ValueError("audio contains NaN or infinite samples")

    if sample_rate != target_sample_rate:
        divisor = np.gcd(sample_rate, target_sample_rate)
        waveform = resample_poly(
            waveform, target_sample_rate // divisor, sample_rate // divisor
        ).astype(np.float32, copy=False)

    peak = float(np.max(np.abs(waveform)))
    if peak > 1.0:
        waveform = waveform / peak

    return np.ascontiguousarray(waveform, dtype=np.float32), target_sample_rate


def load_audio_file(path: str | Path) -> tuple[np.ndarray, int]:
    """Load a local recording, using ffmpeg only for iPhone-style M4A files."""
    audio_path = Path(path)
    if audio_path.suffix.casefold() == ".m4a":
        audio, sample_rate = _load_m4a_with_ffmpeg(audio_path)
    else:
        audio, sample_rate = sf.read(audio_path, always_2d=False)
    return preprocess_audio(audio, sample_rate)


def _load_m4a_with_ffmpeg(path: Path) -> tuple[np.ndarray, int]:
    """Decode an M4A recording to in-memory WAV without adding a Python framework."""
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        raise RuntimeError(
            "M4A decoding requires ffmpeg. Install it once with: "
            "winget install --id Gyan.FFmpeg --exact --source winget"
        )

    result = subprocess.run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(path),
            "-vn",
            "-f",
            "wav",
            "-acodec",
            "pcm_f32le",
            "pipe:1",
        ],
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        details = result.stderr.decode("utf-8", errors="replace").strip()
        raise ValueError(f"ffmpeg could not decode {path}: {details}")

    audio, sample_rate = sf.read(BytesIO(result.stdout), always_2d=False)
    return audio, sample_rate


def load_audio_bytes(data: bytes) -> tuple[np.ndarray, int]:
    """Decode an uploaded WAV/FLAC/OGG payload, then preprocess it."""
    if not data:
        raise ValueError("audio upload is empty")
    audio, sample_rate = sf.read(BytesIO(data), always_2d=False)
    return preprocess_audio(audio, sample_rate)
