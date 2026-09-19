"""Estimate vocal-expression labels from short speech windows.

Predictions must be presented as uncertain acoustic observations, not absolute
claims about a speaker's internal emotional or psychological state.
"""


def analyze_emotion(audio_window: object) -> list[object]:
    """Return timestamped expression cues after a model is selected."""
    # TODO: Call the model wrapper and return calibrated AudioCue objects.
    raise NotImplementedError("Emotion analysis is not implemented.")

