# Semantic Captions — HackMIT Team Plan

## Project Goal

Build a mobile-friendly real-time captioning system that captures not only **what was said**, but also useful information that normal speech-to-text misses.

Examples:

- `[quietly] I don't know.`
- `[voice trembling] I'm fine.`
- `[laughter]`
- `[car horn nearby]`
- `[raised voice] Watch out!`

The project has two main pipelines that can be developed independently and then merged:

```text
Phone microphone
      |
      +------> Deepgram ------> transcript events
      |
      +------> Our backend ---> prosody / emotion / sound events
                                |
                                v
                     timestamp-based merge
                                |
                                v
                       enriched captions
```

---

# Person 1 — Backend / Audio Intelligence

## Main Responsibility

Build the system that answers:

> **How was it said, and what else happened in the audio?**

Person 1 should be able to work almost entirely independently using local WAV/audio test files before live phone audio is connected.

## Primary Files

```text
server/
├── main.py
├── analysis/
│   ├── emotion.py
│   ├── prosody.py
│   ├── sounds.py
│   └── combine.py
├── audio/
│   ├── preprocess.py
│   ├── windows.py
│   └── features.py
├── models/
│   ├── emotion_model.py
│   └── sound_model.py
└── schemas.py
```

## Phase 1 — Audio Preprocessing

Goal: take an audio file or audio array and convert it into a consistent format for every model.

Tasks:

- Load WAV/audio test files.
- Convert stereo audio to mono if needed.
- Resample audio to the target sample rate, likely 16 kHz.
- Normalize waveform values.
- Return a NumPy array plus sample rate.
- Keep preprocessing independent from file paths so live audio can eventually use the same functions.

Preferred function style:

```python
def preprocess_audio(audio, sample_rate):
    ...
```

Avoid tying the analysis pipeline directly to filenames.

### Definition of Done

A local audio clip can be loaded and converted into a predictable waveform format.

---

## Phase 2 — Environmental Sound Detection

Goal: detect useful non-speech sounds.

Initial examples:

- car horn
- siren
- door knock
- dog bark
- laughter
- applause
- phone ringing

Tasks:

- Choose/load a pretrained sound-event classifier.
- Accept an audio window.
- Return one or more labels and confidence scores.
- Add confidence thresholds so weak predictions are ignored.

Example output:

```json
{
  "type": "audio_cue",
  "start": 8.1,
  "end": 8.9,
  "category": "environment",
  "label": "car_horn",
  "confidence": 0.94
}
```

### Definition of Done

Running a test audio file produces at least one useful environmental sound label.

---

## Phase 3 — Prosody Analysis

Goal: detect observable vocal characteristics without making psychological claims.

Useful signals may include:

- loud / quiet
- raised voice
- fast / slow speech
- pitch changes
- pitch variability
- voice trembling
- long pauses

Tasks:

- Extract useful acoustic features.
- Decide which signals can reliably map to user-facing caption labels.
- Implement conservative thresholds.
- Return timestamped `audio_cue` events.

Example:

```json
{
  "type": "audio_cue",
  "start": 4.0,
  "end": 6.0,
  "category": "prosody",
  "label": "raised_voice",
  "confidence": 0.87
}
```

### Definition of Done

At least 2–3 prosodic cues can be produced from recorded speech.

---

## Phase 4 — Emotion / Vocal Expression

Goal: add emotional or expressive information when confidence is strong enough.

Important principle:

Do not treat emotion classification as literal mind-reading.

Prefer:

```text
[angry-sounding tone]
[excited tone]
[voice trembling]
```

over:

```text
[angry]
[afraid]
```

Tasks:

- Select a pretrained speech-emotion or vocal-expression model.
- Run inference over short audio windows.
- Return labels and confidence scores.
- Suppress low-confidence emotion predictions.
- Compare emotion predictions with objective prosodic features when possible.

### Definition of Done

A test clip can produce useful vocal-expression metadata without overwhelming the caption stream.

---

## Phase 5 — Combine Audio Intelligence

`analysis/combine.py` should combine:

```text
prosody
emotion
environmental sounds
```

into a small number of useful user-facing events.

Example:

```text
emotion model: angry-sounding 0.74
volume: very high
pitch: elevated

OUTPUT:
[raised, angry-sounding voice]
```

Avoid displaying five overlapping labels for the same two-second window.

### Definition of Done

One audio window produces a clean list of `AudioCue` objects.

---

