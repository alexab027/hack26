"""Load and wrap the selected pretrained environmental sound classifier."""


class SoundModel:
    """Provide a future stable interface independent of the chosen model library."""

    def load(self) -> None:
        """Load model weights without committing them to the repository."""
        # TODO: Select a classifier, device policy, cache path, and relevant labels.
        raise NotImplementedError("Sound model loading is not implemented.")

