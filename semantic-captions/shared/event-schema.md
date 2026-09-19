# Shared event schema

The frontend and Python service exchange small JSON events. Times are floating-point seconds from a shared stream/session origin. **Timestamps are the primary mechanism for associating transcript text with audio-analysis events.** Both sides should preserve them even when events arrive late or out of order.

All intervals use `start` (inclusive) and `end` (exclusive). Confidence values range from `0` to `1`. Labels use stable `snake_case` identifiers; the UI is responsible for human-friendly wording.

## Transcript event

Produced from a Deepgram result after frontend normalization. `final: false` events may be replaced; final events form the durable caption history.

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

## Vocal audio cue

Produced by the backend. Categories distinguish relatively objective prosody from uncertain vocal-expression estimates.

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

## Environmental audio cue

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

## Association and evolution

A cue is a candidate for a caption when their time intervals overlap. For example, a `voice_trembling` cue from 4.0–6.0 seconds overlaps “I'm fine.” from 4.2–5.8 seconds and can render as `[voice trembling] I'm fine.` Environmental cues with no speech overlap should remain standalone timeline items rather than being discarded.

## Live semantic transport

The browser connects to `/ws/analyze` and first sends a text JSON message:

```json
{"type":"start","sample_rate":48000,"session_id":"browser-generated-id"}
```

It then sends binary messages containing little-endian mono Float32 PCM. The
backend derives timestamps from sample positions at the supplied sample rate;
wall-clock and network arrival times are not used. The client ends a session
with `{"type":"stop"}`.

The backend sends `AudioCue` objects using the unchanged schema above. It may
send a later, expanded version of an overlapping cue while that sound
continues. Clients merge same-label overlapping intervals and retain the
maximum confidence rather than summing confidence values.
