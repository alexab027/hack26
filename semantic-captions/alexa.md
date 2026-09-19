# Semantic Captions Backend Progress

## Completed

- Installed Python 3.11 and created the local `server/.venv` environment.
- Added audio loading, mono conversion, normalization, and 16 kHz resampling.
- Added 2-second timestamped audio windows with a 1-second hop.
- Integrated `MIT/ast-finetuned-audioset-10-10-0.4593` for AudioSet classification.
- Switched AudioSet scoring from softmax to independent sigmoid scores.
- Added centralized semantic alias groups that use the strongest raw score.
- Added confidence filtering and duplicate merging for overlapping detections.
- Added `POST /analyze/file` while keeping model loading lazy.
- Added WAV/FLAC/OGG loading and an ffmpeg fallback for iPhone M4A recordings.
- Added CLI debug output plus clean timestamped JSON output with `--json`.
- Added a Git-ignored `server/test_audio/` directory for local recordings.

## Semantic Cues

The backend now maps vocal sounds such as shouting, whispering, laughter, crying,
coughing, breathing, and sneezing, plus environmental sounds such as horns,
sirens, knocking, phone ringing, dog barking, applause, chatter, and background music.
Mappings use exact labels verified from the checkpoint's `id2label` configuration.
Related laughter labels are grouped into one user-facing `laughter` cue without
summing correlated scores.

## Validation

- 42 tests pass without downloading the model or using the network.
- Model loading and inference were smoke-tested successfully.
- A silent WAV correctly returned no semantic cues.
- A real iPhone laughter recording produced a merged `laughter` cue from 5–8 seconds.

## Run Locally

```powershell
server\.venv\Scripts\Activate.ps1
python -m uvicorn server.main:app --reload
python -m server.cli server\test_audio\laughter.m4a
python -m server.cli server\test_audio\laughter.m4a --json
```

## Next Step

Validate the unchanged confidence threshold across more real recordings, then
connect browser microphone audio to the backend pipeline.
