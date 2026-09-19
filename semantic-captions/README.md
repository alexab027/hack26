# Semantic Captions

Semantic Captions is a HackMIT prototype for real-time accessibility captions that pair speech-to-text with vocal delivery and environmental sound cues. This repository is intentionally a documented scaffold: it does not yet connect to Deepgram or run ML inference.

## Architecture

```text
Phone microphone
|
+------> Deepgram ------> transcript events
|
+------> FastAPI -------> prosody/emotion/sound events
|
v
timestamp-based merge
|
v
enriched captions
```

Deepgram answers **what was said**. The Python service analyzes **how it was said** and **which non-speech sounds occurred**. The browser sends the same microphone stream down both paths, then associates results using timestamps. Emotion labels should be presented as uncertain vocal-expression estimates, never as psychological facts.

## Directory ownership

- `web/` — Next.js/React/TypeScript client, microphone capture, Deepgram streaming, caption state, and PWA-facing UI.
- `server/` — FastAPI service, audio preparation/windowing, model wrappers, audio analysis, and confidence logic.
- `shared/` — language-neutral contracts shared by both developers.

## Two-person development split

### Frontend/mobile/transcription

- Phone/browser microphone capture and fan-out
- Short-lived Deepgram credentials and live transcription
- Transcript normalization and caption interface
- PWA/mobile behavior

### Backend/audio intelligence

- Audio decoding, preprocessing, and overlapping windows
- Prosody and cautious vocal-expression analysis
- Environmental sound detection
- Confidence thresholds and cue combination

The developers can work independently against `shared/event-schema.md`. Coordinate changes to that contract before changing either implementation.

## Local setup

Prerequisites: Node.js 20+ and Python 3.11+.

```bash
cp .env.example web/.env.local

cd web
npm install
npm run dev
```

In a second terminal:

```bash
cd server
python -m venv .venv
# macOS/Linux: source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

Keep `DEEPGRAM_API_KEY` server-side. Do not commit `.env` files or downloaded model weights.

## Recommended first tasks

- **Frontend:** implement `audio/microphone.ts` and verify that one browser audio source can feed two consumers without connecting either remote service yet.
- **Backend:** define and test the PCM input assumptions in `audio/preprocess.py`, then implement deterministic overlapping windows in `audio/windows.py` before choosing models.
