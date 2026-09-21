import assert from "node:assert/strict";
import test from "node:test";

import { ASSESSMENT_CRITERIA, evaluateAttempt } from "../lib/attempt-evaluation.mjs";
import { canSavePracticeAttempt, captureTimestampToTick, simulatedPerformanceReadings } from "../lib/performance-input.mjs";

const event = (id, midi, startTick) => ({ id, pitches: [midi], startTick, durationTicks: 240, isRest: false });
const reading = (midi, tick, overrides = {}) => ({ midi, tick, confidence: 0.9, onset: true, ...overrides });
const options = (events, readings, overrides = {}) => ({ events, readings, ticksPerQuarter: 480, bpm: 120, ...overrides });

test("a valid Attempt reports fixed pitch, timing, and input-confidence evidence", () => {
  const result = evaluateAttempt(options([event("e1", 40, 0)], [reading(40, 0)]));

  assert.equal(result.assessable, true);
  assert.deepEqual(result.rating, { correct: 1, total: 1, accuracyPercent: 100, pitchCorrect: 1, onsetTimingCorrect: 1, inputConfidencePercent: 90 });
  assert.deepEqual(result.criteria, ASSESSMENT_CRITERIA);
});

test("practice assist does not change product-defined assessment criteria", () => {
  const late = reading(40, 400);
  const guided = evaluateAttempt(options([event("e1", 40, 0)], [late], { practiceAssist: "guided" }));
  const exact = evaluateAttempt(options([event("e1", 40, 0)], [late], { practiceAssist: "exact" }));

  assert.deepEqual(guided, exact);
  assert.equal(guided.events[0].outcome, "WRONG_TIMING");
});

test("wrong pitches and octave-wrong readings never count as correct", () => {
  const result = evaluateAttempt(options([event("pitch", 40, 0), event("octave", 45, 480)], [reading(41, 0), reading(57, 480)]));

  assert.deepEqual(result.events.map(({ outcome }) => outcome), ["WRONG_PITCH", "WRONG_PITCH"]);
  assert.equal(result.rating.accuracyPercent, 0);
});

test("repeated notes require a new onset for each performance event", () => {
  const result = evaluateAttempt(options([event("first", 40, 0), event("repeat", 40, 480)], [reading(40, 0), reading(40, 480, { onset: false }), reading(40, 480)]));

  assert.deepEqual(result.events.map(({ outcome }) => outcome), ["CORRECT", "CORRECT"]);
});

test("low-confidence input yields an unassessable Attempt without a rating", () => {
  const result = evaluateAttempt(options([event("e1", 40, 0)], [reading(40, 0, { confidence: 0.3 })]));

  assert.equal(result.assessable, false);
  assert.equal(result.rating, null);
  assert.equal(result.inputQuality, "RETRY");
});

test("multi-note passages are unassessable under the initial assessment boundary", () => {
  const result = evaluateAttempt(options([{ ...event("chord", 40, 0), pitches: [40, 44] }], [reading(40, 0)]));

  assert.equal(result.assessable, false);
  assert.equal(result.rating, null);
  assert.deepEqual(result.events, [{ eventId: "chord", outcome: "UNASSESSED" }]);
});

test("deterministic simulator fixtures use the same final assessment as real readings", () => {
  const events = [event("first", 40, 0), event("second", 45, 480)];
  const toAssessmentReadings = (scenario) => simulatedPerformanceReadings({ events, ticksPerQuarter: 480, bpm: 120, scenario, captureStartedAtMs: 1_000 })
    .map(({ capturedAtMs, ...reading }) => ({ ...reading, tick: captureTimestampToTick({ capturedAtMs, transportStartedAtMs: 1_000, startTick: 0, ticksPerQuarter: 480, bpm: 120 }) }));

  assert.equal(evaluateAttempt(options(events, toAssessmentReadings("PERFECT"))).rating.accuracyPercent, 100);
  assert.equal(evaluateAttempt(options(events, toAssessmentReadings("WRONG_PITCH"))).events[0].outcome, "WRONG_PITCH");
  assert.equal(evaluateAttempt(options(events, toAssessmentReadings("LOW_CONFIDENCE"))).rating, null);
  assert.equal(evaluateAttempt(options(events, toAssessmentReadings("MISSED_EVENT"))).events[0].outcome, "MISSING");
  assert.equal(evaluateAttempt(options(events, toAssessmentReadings("EARLY_ONSET"))).events[1].outcome, "MISSING");
  assert.equal(evaluateAttempt(options(events, toAssessmentReadings("LATE_ONSET"))).events[1].outcome, "WRONG_TIMING");
});

test("simulated Attempts are blocked before the practice-history request", () => {
  assert.equal(canSavePracticeAttempt({ isSimulated: true }), false);
  assert.equal(canSavePracticeAttempt({ isSimulated: false }), true);
});
