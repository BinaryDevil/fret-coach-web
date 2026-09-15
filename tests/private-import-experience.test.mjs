import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

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
