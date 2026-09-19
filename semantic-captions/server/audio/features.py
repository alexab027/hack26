"""Low-level acoustic feature helpers shared by analysis modules."""


def extract_features(audio_window: object) -> object:
    """Eventually compute only the pitch, energy, tempo, or spectral features needed."""
    # TODO: Select a feature library and document units and expected input shape.
    raise NotImplementedError("Feature extraction is not implemented.")

