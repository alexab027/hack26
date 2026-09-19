"""Command-line entry point for validating sound detection on local clips."""

import argparse
from contextlib import redirect_stderr
from io import StringIO
import json
from pathlib import Path

from server.analysis.sounds import (
    cues_from_predictions,
    group_semantic_evidence,
    merge_overlapping_cues,
)
from server.audio.preprocess import load_audio_file
from server.audio.windows import iter_windows
from server.models.sound_model import SoundModel, SoundPrediction


def main() -> None:
    parser = argparse.ArgumentParser(description="Detect useful background sounds")
    parser.add_argument("audio_file", type=Path)
    parser.add_argument("--threshold", type=float, default=0.15)
    parser.add_argument(
        "--top",
        type=int,
        default=10,
        help="number of raw AST predictions to display per window (default: 10)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="print only final AudioCue events as JSON",
    )
    args = parser.parse_args()
    if not 0 <= args.threshold <= 1:
        parser.error("--threshold must be between 0 and 1")
    if args.top <= 0:
        parser.error("--top must be positive")

    try:
        audio, sample_rate = load_audio_file(args.audio_file)
    except (OSError, RuntimeError, ValueError) as exc:
        parser.exit(1, f"error: {exc}\n")
    model = SoundModel()
    window_cues = []

    for index, audio_window in enumerate(iter_windows(audio, sample_rate), start=1):
        if args.json:
            with redirect_stderr(StringIO()):
                predictions = model.predict(
                    audio_window.samples, audio_window.sample_rate
                )
        else:
            predictions = model.predict(audio_window.samples, audio_window.sample_rate)
        predictions = sorted(
            predictions, key=lambda prediction: prediction.score, reverse=True
        )
        cues = cues_from_predictions(predictions, audio_window, args.threshold)
        window_cues.extend(cues)

        if not args.json:
            _print_window_debug(
                index,
                audio_window.start,
                audio_window.end,
                predictions,
                args.threshold,
                args.top,
            )

    cues = merge_overlapping_cues(window_cues)
    if args.json:
        print(json.dumps([cue.model_dump() for cue in cues], indent=2))
    else:
        print("\nFinal merged cues:")
        if not cues:
            print("  (none)")
        for cue in cues:
            print(
                f"  {cue.start:.2f}-{cue.end:.2f} sec  [{cue.label}]  "
                f"confidence={cue.confidence:.6f}"
            )


def _print_window_debug(
    index: int,
    start: float,
    end: float,
    predictions: list[SoundPrediction],
    threshold: float,
    top: int,
) -> None:
    """Print raw, accepted, and threshold-rejected predictions for one window."""
    print(f"\nWindow {index}  {start:.2f}-{end:.2f} sec")
    print("Raw predictions:")
    for prediction in predictions[:top]:
        print(f"  {prediction.label:<42} {prediction.score:.6f}")

    groups = sorted(
        group_semantic_evidence(predictions).items(),
        key=lambda item: item[1][0].score,
        reverse=True,
    )
    accepted = [item for item in groups if item[1][0].score >= threshold]
    rejected = [item for item in groups if item[1][0].score < threshold]

    print("Mapped semantic cues:")
    if not accepted:
        print("  (none)")
    for semantic_label, evidence in accepted:
        _print_semantic_evidence(semantic_label, evidence)

    print(f"Rejected semantic cues (< {threshold:.3f}):")
    if not rejected:
        print("  (none)")
    for semantic_label, evidence in rejected[:top]:
        _print_semantic_evidence(semantic_label, evidence)
    if len(rejected) > top:
        print(f"  ... {len(rejected) - top} more (increase --top to display them)")


def _print_semantic_evidence(
    semantic_label: str, evidence: list[SoundPrediction]
) -> None:
    """Explain a grouped cue without combining its correlated raw scores."""
    print(f"  {semantic_label} = {evidence[0].score:.6f}")
    print("    Evidence:")
    for prediction in evidence:
        print(f"      {prediction.label:<38} {prediction.score:.6f}")


if __name__ == "__main__":
    main()
