"""Convert incoming audio to model-ready mono, resampled, normalized arrays/tensors."""


def preprocess_audio(raw_audio: bytes, sample_rate: int) -> object:
    """Decode and normalize one incoming chunk or analysis window."""
    # TODO: Decide the browser encoding, target sample rate, array type, and validation.
    raise NotImplementedError("Audio preprocessing is not implemented.")

