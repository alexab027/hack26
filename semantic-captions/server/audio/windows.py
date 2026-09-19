"""Split continuous audio into short, overlapping, timestamped analysis windows."""

from dataclasses import dataclass

import numpy as np

DEFAULT_WINDOW_SECONDS = 2.0
DEFAULT_HOP_SECONDS = 1.0


@dataclass(frozen=True, slots=True)
class AudioWindow:
    samples: np.ndarray
    sample_rate: int
    start: float
    end: float


def iter_windows(
    audio: np.ndarray,
    sample_rate: int,
    window_seconds: float = DEFAULT_WINDOW_SECONDS,
    hop_seconds: float = DEFAULT_HOP_SECONDS,
) -> list[AudioWindow]:
    """Create timestamped windows, including one final partial window."""
    if audio.ndim != 1:
        raise ValueError("windowing expects mono audio")
    if sample_rate <= 0 or window_seconds <= 0 or hop_seconds <= 0:
        raise ValueError("sample rate, window length, and hop length must be positive")
    if audio.size == 0:
        return []

    window_size = max(1, round(window_seconds * sample_rate))
    hop_size = max(1, round(hop_seconds * sample_rate))
    windows: list[AudioWindow] = []

    for start_sample in range(0, audio.size, hop_size):
        end_sample = min(start_sample + window_size, audio.size)
        windows.append(
            AudioWindow(
                samples=audio[start_sample:end_sample],
                sample_rate=sample_rate,
                start=start_sample / sample_rate,
                end=end_sample / sample_rate,
            )
        )
        if end_sample == audio.size:
            break

    return windows
