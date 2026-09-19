import numpy as np

from server.models.sound_model import SoundModel


class RecordingClassifier:
    def __init__(self) -> None:
        self.input = None
        self.options = None

    def __call__(self, model_input, **options):
        self.input = model_input
        self.options = options
        return [{"label": "Laughter", "score": 0.8}]


def test_sound_model_explicitly_requests_sigmoid_scores() -> None:
    classifier = RecordingClassifier()
    model = SoundModel()
    model._classifier = classifier
    audio = np.zeros(16_000, dtype=np.float32)

    predictions = model.predict(audio, 16_000)

    assert classifier.input == {"raw": audio, "sampling_rate": 16_000}
    assert classifier.options == {
        "top_k": None,
        "function_to_apply": "sigmoid",
    }
    assert predictions[0].label == "Laughter"
    assert predictions[0].score == 0.8


def test_sound_model_warmup_runs_a_two_second_production_inference() -> None:
    classifier = RecordingClassifier()
    model = SoundModel()
    model._classifier = classifier

    model.warm_up()

    assert classifier.input["sampling_rate"] == 16_000
    assert classifier.input["raw"].dtype == np.float32
    assert classifier.input["raw"].shape == (32_000,)
    assert np.count_nonzero(classifier.input["raw"]) == 0
    assert classifier.options == {
        "top_k": None,
        "function_to_apply": "sigmoid",
    }
