import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAttempt } from "../lib/attempt-evaluation.mjs";
import { hasPitchChangeAttack } from "../lib/note-attack.mjs";

test("a note attack accepts an onset or a meaningful pitch change", () => {
  assert.equal(hasPitchChangeAttack({ midi: 40, onset: true }, 40), true);
  assert.equal(hasPitchChangeAttack({ midi: 40, onset: false }, undefined), true);
  assert.equal(hasPitchChangeAttack({ midi: 40.34, onset: false }, 40), false);
  assert.equal(hasPitchChangeAttack({ midi: 40.35, onset: false }, 40), true);
});

test("saved assessment requires the shared physical attack for a new performance event", () => {
  const continuation = { midi: 40, onset: false, confidence: 0.9, tick: 480 };
  assert.equal(hasPitchChangeAttack(continuation, 40), false);

  const assessment = evaluateAttempt({
    events: [
      { id: "first", pitches: [40], startTick: 0, durationTicks: 240, isRest: false },
      { id: "second", pitches: [42], startTick: 480, durationTicks: 240, isRest: false },
    ],
    readings: [{ midi: 40, onset: true, confidence: 0.9, tick: 0 }, continuation],
    ticksPerQuarter: 480,
    bpm: 60,
  });

  assert.equal(assessment.events[1].outcome, "MISSING");
});
