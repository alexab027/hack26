"""Low-level acoustic feature helpers shared by analysis modules."""

from __future__ import annotations

import numpy as np

DBFS_EPSILON = 1e-8


def rms_energy(samples: np.ndarray) -> float:
    """Return root-mean-square digital amplitude for finite audio samples."""
    values = np.asarray(samples, dtype=np.float32)
    if values.size == 0:
        return 0.0
    if not np.isfinite(values).all():
        raise ValueError("audio samples must be finite")

    # Accumulate in float64 so the helper remains stable for unusual inputs.
    squared = np.square(values.astype(np.float64, copy=False))
    return float(np.sqrt(np.mean(squared)))


def dbfs(samples: np.ndarray) -> float:
    """Return digital level in dBFS, flooring silence at the epsilon level."""
    rms = rms_energy(samples)
    return float(20.0 * np.log10(max(rms, DBFS_EPSILON)))
