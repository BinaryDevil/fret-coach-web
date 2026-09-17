const RECOMMENDATIONS = {
  PITCH: { slug: "chromatic-1-2-3-4", title: "1-2-3-4 Spider Exercise", reason: "Build cleaner fretting before returning to this passage." },
  TIMING: { slug: "chromatic-1-2-3-4", title: "1-2-3-4 Spider Exercise", reason: "Build steadier finger timing before returning to this passage." },
  MISSING: { slug: "chromatic-1-2-3-4", title: "1-2-3-4 Spider Exercise", reason: "Build a more reliable finger pattern before returning to this passage." },
  CONSISTENCY: { slug: "chromatic-1-2-3-4", title: "1-2-3-4 Spider Exercise", reason: "Build a repeatable finger pattern before returning to this passage." },
};

export function interventionNavigation({ weakPoint, scoreImportId, trackId, from, to }) {
  const recommendation = RECOMMENDATIONS[weakPoint.kind] ?? RECOMMENDATIONS.CONSISTENCY;
  const returnTo = `/my-songs/${encodeURIComponent(scoreImportId)}?${new URLSearchParams({ track: trackId, from: String(from), to: String(to) })}`;
  return { recommendation, href: `/practice?${new URLSearchParams({ slug: recommendation.slug, returnTo })}` };
}

export function safePrivatePassageReturn(value) {
  return value?.startsWith("/my-songs/") && !value.startsWith("//") ? value : null;
}
