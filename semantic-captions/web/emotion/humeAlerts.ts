import type { Hume } from "hume";

export const EXPRESSION_ALERT_THRESHOLD = 0.2;
export const DIRECT_EXPRESSION_MARGIN = 0.03;
export const SHIFT_EXPRESSION_MARGIN = 0.02;
export const EMOTIONAL_SHIFT_COOLDOWN_MS = 5000;

export type HumeAlertLabel =
  | "angry_sounding"
  | "sad_sounding"
  | "positive_sounding"
  | "emotional_shift";

export type HumeExpressionAlert = {
  label: HumeAlertLabel;
  message: string;
  confidence: number;
};

type RelevantScores = Pick<
  Hume.empathicVoice.EmotionScores,
  "anger" | "sadness" | "joy" | "excitement" | "amusement" | "contentment"
>;

type ExpressionCategory = Exclude<HumeAlertLabel, "emotional_shift">;

const ALERT_MESSAGES: Record<ExpressionCategory, string> = {
  angry_sounding: "Angry-sounding speech detected",
  sad_sounding: "Sad-sounding speech detected",
  positive_sounding: "Positive vocal expression detected",
};

type CategoryScore = {
  category: ExpressionCategory;
  score: number;
};

export class HumeExpressionTracker {
  private previous: CategoryScore | null = null;
  private lastShiftAt = Number.NEGATIVE_INFINITY;

  update(scores: RelevantScores, now = Date.now()): HumeExpressionAlert | null {
    const categories = categoryScores(scores);
    const dominant = categories[0];
    const runnerUp = categories[1];
    const dominance = dominant.score - runnerUp.score;
    const previous = this.previous;
    const meaningful = dominant.score >= EXPRESSION_ALERT_THRESHOLD;

    if (meaningful) this.previous = dominant;

    if (meaningful && dominance >= DIRECT_EXPRESSION_MARGIN) {
      return {
        label: dominant.category,
        message: ALERT_MESSAGES[dominant.category],
        confidence: dominant.score,
      };
    }

    const shifted =
      meaningful &&
      previous !== null &&
      previous.score >= EXPRESSION_ALERT_THRESHOLD &&
      previous.category !== dominant.category &&
      dominance >= SHIFT_EXPRESSION_MARGIN &&
      now - this.lastShiftAt >= EMOTIONAL_SHIFT_COOLDOWN_MS;

    if (shifted) {
      this.lastShiftAt = now;
      return {
        label: "emotional_shift",
        message: "Possible emotional shift detected",
        confidence: dominant.score,
      };
    }
    return null;
  }
}

function categoryScores(scores: RelevantScores): CategoryScore[] {
  const categories: CategoryScore[] = [
    { category: "angry_sounding", score: scores.anger },
    { category: "sad_sounding", score: scores.sadness },
    {
      category: "positive_sounding",
      score: Math.max(
        scores.joy,
        scores.excitement,
        scores.amusement,
        scores.contentment,
      ),
    },
  ];
  return categories.sort((left, right) => right.score - left.score);
}
