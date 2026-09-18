export const PITCH_CHANGE_ATTACK_THRESHOLD: number;
export function hasPitchChangeAttack(reading: { midi: number; onset: boolean }, previousMidi: number | undefined): boolean;
