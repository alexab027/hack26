# Semantic Captions Progress Summary

This repo is a frontend-first prototype for a mobile captioning app called Semantic Captions.

## Current state

We built the working Step 1 frontend prototype, then implemented Step 2 browser microphone access, and kept the app scoped to frontend-only behavior.

- The app is a Next.js + React + TypeScript frontend prototype.
- Tailwind CSS styling is working correctly.
- The screen is a mobile-first Semantic Captions UI.
- Header: "Semantic Captions"
- Status indicator toggles between:
  - "Not listening"
  - "Listening..."
- Caption display shows the mock transcript lines:
  - Speaker 1: "Hey, are you coming downstairs?"
  - Speaker 2: "Yeah, give me a second."
- Large Start Listening / Stop Listening button is present.
- The button now requests and releases the browser microphone.
- Mock transcript data is preserved.
- Reusable React components are preserved.
- Transcript type remains in place for future integration work.

## Step 2 implementation

We added the browser microphone layer for real microphone access without adding backend or transcription yet.

- added `web/audio/microphone.ts`
- added `startMicrophone()` to request `navigator.mediaDevices.getUserMedia({ audio: true })`
- added `stopMicrophone(stream)` to stop all tracks on a `MediaStream`
- wired the button to request microphone access on Start Listening
- stored the active stream in a React ref so it does not trigger extra render logic
- changed the UI to `Listening...` only after mic access succeeds
- changed the UI back to `Not listening` after stopping the stream
- added error handling for blocked or unavailable microphone access
- logged the real browser error to the console for debugging
- cleaned up the active microphone on component unmount

## Important boundaries

- No Deepgram integration yet
- No WebSockets yet
- No FastAPI backend yet
- No audio chunk collection yet
- No transcription yet
- No new npm packages were added

## Verified status

- the current app builds successfully with `npm run build`
- the app is still using the working Step 1 visual structure and styling
- Step 2 is limited to browser `MediaStream` access and release only

## Known dev-server issues

- stale `.next` output can cause missing chunk/runtime errors
- running `npm run dev` from the wrong directory causes `ENOENT` errors
- the correct app folder is `/Users/rachelchen/projects/hack26/semantic-captions/web`

## Next likely step

- keep the browser microphone lifecycle working
- add the next real feature only when intentionally starting the next milestone
- avoid going to Deepgram or backend work until the microphone step is fully validated on localhost and mobile
