import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { evaluateAttempt } from "../lib/attempt-evaluation.mjs";
import { inputQualityForConfidence, privateAttemptPayload, reviewFromSavedAttempt, selectPrivatePassage } from "../lib/private-passage-attempt.mjs";
import { correctionPayload, reviewPrivateAttemptHistory, telemetryPayload } from "../lib/private-attempt-review.mjs";
import { interventionNavigation, privatePassageReturnTarget } from "../lib/private-intervention.mjs";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("built private import page provides lawful-source guidance without publication controls", async () => {
  const upload = await source("../.next/server/app/my-songs/upload.html");
  const library = await source("../components/my-songs-library.tsx");

  assert.match(upload, /Private arrangement/);
  assert.match(upload, /Guitar Pro, MusicXML, or alphaTex/);
  assert.match(upload, /right to use/);
  assert.match(library, /Ready to practice/);
  assert.doesNotMatch(upload, /publishWhenReady|isPublic|Publish this tab/);
  assert.doesNotMatch(library, /VisibilityToggle|Published|Will publish/);
});

test("built routes and API client have no public-tab controls", async () => {
  const [routes, api] = await Promise.all([
    source("../.next/server/app-paths-manifest.json"),
    source("../lib/fretcoach-api.ts"),
  ]);

  assert.doesNotMatch(routes, /\/tabs/);
  assert.doesNotMatch(api, /PublicScore|public-scores|updateScoreVisibility|isPublic|publishedAt/);
  await assert.rejects(access(new URL("../app/tabs/page.tsx", import.meta.url)));
  await assert.rejects(access(new URL("../app/tabs/[importId]/page.tsx", import.meta.url)));
});

test("private-song practice selects assessable passages and retains evidence-backed Attempts", async () => {
  const [player, api] = await Promise.all([
    source("../components/imported-song-practice.tsx"),
    source("../lib/fretcoach-api.ts"),
  ]);

  assert.match(player, /evaluateAttempt/);
  assert.match(player, /Input quality/);
  assert.match(player, /This passage is not assessable/);
  assert.match(player, /scoreImportId/);
  assert.match(player, /passageStartMeasure/);
  assert.match(player, /savePracticeAttempt/);
  assert.match(player, /Saved Attempt/);
  assert.match(player, /Accuracy rating/);
  assert.match(api, /scoreImportId\?: string/);
  assert.match(api, /getPracticeAttempt/);
  assert.match(api, /scoreImportId=/);
});

test("private passage behavior selects, checks input, assesses, saves, and reloads evidence", () => {
  const allEvents = [
    { id: "first", measure: 1, pitches: [40], startTick: 0, durationTicks: 240, isRest: false },
    { id: "second", measure: 1, pitches: [42], startTick: 480, durationTicks: 240, isRest: false },
  ];
  const passage = selectPrivatePassage({ allEvents, from: 1, to: 1, scoreRevision: "revision-1" });
  assert.equal(passage.assessable, true);
  assert.equal(inputQualityForConfidence(0.9), "PASS");

  const assessment = evaluateAttempt({ events: passage.events, readings: [{ midi: 40, tick: 0, confidence: 0.9, onset: true }, { midi: 42, tick: 480, confidence: 0.8, onset: true }], ticksPerQuarter: 480, bpm: 120 });
  const payload = privateAttemptPayload({ assessment, allEvents, scoreImportId: "private-song", trackId: "timeline-track", from: 1, to: 1, scoreRevision: "revision-1", bpm: 120, clientRunId: "00000000-0000-4000-8000-000000000001", activeDurationMs: 500, startedAt: "2026-09-16T00:00:00.000Z" });
  assert.deepEqual(payload?.noteResults.map((result) => result.outcome), ["CORRECT", "CORRECT"]);
  assert.equal(payload?.scoreImportId, "private-song");

  const reloaded = reviewFromSavedAttempt({ id: "attempt", scoreImportId: "private-song", trackId: "timeline-track", passageStartMeasure: 1, passageEndMeasure: 1, scoreRevision: "revision-1", bpm: 120, activeDurationMs: 500, totalTargetEvents: 2, correctCount: 2, wrongPitchCount: 0, missingCount: 0, extraNoteCount: 0, accuracyPercent: 100, completedAt: "2026-09-16T00:00:01.000Z", countInBeats: 0, noteResults: payload?.noteResults ?? [] });
  assert.deepEqual(reloaded, { accuracyPercent: 100, correct: 2, total: 2, pitchCorrect: 2, onsetTimingCorrect: 2, inputConfidencePercent: 85, saved: true });

  const unassessable = selectPrivatePassage({ allEvents: [{ ...allEvents[0], pitches: [40, 44] }], from: 1, to: 1, scoreRevision: "revision-1" });
  assert.equal(unassessable.assessable, false);
  assert.match(unassessable.reason, /not assessable/);
});

