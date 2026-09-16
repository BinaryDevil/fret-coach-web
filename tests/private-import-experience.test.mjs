import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { evaluateAttempt } from "../lib/attempt-evaluation.mjs";
import { inputQualityForConfidence, privateAttemptPayload, reviewFromSavedAttempt, selectPrivatePassage } from "../lib/private-passage-attempt.mjs";

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
