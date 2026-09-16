export type AssessmentEvent = { id: string; pitches: number[]; startTick: number; durationTicks: number; isRest: boolean };
export type AssessmentReading = { midi: number; tick: number; confidence: number; onset: boolean };
export type AssessmentOutcome = "CORRECT" | "WRONG_PITCH" | "WRONG_TIMING" | "MISSING" | "UNASSESSED";
export type AssessmentResult = {
  assessable: boolean;
  inputQuality: "PASS" | "RETRY";
  criteria: Readonly<{ centsTolerance: number; onsetTimingToleranceMs: number; minimumInputConfidence: number }>;
  rating: { correct: number; total: number; accuracyPercent: number; pitchCorrect: number; onsetTimingCorrect: number; inputConfidencePercent: number } | null;
  events: Array<{ eventId: string; outcome: AssessmentOutcome; centsOffset?: number | null; timingOffsetMs?: number | null }>;
};
export const ASSESSMENT_CRITERIA: AssessmentResult["criteria"];
export function evaluateAttempt(input: { events: AssessmentEvent[]; readings: AssessmentReading[]; ticksPerQuarter: number; bpm: number; practiceAssist?: string }): AssessmentResult;