## Phase 6 — FastAPI / Live Audio Integration

Do this after the analysis functions work locally.

Tasks:

- Start FastAPI server.
- Add `/health`.
- Add a WebSocket or streaming endpoint for live audio.
- Receive audio chunks from the frontend.
- Buffer them into analysis windows.
- Run the existing analysis functions.
- Send `audio_cue` events back to the frontend.

Important:

The ML functions should not care whether audio originally came from:

```text
test.wav
```

or:

```text
phone microphone
```

---

# Person 2 — Mobile/Web + Live Transcription

## Main Responsibility

Build the system that answers:

> **What was said, and how do we display everything clearly on a phone?**

Person 2 owns the mobile-first frontend, microphone capture, Deepgram streaming integration, and caption UI.

## Primary Files

```text
web/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   └── api/
│       └── deepgram-token/
│           └── route.ts
├── components/
│   ├── CaptionDisplay.tsx
│   ├── CaptionLine.tsx
│   ├── AudioCue.tsx
│   ├── ListeningButton.tsx
│   └── StatusIndicator.tsx
├── audio/
│   ├── microphone.ts
│   ├── deepgram.ts
│   ├── audioStream.ts
│   └── audioBuffer.ts
└── captions/
    ├── transcript.ts
    ├── mergeCues.ts
    └── types.ts
```

## Phase 1 — Mobile-First UI

Goal: build the caption screen before live services are connected.

Tasks:

- Create the main mobile layout.
- Add Start Listening / Stop Listening controls.
- Add listening status.
- Create caption display components.
- Make long conversations readable on a phone.
- Support temporary/mock transcript events.

Example mock caption:

```text
Speaker 1

Hey, are you coming downstairs?
```

### Definition of Done

The frontend can display fake transcript data cleanly on a phone-sized screen.

---

## Phase 2 — Phone Microphone Capture

Goal: capture real microphone audio from the browser.

Tasks:

- Request microphone permission.
- Start and stop microphone capture.
- Produce live audio chunks.
- Handle permission errors.
- Show microphone/listening state in the UI.

The microphone layer should expose audio so it can eventually be sent to both:

```text
Deepgram
and
our Python backend
```

### Definition of Done

Speaking into a phone produces accessible audio chunks in the app.

---

## Phase 3 — Deepgram Live Transcription

Goal: convert live microphone audio into text.

We are **using Deepgram's live transcription API**.

We are **not rebuilding Deepgram's speech recognition model**.

Conceptual flow:

```text
phone microphone
      ↓
small audio chunks
      ↓
persistent WebSocket
      ↓
Deepgram
      ↓
interim + final transcripts
      ↓
our UI
```

Tasks:

- Obtain a temporary Deepgram token from our own server route.
- Open a streaming connection to Deepgram.
- Send live microphone audio.
- Receive interim transcript results.
- Receive final transcript results.
- Convert raw Deepgram messages into our internal transcript type.

Do not expose a permanent Deepgram API key in browser code.

### Definition of Done

Someone can speak into the phone and see live captions appear.

---

## Phase 4 — Transcript Normalization

Convert Deepgram output into our shared format.

Example:

```json
{
  "type": "transcript",
  "start": 4.2,
  "end": 5.8,
  "text": "I'm fine.",
  "speaker": 0,
  "confidence": 0.97,
  "final": true
}
```

Tasks:

- Handle interim vs final transcript events.
- Avoid duplicate captions.
- Preserve timestamps.
- Preserve speaker information if available.
- Send normalized transcript events to the UI.

### Definition of Done

The rest of the frontend does not need to understand Deepgram-specific response formats.

---

## Phase 5 — Backend Audio Streaming

Once Person 1's backend endpoint exists:

```text
microphone audio
      |
      +------> Deepgram
      |
      +------> Python backend
```

Tasks:

- Send appropriate audio chunks to the backend.
- Receive `audio_cue` events.
- Add received events to frontend state.
- Handle backend disconnection without breaking transcription.

### Definition of Done

The phone can receive live analysis events from Person 1's server.

---

## Phase 6 — Merge Captions + Audio Cues

Use timestamps to associate transcripts with audio-analysis events.

Example:

```text
Transcript:
4.2–5.8 sec
"I'm fine."

Audio cue:
4.0–6.0 sec
voice_trembling
```

Displayed result:

```text
[voice trembling]
I'm fine.
```

Tasks:

