"""Lazy wrapper around an AudioSet environmental sound classifier."""

from dataclasses import dataclass
from typing import Any

import numpy as np


DEFAULT_MODEL_ID = "MIT/ast-finetuned-audioset-10-10-0.4593"


@dataclass(frozen=True, slots=True)
class SoundPrediction:
    label: str
    score: float


class SoundModel:
    """Load the model on first inference so health checks remain lightweight."""

    def __init__(self, model_id: str = DEFAULT_MODEL_ID) -> None:
        self.model_id = model_id
        self._classifier: Any | None = None

    def load(self) -> None:
        if self._classifier is not None:
            return
        try:
            from transformers import pipeline
        except ImportError as exc:
            raise RuntimeError(
                "Sound-model dependencies are missing. Install server/requirements.txt "
                "with Python 3.11 or 3.12."
            ) from exc
        self._classifier = pipeline(
            task="audio-classification",
            model=self.model_id,
            device=-1,
        )

    def predict(self, audio: np.ndarray, sample_rate: int) -> list[SoundPrediction]:
        """Return all model scores in descending order for one mono waveform."""
        self.load()
        results = self._classifier(
            {"raw": audio, "sampling_rate": sample_rate},
            top_k=None,
            function_to_apply="sigmoid",
        )
        return [
            SoundPrediction(label=item["label"], score=float(item["score"]))
            for item in results
        ]
