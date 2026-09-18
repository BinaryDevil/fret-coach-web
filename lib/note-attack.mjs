export const PITCH_CHANGE_ATTACK_THRESHOLD = 0.35;

export function hasPitchChangeAttack(reading, previousMidi) {
  return reading.onset || previousMidi === undefined || Math.abs(reading.midi - previousMidi) >= PITCH_CHANGE_ATTACK_THRESHOLD;
}
