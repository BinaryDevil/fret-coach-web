import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("practice controls keep common actions visible and label setup options", async () => {
  const studio = await readFile(new URL("../components/practice-studio.tsx", import.meta.url), "utf8");

  assert.match(studio, /Practice options/);
  assert.match(studio, /Practice assist/);
  assert.match(studio, /Count-in/);
  assert.match(studio, /Target passage/);
  assert.match(studio, /Restart target passage/);
  assert.match(studio, /Changes live status only\. It does not change your Accuracy rating\./);
});

test("both practice players use the development-only input boundary and save guard", async () => {
  const [source, studio, imported] = await Promise.all([
    readFile(new URL("../components/performance-input.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/practice-studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/imported-song-practice.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(source, /process\.env\.NODE_ENV !== "production"/);
  assert.match(source, /Development simulator — results are not saved\./);
  assert.match(source, /simulatedPerformanceReadings/);
  for (const player of [studio, imported]) {
    assert.match(player, /<PerformanceInput/);
    assert.match(player, /captureTimestampToTick/);
    assert.match(player, /canSavePracticeAttempt/);
  }
});

test("practice without assessment can be turned back on and reviews do not offer diagnostics downloads", async () => {
  const studio = await readFile(new URL("../components/practice-studio.tsx", import.meta.url), "utf8");

  assert.match(studio, /setAssessmentEnabled\(true\)/);
  assert.match(studio, /Use Accuracy rating/);
  assert.doesNotMatch(studio, /Download diagnostics/);
});
