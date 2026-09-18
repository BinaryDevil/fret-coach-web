import assert from "node:assert/strict";
import test from "node:test";
import { hasPitchChangeAttack } from "../lib/note-attack.mjs";

test("a note attack accepts an onset or a meaningful pitch change", () => {
  assert.equal(hasPitchChangeAttack({ midi: 40, onset: true }, 40), true);
  assert.equal(hasPitchChangeAttack({ midi: 40, onset: false }, undefined), true);
  assert.equal(hasPitchChangeAttack({ midi: 40.34, onset: false }, 40), false);
  assert.equal(hasPitchChangeAttack({ midi: 40.35, onset: false }, 40), true);
});
