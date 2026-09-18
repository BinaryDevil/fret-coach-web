import { hasPitchChangeAttack } from "./note-attack.mjs";

export const ASSESSMENT_CRITERIA = Object.freeze({
  centsTolerance: 45,
  onsetTimingToleranceMs: 260,
  minimumInputConfidence: 0.65,
});

const millisecondsPerTick = (ticksPerQuarter, bpm) => (60_000 / bpm) / ticksPerQuarter;
const centsFromExpected = (actualMidi, expectedMidi) => (actualMidi - expectedMidi) * 100;

function closestExpectedPitch(midi, pitches) {
  return pitches
    .map((expectedMidi) => ({ expectedMidi, centsOffset: centsFromExpected(midi, expectedMidi) }))
    .sort((left, right) => Math.abs(left.centsOffset) - Math.abs(right.centsOffset))[0];
}

function isInCaptureWindow(event, tick, timingToleranceTicks) {
  return tick >= event.startTick - timingToleranceTicks && tick <= event.startTick + event.durationTicks + timingToleranceTicks;
}

function matchesRepeatedAttack(reading, event, previous) {
  return previous?.expectedMidi !== event.pitches[0] || hasPitchChangeAttack(reading, previous?.midi);
}

export function evaluateAttempt({ events, readings, ticksPerQuarter, bpm }) {
  const performanceEvents = events.filter((event) => !event.isRest);
  if (performanceEvents.some((event) => event.pitches.length !== 1)) {
    return {
      assessable: false,
      inputQuality: "PASS",
      criteria: ASSESSMENT_CRITERIA,
      rating: null,
      events: performanceEvents.map((event) => ({ eventId: event.id, outcome: "UNASSESSED" })),
    };
  }
  const qualifyingReadings = readings.filter((reading) => reading.confidence >= ASSESSMENT_CRITERIA.minimumInputConfidence);
  if (!qualifyingReadings.length) {
    return {
      assessable: false,
      inputQuality: "RETRY",
      criteria: ASSESSMENT_CRITERIA,
      rating: null,
      events: performanceEvents.map((event) => ({ eventId: event.id, outcome: "UNASSESSED" })),
    };
  }

  const timingToleranceTicks = ASSESSMENT_CRITERIA.onsetTimingToleranceMs / millisecondsPerTick(ticksPerQuarter, bpm);
  const outcomes = performanceEvents.map((event) => ({ event, outcome: "MISSING", centsOffset: null, timingOffsetMs: null, confidence: null }));
  let previous = null;

  for (const reading of qualifyingReadings.toSorted((left, right) => left.tick - right.tick)) {
    const candidate = outcomes
      .filter((entry) => entry.outcome === "MISSING" && isInCaptureWindow(entry.event, reading.tick, timingToleranceTicks))
      .map((entry) => ({ entry, distance: Math.abs(reading.tick - entry.event.startTick) }))
      .sort((left, right) => left.distance - right.distance)[0];
    if (!candidate || !matchesRepeatedAttack(reading, candidate.entry.event, previous)) continue;

    const pitch = closestExpectedPitch(reading.midi, candidate.entry.event.pitches);
    const timingOffsetMs = Math.round((reading.tick - candidate.entry.event.startTick) * millisecondsPerTick(ticksPerQuarter, bpm));
    candidate.entry.centsOffset = Math.round(pitch.centsOffset);
    candidate.entry.timingOffsetMs = timingOffsetMs;
    candidate.entry.confidence = reading.confidence;
    candidate.entry.outcome = Math.abs(pitch.centsOffset) > ASSESSMENT_CRITERIA.centsTolerance
      ? "WRONG_PITCH"
      : Math.abs(timingOffsetMs) > ASSESSMENT_CRITERIA.onsetTimingToleranceMs
        ? "WRONG_TIMING"
        : "CORRECT";
    previous = { midi: reading.midi, expectedMidi: candidate.entry.event.pitches[0] };
  }

  const correct = outcomes.filter((entry) => entry.outcome === "CORRECT").length;
  const pitchCorrect = outcomes.filter((entry) => entry.outcome !== "WRONG_PITCH" && entry.outcome !== "MISSING").length;
  const onsetTimingCorrect = outcomes.filter((entry) => entry.outcome === "CORRECT").length;
  const inputConfidencePercent = Math.round((qualifyingReadings.reduce((total, reading) => total + reading.confidence, 0) / qualifyingReadings.length) * 100);

  return {
    assessable: true,
    inputQuality: "PASS",
    criteria: ASSESSMENT_CRITERIA,
    rating: {
      correct,
      total: outcomes.length,
      accuracyPercent: outcomes.length ? Math.round((correct / outcomes.length) * 100) : 0,
      pitchCorrect,
      onsetTimingCorrect,
      inputConfidencePercent,
    },
    events: outcomes.map(({ event, outcome, centsOffset, timingOffsetMs, confidence }) => ({ eventId: event.id, outcome, centsOffset, timingOffsetMs, confidence })),
  };
}
