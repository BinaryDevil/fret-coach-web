export type PitchReading = { frequency: number; midi: number; confidence: number; rms: number; onset: boolean };
export type PitchMatch = { expectedMidi: number; rawMidi: number; correctedMidi: number; cents: number; octaveShift: number; inTune: boolean };

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

export function midiToFrequency(midi: number) { return 440 * (2 ** ((midi - 69) / 12)); }

export function midiToNoteName(midi: number) {
  const rounded = Math.round(midi);
  return `${NOTE_NAMES[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`;
}

export function pitchMatch(reading: PitchReading, expectedPitches: number[], centsTolerance = 45): PitchMatch | null {
  if (!expectedPitches.length) return null;
  const candidate = expectedPitches.map((expectedMidi) => {
    const octaveShift = Math.round((reading.midi - expectedMidi) / 12);
    return { expectedMidi, correctedMidi: reading.midi, octaveShift, cents: (reading.midi - expectedMidi) * 100 };
  }).sort((left, right) => Math.abs(left.cents) - Math.abs(right.cents))[0];
  return { ...candidate, rawMidi: reading.midi, inTune: Math.abs(candidate.cents) <= centsTolerance };
}

export function medianPitch(readings: PitchReading[]): PitchReading | null {
  if (!readings.length) return null;
  const ordered = [...readings].sort((left, right) => left.midi - right.midi);
  return ordered[Math.floor(ordered.length / 2)];
}

export function detectPitch(samples: Float32Array, sampleRate: number): Omit<PitchReading, "rms" | "onset"> | null {
  let energy = 0;
  for (const sample of samples) energy += sample * sample;
  if (Math.sqrt(energy / samples.length) < 0.006) return null;

  const limit = Math.floor(samples.length / 2);
  const difference = new Float32Array(limit);
  for (let lag = 1; lag < limit; lag += 1) {
    let sum = 0;
    for (let index = 0; index < limit; index += 1) {
      const delta = samples[index] - samples[index + lag];
      sum += delta * delta;
    }
    difference[lag] = sum;
  }

  let runningSum = 0;
  let candidate = -1;
  for (let lag = 1; lag < limit; lag += 1) {
    runningSum += difference[lag];
    const normalized = runningSum ? (difference[lag] * lag) / runningSum : 1;
    difference[lag] = normalized;
    if (lag > 2 && normalized < 0.12) {
      candidate = lag;
      while (candidate + 1 < limit && difference[candidate + 1] < difference[candidate]) candidate += 1;
      break;
    }
  }
  if (candidate < 0) return null;
  const before = difference[candidate - 1] ?? difference[candidate];
  const current = difference[candidate];
  const after = difference[candidate + 1] ?? current;
  const adjustment = 2 * current - before - after;
  const refinedLag = candidate + (adjustment ? (after - before) / (2 * adjustment) : 0);
  const frequency = sampleRate / refinedLag;
  if (!Number.isFinite(frequency) || frequency < 55 || frequency > 1400) return null;
  return { frequency, midi: 69 + 12 * Math.log2(frequency / 440), confidence: Math.max(0, Math.min(1, 1 - current)) };
}
