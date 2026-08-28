export type PitchReading = { frequency: number; midi: number; confidence: number };

export function midiToNoteName(midi: number) {
  const names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const rounded = Math.round(midi);
  return `${names[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`;
}

export function detectPitch(samples: Float32Array, sampleRate: number): PitchReading | null {
  let energy = 0;
  for (const sample of samples) energy += sample * sample;
  if (Math.sqrt(energy / samples.length) < 0.008) return null;

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
