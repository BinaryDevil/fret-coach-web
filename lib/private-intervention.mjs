const RECOMMENDATIONS = {
  PITCH: { slug: "chromatic-1-2-3-4", title: "1-2-3-4 Spider Exercise", reason: "Build cleaner fretting before returning to this passage." },
  TIMING: { slug: "chromatic-1-2-3-4", title: "1-2-3-4 Spider Exercise", reason: "Build steadier finger timing before returning to this passage." },
  MISSING: { slug: "chromatic-1-2-3-4", title: "1-2-3-4 Spider Exercise", reason: "Build a more reliable finger pattern before returning to this passage." },
  CONSISTENCY: { slug: "chromatic-1-2-3-4", title: "1-2-3-4 Spider Exercise", reason: "Build a repeatable finger pattern before returning to this passage." },
};

export function interventionNavigation({ weakPoint, target }) {
  const recommendation = RECOMMENDATIONS[weakPoint.kind] ?? RECOMMENDATIONS.CONSISTENCY;
  const returnTo = `/my-songs/${encodeURIComponent(target.scoreImportId)}?${new URLSearchParams({ track: target.trackId, from: String(target.from), to: String(target.to) })}`;
  return { recommendation, href: `/practice?${new URLSearchParams({ slug: recommendation.slug, returnTo })}` };
}

export function privatePassageReturnTarget(value) {
  if (!value?.startsWith("/my-songs/") || value.startsWith("//")) return null;
  const url = new URL(value, "https://fretcoach.test");
  const scoreImportId = decodeURIComponent(url.pathname.slice("/my-songs/".length));
  const trackId = url.searchParams.get("track");
  const from = Number(url.searchParams.get("from"));
  const to = Number(url.searchParams.get("to"));
  if (!scoreImportId || scoreImportId.includes("/") || !trackId || !Number.isInteger(from) || from < 1 || !Number.isInteger(to) || to < from) return null;
  return { scoreImportId, trackId, from, to };
}
