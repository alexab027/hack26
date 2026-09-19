# Semantic Captions Progress Summary

This repo is a frontend-first prototype for a mobile captioning app called Semantic Captions.

## What we have done so far

- Set up the project as a Next.js + React + TypeScript app.
- Added Tailwind CSS for mobile-friendly styling.
- Built a clean, accessible UI for a captioning screen.
- Added a header with the title "Semantic Captions".
- Added a status indicator that toggles between "Not listening" and "Listening...".
- Added a large Start Listening / Stop Listening button.
- Created reusable frontend components for:
  - status
  - caption display
  - caption lines
  - listening button
- Added mock transcript data to simulate live captions.
- Kept the interface focused on the caption area and readable phone-sized layout.
- Implemented browser microphone access using the MediaStream API.
- Added permission handling so the app can request microphone access and cleanly stop it.
- Added error handling for permission denial or access failure.
- Kept the existing mock captions in place while adding real microphone lifecycle logic.

## Important boundaries

- No Deepgram integration yet.
- No FastAPI backend yet.
- No WebSockets yet.
- No microphone-to-transcription streaming yet.
- This is still frontend-only prototype work.

## Next likely step

- Reuse the same microphone stream for future Deepgram and backend integration.
- Then add real transcript streaming and merge caption data by timestamps.
