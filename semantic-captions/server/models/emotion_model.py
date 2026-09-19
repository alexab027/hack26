"""Load and wrap the selected pretrained speech-expression model."""


class EmotionModel:
    """Keep heavyweight loading separate from inference and business logic."""

    def load(self) -> None:
        """Load model weights when explicitly requested by application startup."""
        # TODO: Select a model, cache location, device policy, and label mapping.
        raise NotImplementedError("Emotion model loading is not implemented.")

