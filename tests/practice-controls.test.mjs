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
