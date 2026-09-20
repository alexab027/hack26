"""Offline command-line diagnostics for vocal-expression classification."""

import argparse
from pathlib import Path

from server.analysis.emotion import analyze_emotion
from server.audio.preprocess import load_audio_file
from server.models.emotion_model import DEFAULT_EMOTION_MODEL_ID, EmotionModel


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Inspect vocal-expression scores for one local recording"
    )
    parser.add_argument("audio_file", type=Path)
    args = parser.parse_args()

    try:
        audio, sample_rate = load_audio_file(args.audio_file)
        model = EmotionModel()
        result = analyze_emotion(audio, sample_rate, model)
    except (OSError, RuntimeError, ValueError) as exc:
        parser.exit(1, f"error: {exc}\n")

    duration = len(audio) / sample_rate
    print(f"Model: {getattr(model, 'model_id', DEFAULT_EMOTION_MODEL_ID)}")
    print(f"Sample rate: {sample_rate} Hz")
    print(f"Audio duration: {duration:.2f} sec")
    print("\nEmotion scores:")
    for label, score in sorted(
        result.scores.items(), key=lambda item: item[1], reverse=True
    ):
        print(f"  {label:<20} {score:.6f}")

    print("\nTop expression:")
    print(f"  raw class: {result.raw_label}")
    print(f"  mapped label: {result.label}")
    print(f"  confidence={result.confidence:.6f}")
    if result.future_alert is None:
        print("\nNo user-facing alert.")
    else:
        print("\nWould eventually produce:")
        print(f'  "{result.future_alert}"')


if __name__ == "__main__":
    main()