test("passage assessment retains the 32-note boundary used by the range picker", () => {
  const allEvents = Array.from({ length: 33 }, (_, index) => ({ id: `note-${index}`, measure: index < 16 ? 1 : 2, pitches: [40], startTick: index * 120, durationTicks: 120, isRest: false }));

  assert.equal(selectPrivatePassage({ allEvents, from: 1, to: 1, scoreRevision: "revision-1" }).assessable, true);
  assert.equal(selectPrivatePassage({ allEvents, from: 1, to: 2, scoreRevision: "revision-1" }).assessable, false);
});

test("the first reliable private Attempt becomes a quiet Baseline", () => {
  const attempt = { id: "baseline", scoreRevision: "revision-1", bpm: 90, totalTargetEvents: 2, correctCount: 1, wrongPitchCount: 1, missingCount: 0, accuracyPercent: 50, noteResults: [{ timelineEventId: "first", eventIndex: 0, outcome: "WRONG_PITCH" }, { timelineEventId: "second", eventIndex: 1, outcome: "CORRECT" }] };

  assert.deepEqual(reviewPrivateAttemptHistory({ baselineAttemptId: "baseline", items: [attempt] }), {
    baselineId: "baseline",
    comparison: null,
    weakPoint: { kind: "PITCH", eventId: "first", observed: "Wrong pitch on 1 of 2 notes." },
    intervention: { label: "Intervention hypothesis", action: "Slow the passage and prioritize clean fretting on the weak note." },
  });
});

test("later like-for-like private Attempts show meaningful change from the Baseline", () => {
  const baseline = { id: "baseline", scoreRevision: "revision-1", bpm: 90, totalTargetEvents: 2, correctCount: 1, wrongPitchCount: 1, missingCount: 0, accuracyPercent: 50, noteResults: [] };
  const later = { id: "later", scoreRevision: "revision-1", bpm: 90, totalTargetEvents: 2, correctCount: 2, wrongPitchCount: 0, missingCount: 0, accuracyPercent: 100, noteResults: [] };

  assert.deepEqual(reviewPrivateAttemptHistory({ baselineAttemptId: "baseline", items: [baseline, later] }).comparison, { baselineAccuracyPercent: 50, accuracyChangePercent: 50, message: "50 points above your Baseline." });
  assert.equal(reviewPrivateAttemptHistory({ baselineAttemptId: "baseline", items: [baseline, { ...later, bpm: 100 }] }).comparison, null);
});

test("a private weak point recommends a curated exercise and returns to the selected passage", () => {
  const navigation = interventionNavigation({
    weakPoint: { kind: "PITCH", eventId: "first", observed: "Wrong pitch on 1 of 2 notes." },
    target: { scoreImportId: "private-song", trackId: "timeline-track", from: 2, to: 3 },
  });

  assert.deepEqual(navigation.recommendation, {
    slug: "chromatic-1-2-3-4",
    title: "1-2-3-4 Spider Exercise",
    reason: "Build cleaner fretting before returning to this passage.",
  });
  assert.equal(navigation.href, "/practice?slug=chromatic-1-2-3-4&returnTo=%2Fmy-songs%2Fprivate-song%3Ftrack%3Dtimeline-track%26from%3D2%26to%3D3");
  assert.doesNotMatch(navigation.href, /scoreImportId|mastered|progress/);

  const returnTo = new URL(navigation.href, "https://fretcoach.test").searchParams.get("returnTo");
  assert.deepEqual(privatePassageReturnTarget(returnTo), { scoreImportId: "private-song", trackId: "timeline-track", from: 2, to: 3 });

  const exerciseResult = evaluateAttempt({ events: [{ id: "exercise-note", pitches: [40], startTick: 0, durationTicks: 240, isRest: false }], readings: [{ midi: 40, tick: 0, confidence: 0.9, onset: true }], ticksPerQuarter: 480, bpm: 60 });
  assert.equal(exerciseResult.rating?.accuracyPercent, 100);
  assert.equal(exerciseResult.assessable, true);
});

test("correction feedback is separate from Attempt evidence and telemetry requires consent", () => {
  assert.deepEqual(correctionPayload({ subject: "INTERVENTION", isHelpful: false, note: "This did not match the problem." }), { subject: "INTERVENTION", isHelpful: false, note: "This did not match the problem." });
  assert.equal(telemetryPayload({ consent: false, scoreImportId: "private-song", eventType: "REVIEW_SHOWN" }), null);
  assert.deepEqual(telemetryPayload({ consent: true, scoreImportId: "private-song", attemptId: "attempt", eventType: "REVIEW_SHOWN", trackId: "timeline-track", passageStartMeasure: 1, passageEndMeasure: 1 }), { consent: true, scoreImportId: "private-song", attemptId: "attempt", eventType: "REVIEW_SHOWN", trackId: "timeline-track", passageStartMeasure: 1, passageEndMeasure: 1 });
  assert.deepEqual(telemetryPayload({ consent: true, scoreImportId: "private-song", attemptId: "attempt", eventType: "RETURNED" }), { consent: true, scoreImportId: "private-song", attemptId: "attempt", eventType: "RETURNED" });
});
