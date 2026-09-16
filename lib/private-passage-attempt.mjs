import { ASSESSMENT_CRITERIA } from "./attempt-evaluation.mjs";

export const MAX_ASSESSABLE_EVENTS = 32;

export function selectPrivatePassage({ allEvents, from, to, scoreRevision }) {
  const events = allEvents.filter((event) => event.measure >= from && event.measure <= to);
  const reason = !scoreRevision
    ? "This arrangement needs to be reloaded before an Attempt can be saved."
    : !events.length
      ? "Choose a passage with notes to assess."
      : events.length > MAX_ASSESSABLE_EVENTS
        ? `Choose a shorter passage (up to ${MAX_ASSESSABLE_EVENTS} notes).`
        : events.some((event) => event.pitches.length !== 1)
          ? "This passage is not assessable because it contains simultaneous notes."
          : null;
  return { events, reason, assessable: !reason };
}

export function inputQualityForConfidence(confidence) {
  return confidence >= ASSESSMENT_CRITERIA.minimumInputConfidence ? "PASS" : "RETRY";
}

export function privateAttemptPayload({ assessment, allEvents, scoreImportId, trackId, from, to, scoreRevision, bpm, clientRunId, activeDurationMs, startedAt }) {
  if (!assessment.assessable || !assessment.rating) return null;
  const eventIndexById = new Map(allEvents.map((event, index) => [event.id, index]));
  return {
    clientRunId, scoreImportId, trackId, passageStartMeasure: from, passageEndMeasure: to, scoreRevision, bpm, countInBeats: /** @type {0} */ (0),
    activeDurationMs: Math.round(activeDurationMs), startedAt,
    noteResults: assessment.events.map((event) => ({
      timelineEventId: event.eventId,
      eventIndex: eventIndexById.get(event.eventId) ?? -1,
      outcome: event.outcome === "CORRECT" ? "CORRECT" : event.outcome === "WRONG_PITCH" ? "WRONG_PITCH" : "MISSING",
      ...(event.centsOffset == null ? {} : { centsOffset: event.centsOffset }),
      ...(event.timingOffsetMs == null ? {} : { timingOffsetMs: event.timingOffsetMs }),
      ...(event.confidence == null ? {} : { confidence: event.confidence }),
    })),
  };
}

export function reviewFromSavedAttempt(attempt) {
  const total = attempt.totalTargetEvents;
  const inputConfidence = attempt.noteResults.filter((result) => result.confidence !== undefined);
  return {
    accuracyPercent: attempt.accuracyPercent,
    correct: attempt.correctCount,
    total,
    pitchCorrect: attempt.noteResults.filter((result) => result.outcome !== "WRONG_PITCH" && (result.outcome !== "MISSING" || result.timingOffsetMs !== undefined)).length,
    onsetTimingCorrect: attempt.correctCount,
    inputConfidencePercent: inputConfidence.length ? Math.round(inputConfidence.reduce((sum, result) => sum + (result.confidence ?? 0), 0) / inputConfidence.length * 100) : 0,
    saved: true,
  };
}
