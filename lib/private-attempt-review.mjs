export function reviewPrivateAttemptHistory({ baselineAttemptId, items }) {
  const current = items.at(-1);
  if (!current) return null;
  const baseline = items.find((attempt) => attempt.id === baselineAttemptId) ?? null;
  const weakPoint = weakPointForAttempt(current);
  return {
    baselineId: baselineAttemptId,
    comparison: comparisonFor(baseline, current),
    weakPoint,
    intervention: interventionFor(weakPoint),
  };
}

export function correctionPayload(input) {
  const { subject, isHelpful, note } = input;
  return { subject, isHelpful, ...(note ? { note } : {}) };
}

export function telemetryPayload(input) {
  const { consent, scoreImportId, attemptId, eventType, outcome, reason, trackId, passageStartMeasure, passageEndMeasure } = input;
  if (!consent) return null;
  return {
    consent: true, scoreImportId, ...(attemptId ? { attemptId } : {}), eventType,
    ...(outcome ? { outcome } : {}), ...(reason ? { reason } : {}), ...(trackId ? { trackId } : {}),
    ...(passageStartMeasure ? { passageStartMeasure } : {}), ...(passageEndMeasure ? { passageEndMeasure } : {}),
  };
}

function comparisonFor(baseline, current) {
  if (!baseline || baseline.id === current.id || baseline.scoreRevision !== current.scoreRevision || baseline.bpm !== current.bpm || baseline.totalTargetEvents !== current.totalTargetEvents) return null;
  const accuracyChangePercent = current.accuracyPercent - baseline.accuracyPercent;
  return { baselineAccuracyPercent: baseline.accuracyPercent, accuracyChangePercent, message: `${accuracyChangePercent} points ${accuracyChangePercent >= 0 ? "above" : "below"} your Baseline.` };
}

function weakPointForAttempt(attempt) {
  const wrongPitch = attempt.noteResults.find((result) => result.outcome === "WRONG_PITCH");
  if (wrongPitch) return { kind: "PITCH", eventId: wrongPitch.timelineEventId, observed: `Wrong pitch on ${attempt.wrongPitchCount} of ${attempt.totalTargetEvents} notes.` };
  const late = attempt.noteResults.find((result) => result.timingOffsetMs !== undefined && Math.abs(result.timingOffsetMs) > ASSESSMENT_CRITERIA.onsetTimingToleranceMs);
  if (late) return { kind: "TIMING", eventId: late.timelineEventId, observed: `Onset timing missed on 1 of ${attempt.totalTargetEvents} notes.` };
  const missing = attempt.noteResults.find((result) => result.outcome === "MISSING");
  if (missing) return { kind: "MISSING", eventId: missing.timelineEventId, observed: `A note was missed in this passage.` };
  return { kind: "CONSISTENCY", eventId: null, observed: "No single weak note stands out in this Attempt." };
}

function interventionFor(weakPoint) {
  if (weakPoint.kind === "PITCH") return { label: "Intervention hypothesis", action: "Slow the passage and prioritize clean fretting on the weak note." };
  if (weakPoint.kind === "TIMING") return { label: "Intervention hypothesis", action: "Use a slower tempo and land the weak note with the click." };
  return { label: "Intervention hypothesis", action: "Repeat the passage at this tempo and aim for the same result twice." };
}
import { ASSESSMENT_CRITERIA } from "./attempt-evaluation.mjs";
