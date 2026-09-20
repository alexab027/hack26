import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPRESSION_ALERT_THRESHOLD,
  HumeExpressionTracker,
} from "../emotion/humeAlerts.ts";

function scores(overrides = {}) {
  return {
    anger: 0.1,
    sadness: 0.1,
    joy: 0.1,
    excitement: 0.1,
    amusement: 0.1,
    contentment: 0.1,
    ...overrides,
  };
}

test("direct alerts use a testable 0.20 threshold and dominant category", () => {
  assert.equal(EXPRESSION_ALERT_THRESHOLD, 0.2);
  const tracker = new HumeExpressionTracker();

  assert.deepEqual(tracker.update(scores({ anger: 0.48 }), 0), {
    label: "angry_sounding",
    message: "Angry-sounding speech detected",
    confidence: 0.48,
  });
});

test("positive expression uses the strongest related score rather than a sum", () => {
  const tracker = new HumeExpressionTracker();

  assert.deepEqual(
    tracker.update(
      scores({ joy: 0.2, excitement: 0.31, amusement: 0.29, contentment: 0.25 }),
      0,
    ),
    {
      label: "positive_sounding",
      message: "Positive vocal expression detected",
      confidence: 0.31,
    },
  );
});

test("scores below threshold produce no notification", () => {
  const tracker = new HumeExpressionTracker();

  assert.equal(tracker.update(scores({ sadness: 0.19 }), 0), null);
});

test("a moderate category change produces one cooldown-limited shift alert", () => {
  const tracker = new HumeExpressionTracker();
  tracker.update(scores({ anger: 0.4 }), 0);

  assert.deepEqual(
    tracker.update(scores({ anger: 0.31, sadness: 0.335 }), 6000),
    {
      label: "emotional_shift",
      message: "Possible emotional shift detected",
      confidence: 0.335,
    },
  );
  assert.equal(
    tracker.update(scores({ anger: 0.335, sadness: 0.31 }), 8000),
    null,
  );
});

test("a specific strong expression takes priority over a shift", () => {
  const tracker = new HumeExpressionTracker();
  tracker.update(scores({ joy: 0.42 }), 0);

  assert.equal(
    tracker.update(scores({ anger: 0.51 }), 6000)?.label,
    "angry_sounding",
  );
});
