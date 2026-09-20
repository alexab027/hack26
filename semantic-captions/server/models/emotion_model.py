"""Lazy CPU wrapper around the selected speech-expression model."""

from dataclasses import dataclass
from typing import Any

import numpy as np


DEFAULT_EMOTION_MODEL_ID = "superb/wav2vec2-base-superb-er"
EXPECTED_SAMPLE_RATE = 16_000
WARMUP_SECONDS = 2.0


@dataclass(frozen=True, slots=True)
class EmotionPrediction:
    """One normalized raw checkpoint prediction."""

    label: str
    score: float


class EmotionModel:
    """Load Wav2Vec2 lazily and return all four raw class probabilities."""

    def __init__(self, model_id: str = DEFAULT_EMOTION_MODEL_ID) -> None:
        self.model_id = model_id
        self._feature_extractor: Any | None = None
        self._model: Any | None = None
        self._torch: Any | None = None

    def load(self) -> None:
        """Download/load model assets once and place inference on CPU."""
        if self._model is not None:
            return

        try:
            import torch
            from transformers import (
                AutoFeatureExtractor,
                AutoModelForAudioClassification,
            )
        except ImportError as exc:
            raise RuntimeError(
                "Emotion-model dependencies are missing. Install "
                "server/requirements.txt with Python 3.11 or 3.12."
            ) from exc

        try:
            self._feature_extractor = AutoFeatureExtractor.from_pretrained(
                self.model_id, local_files_only=True
            )
            self._model = AutoModelForAudioClassification.from_pretrained(
                self.model_id, local_files_only=True
            )
        except OSError:
            # The first run may need the Hub; later server starts stay local and fast.
            self._feature_extractor = AutoFeatureExtractor.from_pretrained(self.model_id)
            self._model = AutoModelForAudioClassification.from_pretrained(self.model_id)
        self._model.to("cpu")
        self._model.eval()
        self._torch = torch

    def predict(
        self,
        audio: np.ndarray,
        sample_rate: int,
    ) -> list[EmotionPrediction]:
        """Return every raw class probability, sorted from strongest to weakest."""
        waveform = np.asarray(audio, dtype=np.float32)
        if waveform.ndim != 1:
            raise ValueError("emotion-model audio must be mono")
        if waveform.size == 0:
            raise ValueError("emotion-model audio is empty")
        if not np.isfinite(waveform).all():
            raise ValueError("emotion-model audio contains NaN or infinite samples")
        if sample_rate != EXPECTED_SAMPLE_RATE:
            raise ValueError(
                f"emotion-model audio must be sampled at {EXPECTED_SAMPLE_RATE} Hz"
            )

        self.load()
        inputs = self._feature_extractor(
            waveform,
            sampling_rate=sample_rate,
            return_tensors="pt",
        )
        cpu_inputs = {name: value.to("cpu") for name, value in inputs.items()}
        with self._torch.inference_mode():
            logits = self._model(**cpu_inputs).logits
            probabilities = self._torch.softmax(logits, dim=-1)[0]

        scores = probabilities.detach().cpu().tolist()
        id2label = self._model.config.id2label
        predictions = [
            EmotionPrediction(
                label=str(
                    id2label.get(index, id2label.get(str(index), f"LABEL_{index}"))
                ),
                score=float(score),
            )
            for index, score in enumerate(scores)
        ]
        return sorted(predictions, key=lambda prediction: prediction.score, reverse=True)

    def warm_up(self) -> None:
        """Load the model and run one live-window-shaped CPU inference."""
        samples = np.zeros(
            round(WARMUP_SECONDS * EXPECTED_SAMPLE_RATE), dtype=np.float32
        )
        self.predict(samples, EXPECTED_SAMPLE_RATE)
