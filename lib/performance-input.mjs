export const DEVELOPMENT_SCENARIOS = ["PERFECT", "WRONG_PITCH", "EARLY_ONSET", "LATE_ONSET", "MISSED_EVENT", "LOW_CONFIDENCE"];

// Every player calls this guard immediately before its persistence path.
export function canSavePracticeAttempt({ isSimulated }) {
  return !isSimulated;
}

const millisecondsPerTick = (ticksPerQuarter, bpm) => (60_000 / bpm) / ticksPerQuarter;
const frequencyForMidi = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function captureTimestampToTick({ capturedAtMs, transportStartedAtMs, startTick, ticksPerQuarter, bpm }) {
  return startTick + (capturedAtMs - transportStartedAtMs) / millisecondsPerTick(ticksPerQuarter, bpm);
}

export function simulatedPerformanceReadings({ events, ticksPerQuarter, bpm, scenario, captureStartedAtMs = 0 }) {
  const playable = events.filter((event) => !event.isRest && event.pitches.length === 1);
  const originTick = playable[0]?.startTick ?? 0;
  const offsetMs = 320;
  return playable.flatMap((event, index) => {
    if (scenario === "MISSED_EVENT" && index === 0) return [];
    const intendedMs = (event.startTick - originTick) * millisecondsPerTick(ticksPerQuarter, bpm);
    const timingScenarioIndex = playable.length > 1 ? 1 : -1;
    const shiftedMs = scenario === "EARLY_ONSET" && index === timingScenarioIndex ? intendedMs - offsetMs : scenario === "LATE_ONSET" && index === timingScenarioIndex ? intendedMs + offsetMs : intendedMs;
    const midi = scenario === "WRONG_PITCH" && index === 0 ? event.pitches[0] + 2 : event.pitches[0];
    return [{ frequency: frequencyForMidi(midi), midi, confidence: scenario === "LOW_CONFIDENCE" ? 0.3 : 0.92, rms: scenario === "LOW_CONFIDENCE" ? 0.004 : 0.06, onset: true, capturedAtMs: captureStartedAtMs + Math.max(0, shiftedMs) }];
  });
}
