# Semantic Captions Progress

## Completed

- Set up Python 3.11 and the local `server/.venv` environment.
- Added audio loading, mono conversion, normalization, and 16 kHz resampling.
- Added 2-second timestamped windows with a 1-second hop.
- Integrated `MIT/ast-finetuned-audioset-10-10-0.4593` with sigmoid scoring.
- Added centralized semantic aliases, 0.15 confidence filtering, and
  max-confidence merging for overlapping detections.
- Added saved-recording CLI/JSON validation and iPhone M4A support via ffmpeg.
- Added live mono Float32 PCM streaming from a browser AudioWorklet to FastAPI
  at `/ws/analyze`, using the same microphone stream as Deepgram.
- Added bounded, non-blocking live inference with sample-position timestamps.
- Added React cue merging and rendering before overlapping transcripts or as
  standalone cards when no speech overlaps.
- Kept Deepgram working if semantic analysis is unavailable or falls behind.
- Added a silent 2-second AST warm-up during FastAPI startup so model startup
  does not delay the first live sound event.

## Semantic Cues

The backend maps vocal sounds such as laughter, coughing, shouting, crying,
breathing, and sneezing, plus environmental sounds such as horns, sirens,
knocking, phone ringing, dog barking, applause, chatter, and background music.
Exact checkpoint labels are grouped into user-facing cues using the strongest
raw score rather than summed confidence.

## Validation

- 49 backend tests pass with protocol/model behavior tested offline.
- Frontend TypeScript checks and the production Next.js build pass.
- A real iPhone laughter recording produced a merged `laughter` cue at 5-8 seconds.
- Live Deepgram captions and semantic labels now work together.
- Expected live delay is the 2-second window plus local AST inference time.

## Run Locally

From the repository root:

```powershell
.\server\.venv\Scripts\python.exe -m uvicorn server.main:app --reload --port 8000
```

Wait for `Application startup complete`, then in a second terminal:

```powershell
cd web
npm.cmd run dev
```

## Next Step

Validate more real laughter, cough, and environmental recordings before tuning
the unchanged threshold or changing the analysis windows.
