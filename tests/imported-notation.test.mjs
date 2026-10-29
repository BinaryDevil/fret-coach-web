import test from "node:test";
import assert from "node:assert/strict";
import * as alpha from "@coderline/alphatab";
import { prepareImportedNotation } from "../lib/imported-notation.mjs";

test("renders a hidden percussion staff and returns to guitar", () => {
  const settings = new alpha.Settings();
  settings.core.engine = "svg";
  const score = alpha.importer.ScoreLoader.loadAlphaTex(". 3.3 5.3 |", settings);
  const drums = alpha.importer.ScoreLoader.loadAlphaTex(". 3.3 5.3 |", settings).tracks[0];
  score.addTrack(drums);
  const staff = drums.staves[0];
  staff.isPercussion = true;
  staff.showStandardNotation = false;
  staff.showTablature = false;
  prepareImportedNotation(score);
  const renderer = new alpha.rendering.ScoreRenderer(settings);
  renderer.width = 800;
  const errors = [];
  renderer.error.on(error => errors.push(error));
  let rendered = 0;
  renderer.renderFinished.on(() => rendered++);
  for (const [step, track] of [0, 1, 0].entries()) {
    renderer.renderScore(score, [track]);
    assert.deepEqual(errors, []);
    assert.equal(renderer.tracks[0], score.tracks[track]);
    assert.equal(rendered, step + 1);
  }
  assert.equal(staff.showStandardNotation, true);
});
