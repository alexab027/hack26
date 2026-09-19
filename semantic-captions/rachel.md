# Semantic Captions Progress Summary

This repo is a frontend-first prototype for a mobile captioning app called Semantic Captions.

## Current state

We built the working frontend, added browser microphone access and debug playback, and completed the initial Deepgram path from secure temporary-token creation through live microphone audio streaming. Deepgram transcripts are logged in the browser console for verification but are not displayed in the caption cards yet.

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
- A Next.js server route exchanges the permanent Deepgram API key for a temporary access token.
- The browser uses only the temporary token to open an authenticated Deepgram WebSocket.
- Deepgram connection status appears as Disconnected, Connecting, or Connected.
- The existing MediaRecorder produces 250 ms chunks for both Deepgram streaming and debug playback.
- Interim and final transcript text is parsed and logged to the browser console.
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

## Step 3A — Deepgram authentication

- `web/app/api/deepgram-token/route.ts` reads `DEEPGRAM_API_KEY` only on the Next.js server.
- The route calls `POST https://api.deepgram.com/v1/auth/grant` with server-side authentication.
- The browser receives only Deepgram's temporary `access_token` and `expires_in` values.
- `web/.env.local` stores the local permanent key and remains ignored and untracked.
- `web/.env.example` documents the empty `DEEPGRAM_API_KEY` variable.
- No `NEXT_PUBLIC_DEEPGRAM_API_KEY` variable exists.

## Step 3B — Authenticated Deepgram connection

- `web/audio/deepgram.ts` owns the live Speech-to-Text WebSocket.
- The browser connects to `wss://api.deepgram.com/v1/listen` with Nova-3, US English, interim results, and smart formatting.
- The temporary JWT is sent through the browser WebSocket subprotocol as a Bearer credential; it is never logged or added to the URL.
- The UI reports Deepgram connection state.
- Start and Stop support repeated connections and clean socket shutdown.
- Connection failures stop the partially initialized microphone/recorder session safely.

## Step 3C — Microphone audio streaming checkpoint

- The app still acquires one `MediaStream` and creates one `MediaRecorder`.
- The recorder selects the first browser-supported container format from WebM/Opus, Ogg/Opus, and MP4/AAC options.
- Recording begins only after the Deepgram WebSocket is open.
- `MediaRecorder.start(250)` emits small chunks approximately every 250 ms.
- Each non-empty Blob is retained for debug playback and sent as binary through the open Deepgram socket.
- Because MediaRecorder produces containerized audio, the WebSocket URL does not specify `encoding` or `sample_rate`; Deepgram reads those values from the container.
- Deepgram `Results` messages are parsed safely and non-empty transcripts are logged as interim or final text.
- Malformed messages and Deepgram errors are handled without logging credentials or raw audio.
- Stop sends the final recorder chunk, finalizes debug playback, sends Deepgram `CloseStream`, releases microphone tracks, and closes the socket.
- Continuous audio chunks make a separate KeepAlive timer unnecessary for this checkpoint.

## Important boundaries

- No FastAPI backend yet
- No Python audio/emotion analysis yet
- No real transcripts in `CaptionDisplay` yet; Deepgram results are console-only
- No interim-caption replacement, speaker diarization, or transcript/audio-cue merging yet
- No new npm packages were added

## Verified status

- the current app builds successfully with `npm run build`
- the app is still using the working Step 1 visual structure and styling
- the temporary-token endpoint returned HTTP 200 with a non-empty 30-second access token during a redacted server test
- authentication, WebSocket, recording, playback, and streaming use native browser/server APIs only
- live microphone-to-transcript behavior still needs final manual verification in Chrome and iPhone Safari

## Known dev-server issues

- stale `.next` output can cause missing chunk/runtime errors
- running `npm run dev` from the wrong directory causes `ENOENT` errors
- the correct app folder is `/Users/rachelchen/projects/hack26/semantic-captions/web`

## Next likely step

- verify 250 ms audio chunks and interim/final console transcripts in desktop Chrome
- verify the selected MediaRecorder format and continuous chunks in iPhone Safari through the existing HTTPS ngrok URL
- after Step 3C passes on both targets, begin Step 3D by mapping Deepgram results into caption state
- keep the temporary playback checkpoint until live streaming is validated, then remove or isolate it
