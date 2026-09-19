"""Split continuous audio into short, overlapping, timestamped analysis windows."""


def iter_windows(audio: object, window_seconds: float, hop_seconds: float) -> object:
    """Yield windows while retaining enough timing metadata for downstream merging."""
    # TODO: Implement deterministic boundaries and behavior for incomplete final windows.
    raise NotImplementedError("Audio windowing is not implemented.")

