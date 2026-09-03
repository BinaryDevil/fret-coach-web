import { ScoreNoteEvent } from "./fretcoach-api";
import { pitchMatch, PitchReading } from "./pitch-detection";

export const PRACTICE_STRICTNESS = [
  { id: "guided", label: "1 · Guided", centsTolerance: 85, timingToleranceMs: 400 },
  { id: "relaxed", label: "2 · Relaxed", centsTolerance: 65, timingToleranceMs: 330 },
  { id: "balanced", label: "3 · Balanced", centsTolerance: 45, timingToleranceMs: 260 },
  { id: "precise", label: "4 · Precise", centsTolerance: 30, timingToleranceMs: 190 },
  { id: "exact", label: "5 · Exact", centsTolerance: 20, timingToleranceMs: 130 },
] as const;

export type PracticeStrictness = (typeof PRACTICE_STRICTNESS)[number];
export type PracticeStrictnessId = PracticeStrictness["id"];
export const DEFAULT_PRACTICE_STRICTNESS = PRACTICE_STRICTNESS[1];
export const PRACTICE_TIMING_TOLERANCE_MS = DEFAULT_PRACTICE_STRICTNESS.timingToleranceMs;
export const ticksToMilliseconds = (ticks: number, ticksPerQuarter: number, bpm: number) => (ticks / ticksPerQuarter) * (60_000 / bpm);

export type LastAcceptedPitch = { eventId: string; midi: number } | null;

/**
 * A physical pluck is usually an amplitude onset, but compressed guitar inputs
 * may flatten that transient. A new, meaningfully different pitch assigned to
 * a new score event is therefore also accepted as an attack. Repeated pitches
 * still require an actual onset, preventing a sustained note scoring repeats.
 */
export function isNewNoteAttack(reading: PitchReading, eventId: string, previous: LastAcceptedPitch) {
  return reading.onset || (previous?.eventId !== eventId && (!previous || Math.abs(reading.midi - previous.midi) >= 0.35));
}

export function findTargetForReading(events: ScoreNoteEvent[], range: { start: number; end: number }, tick: number, millisecondsPerTick: number, reading: PitchReading, resolved: Record<string, string>, strictness: PracticeStrictness = DEFAULT_PRACTICE_STRICTNESS) {
  const toleranceTicks = strictness.timingToleranceMs / millisecondsPerTick;
  let best: { index: number; match: NonNullable<ReturnType<typeof pitchMatch>>; distance: number } | null = null;
  for (let index = range.start; index < range.end; index += 1) {
    const event = events[index];
    // A later correct attack can replace an early wrong-pitch reading in this window.
    if (event.isRest || resolved[event.id] === "correct") continue;
    if (tick < event.startTick - toleranceTicks || tick > event.startTick + event.durationTicks + toleranceTicks) continue;
    const match = pitchMatch(reading, event.pitches, strictness.centsTolerance);
    if (!match || Math.abs(match.cents) > 500) continue;
    const distance = Math.abs(tick - (event.startTick + event.durationTicks / 2));
    if (!best || distance < best.distance) best = { index, match, distance };
  }
  return best;
}
