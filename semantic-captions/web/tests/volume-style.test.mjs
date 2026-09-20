import assert from "node:assert/strict";
import test from "node:test";

import {
  CAPTION_VOLUME_TEXT_CLASSES,
  partitionAudioCues,
  volumeStyleForSegment,
} from "../captions/mergeCues.ts";

const transcript = {
  type: "transcript",
  start: 1,
  end: 3,
  text: "Test caption",
  speaker: 0,
  confidence: 0.9,
  final: true,
};

const small = {
  type: "audio_cue",
  start: 1.2,
  end: 2.8,
  category: "prosody",
  label: "volume_small",
  confidence: 0.8,
};

const large = {
  ...small,
  label: "volume_large",
};

const extraSmall = {
  ...small,
  label: "volume_xsmall",
};

const extraLarge = {
  ...small,
  label: "volume_xlarge",
};

test("volume metadata chooses small, normal, and large caption styles", () => {
  assert.equal(volumeStyleForSegment(transcript, [extraSmall]), "xsmall");
  assert.equal(volumeStyleForSegment(transcript, [small]), "small");
  assert.equal(volumeStyleForSegment(transcript, []), "normal");
  assert.equal(volumeStyleForSegment(transcript, [large]), "large");
  assert.equal(volumeStyleForSegment(transcript, [extraLarge]), "xlarge");
  assert.equal(CAPTION_VOLUME_TEXT_CLASSES.xsmall, "text-xs");
  assert.equal(CAPTION_VOLUME_TEXT_CLASSES.small, "text-base");
  assert.equal(CAPTION_VOLUME_TEXT_CLASSES.normal, "text-xl");
  assert.equal(CAPTION_VOLUME_TEXT_CLASSES.large, "text-2xl");
  assert.equal(CAPTION_VOLUME_TEXT_CLASSES.xlarge, "text-3xl");
});

test("the volume state with the longest overlap wins", () => {
  const briefLarge = { ...large, start: 1.2, end: 1.4 };
  assert.equal(volumeStyleForSegment(transcript, [small, briefLarge]), "small");
});

test("volume metadata is excluded from visible bracketed cues", () => {
  const laughter = {
    ...small,
    category: "environment",
    label: "laughter",
  };
  const { volumeCues, visibleCues } = partitionAudioCues([
    extraSmall,
    small,
    large,
    extraLarge,
    laughter,
  ]);

  assert.deepEqual(
    volumeCues.map((cue) => cue.label),
    ["volume_xsmall", "volume_small", "volume_large", "volume_xlarge"],
  );
  assert.deepEqual(
    visibleCues.map((cue) => cue.label),
    ["laughter"],
  );
});