- Match overlapping time ranges.
- Avoid duplicate cues.
- Decide where environmental sounds appear.
- Keep captions readable rather than showing every model prediction.
- Make cues visually distinct from spoken text.

### Definition of Done

The UI can display enriched live captions using real transcript and audio-analysis events.

---

# Shared Contract Between Person 1 and Person 2

The most important thing is agreeing on event formats early.

## Transcript Event

```json
{
  "type": "transcript",
  "start": 4.2,
  "end": 5.8,
  "text": "I'm fine.",
  "speaker": 0,
  "confidence": 0.97,
  "final": true
}
```

## Audio Cue Event

```json
{
  "type": "audio_cue",
  "start": 4.0,
  "end": 6.0,
  "category": "prosody",
  "label": "voice_trembling",
  "confidence": 0.83
}
```

## Environmental Cue

```json
{
  "type": "audio_cue",
  "start": 8.1,
  "end": 8.9,
  "category": "environment",
  "label": "car_horn",
  "confidence": 0.94
}
```

Person 1 should generate events in this format.

Person 2 should be able to display these events without knowing which ML model generated them.

---

# Parallel Development Strategy

Both people should be able to work without waiting for the other.

## Person 1 Can Use

```text
test.wav
    ↓
backend analysis
    ↓
AudioCue[]
```

No frontend required.

## Person 2 Can Use

Fake events:

```ts
const fakeCue = {
  type: "audio_cue",
  start: 1,
  end: 3,
  category: "prosody",
  label: "laughing",
  confidence: 0.92
};
```

No backend required.

This means both developers can work at the same time.

---

# Integration Milestones

## Milestone 1 — Independent Basics

Person 1:

```text
audio file → one useful audio cue
```

Person 2:

```text
phone microphone → live Deepgram transcript
```

Do not integrate before both of these work separately.

---

## Milestone 2 — Shared Event Format

Verify both sides use the same:

- timestamp units
- field names
- cue categories
- label conventions
- confidence format

Update:

```text
shared/event-schema.md
```

whenever the contract changes.

---

## Milestone 3 — Phone → Backend

Send live phone audio to Person 1's backend.

Verify:

```text
phone
 ↓
backend
 ↓
audio cue
 ↓
phone
```

before worrying about transcript merging.

---

## Milestone 4 — Timestamp Merge

Combine:

```text
Deepgram transcript
+
backend audio cues
```

using overlapping timestamps.

---

## Milestone 5 — Product Polish

Only after the full pipeline works:

- improve mobile UI
- reduce latency
- improve confidence thresholds
- reduce noisy labels
- add speaker visualization
- add PWA/home-screen support
- improve demo flow

---

# Git Workflow

Recommended branches:

```text
main

feature/mobile-captions
feature/audio-analysis
```

Person 1 primarily works on:

```text
server/
```

Person 2 primarily works on:

```text
web/
```

Both may edit:

```text
shared/event-schema.md
README.md
```

Coordinate before making major changes to shared files.

## Before Starting Work

```bash
git pull
```

## Before Merging

- Commit working code.
- Pull the latest `main`.
- Resolve conflicts locally.
- Run the relevant part of the project.
- Merge only code that at least runs.

Avoid both developers changing the same file at the same time unless intentionally pairing.

---

# Shared Priorities

In order:

1. **Working live captions**
2. **One useful audio intelligence feature**
3. **Connect the two pipelines**
4. **Environmental sounds**
5. **Prosody**
6. **Emotion / vocal expression**
7. **UI polish**
8. **Extra features**

A working system with three reliable cues is better than fifteen unreliable classifiers.

---

# Minimum Viable Demo

The minimum successful HackMIT demo is:

```text
Person speaks near phone
        ↓
words appear live
        ↓
audio analysis detects something meaningful
        ↓
caption becomes enriched
```

Example:

```text
[quietly]
I don't think we should go.

[door closes]

[raised voice]
Wait!
```

---

# Stretch Goals

Only attempt these after the core system works:

- speaker diarization
- personalization/calibration to a specific speaker
- haptic/wearable output
- conversation history
- searchable transcripts
- emotion timeline
- multilingual transcription
- adjustable accessibility preferences
- user-selectable cue sensitivity
- native wrapper via Capacitor
- vibration patterns for urgent environmental events

---

# Team Rule

When adding a new feature, ask:

> Does this improve information that ordinary captions fail to communicate?

If not, it is probably lower priority than getting the core enriched-caption experience working reliably.
