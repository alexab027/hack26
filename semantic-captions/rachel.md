# Semantic Captions Progress Summary

This repo is a frontend-first prototype for a mobile captioning app called Semantic Captions.

## Current restored state

We rolled back the project to the last known-good Step 1 implementation, before microphone access was added.

- The app is a Next.js + React + TypeScript frontend-only prototype.
- Tailwind CSS styling is working correctly.
- The screen matches the original mobile-first Semantic Captions UI.
- Header: "Semantic Captions"
- Status indicator toggles between:
  - "Not listening"
  - "Listening..."
- Caption display renders mock transcript lines.
- Large Start Listening / Stop Listening button is present.
- Clicking the button only toggles local React state.
- Mock transcript data is preserved.
- Reusable React components are preserved.
- Transcript type is preserved for future integration work.

## Step 2 rollback

We removed the microphone-specific work that was added during Step 2:

- removed browser microphone access code
- removed `navigator.mediaDevices.getUserMedia()`
- removed `MediaStream` lifecycle handling
- removed the microphone helper file
- removed microphone permission flow and error state
- restored the button to local-only state toggling
- preserved the original Step 1 mock caption UI
- preserved the original Tailwind styling configuration and frontend structure

## Important boundaries

- No microphone access
- No `MediaRecorder`
- No `navigator.mediaDevices.getUserMedia()`
- No `MediaStream` handling
- No `microphone.ts`
- No Deepgram integration
- No WebSockets
- No FastAPI/backend integration

## Verified status

- the frontend-only Step 1 behavior is restored
- the app builds successfully with `npm run build`
- the app is ready for the next backend/transcription phase without reintroducing the browser microphone implementation

## Next likely step

- Keep the working frontend-only interface as the foundation
- Add backend or transcription integration only after the UI is stable
- Reintroduce microphone capture only when intentionally starting Step 2 again
