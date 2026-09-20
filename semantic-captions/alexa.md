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
- Added Phone Call mode semantic analysis for the remote LiveKit caller track
  without taking ownership of or stopping the shared track.
- Wired call `AudioCue` events into the existing merge and `CaptionDisplay`
  flow, including standalone cues, overlap association, bounded history, and
  session cleanup.
- Added automatic phone-ready share links by discovering the current HTTPS
  ngrok tunnel for port 3000 through the local ngrok inspector on port 4040.
- Added responsive Nearby caption sizing from the existing live PCM stream,
  using NumPy RMS/dBFS measurement independently of the AST inference queue.
- Added 200 ms volume frames with 400 ms smoothing and persistence, fixed dBFS
  bands, and five discrete caption sizes from `text-xs` through `text-3xl`.
- Kept volume events as hidden styling metadata so environmental cues still
  render normally without showing bracketed volume labels.

## Semantic Cues

The backend maps vocal sounds such as laughter, coughing, shouting, crying,
breathing, and sneezing, plus environmental sounds such as horns, sirens,
knocking, phone ringing, dog barking, applause, chatter, and background music.
Exact checkpoint labels are grouped into user-facing cues using the strongest
raw score rather than summed confidence.

## Validation

- 64 backend tests pass with protocol/model behavior tested offline.
- Frontend TypeScript checks and the production Next.js build pass.
- Dependency-free frontend tests cover volume sizing, overlap selection, and
  suppression of visible volume labels.
- A real iPhone laughter recording produced a merged `laughter` cue at 5-8 seconds.
- Live Deepgram captions and semantic labels now work together.
- Confirmed phone-to-computer calls reach Deepgram and AST, with semantic cues
  displayed alongside caller captions on the computer host.
- Confirmed automatic ngrok discovery returns the active machine-specific URL.
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

Validate the fixed volume bands against real Nearby microphone levels, along
with more laughter, cough, and environmental recordings, before tuning.
