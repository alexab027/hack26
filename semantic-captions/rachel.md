# Semantic Captions Progress Summary

This repo is a frontend-first prototype for a mobile captioning app called Semantic Captions.

## Current state

We built the working Step 1 frontend prototype, implemented Step 2 browser microphone access, and added a temporary recording/playback checkpoint to verify that the microphone stream contains usable audio. The app remains scoped to frontend-only behavior.

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
- A temporary Audio Debug section records the existing microphone stream and plays back the latest recording.
- The browser chooses its supported MediaRecorder format for Chrome/Safari compatibility.
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

## Temporary microphone recording checkpoint

Before connecting Deepgram, we added a native browser `MediaRecorder` check to prove that the existing `MediaStream` carries usable audio.

- Start Listening acquires the existing microphone stream and gives that same stream to `MediaRecorder`.
- The recorder collects non-empty `dataavailable` chunks in memory while listening.
- Stop Listening stops the recorder and microphone tracks, then combines the chunks into a `Blob` using the recorder's actual MIME type.
- The Audio Debug section reports the recording size and MIME type and enables Play Recording when a non-empty recording exists.
- Starting another recording replaces the previous recording.
- Old object URLs are revoked when replaced and when the page unmounts.
- Console diagnostics report track state, recorder state, MIME type, chunk sizes, and final Blob size without logging raw audio.
- This is temporary verification code; the intended product architecture still sends live audio chunks to Deepgram and the Python analysis service.

## Important boundaries

- No Deepgram integration yet
- No WebSockets yet
- No FastAPI backend yet
- No production streaming audio chunk pipeline yet; the only chunk collection is the temporary MediaRecorder checkpoint
- No transcription yet
- No new npm packages were added

## Verified status

- the current app builds successfully with `npm run build`
- the app is still using the working Step 1 visual structure and styling
- the temporary recording/playback implementation builds successfully with native browser APIs only

## Known dev-server issues

- stale `.next` output can cause missing chunk/runtime errors
- running `npm run dev` from the wrong directory causes `ENOENT` errors
- the correct app folder is `/Users/rachelchen/projects/hack26/semantic-captions/web`

## Next likely step

- validate recording and playback on desktop localhost
- validate recording and playback in iPhone Safari through the existing HTTPS ngrok URL
- after the microphone checkpoint passes, remove or isolate the temporary playback UI and intentionally begin the live Deepgram milestone
