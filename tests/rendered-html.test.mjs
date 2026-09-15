import assert from "node:assert/strict";
import test from "node:test";

test("FretCoach page source declares the practice dashboard", async () => {
  const page = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  );

  assert.match(page, /practice dashboard/);
  assert.match(page, /Recommended for you/);
});
