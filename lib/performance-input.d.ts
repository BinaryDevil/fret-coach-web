import type { PitchReading } from "./pitch-detection";

export type PerformanceInputReading = PitchReading & { capturedAtMs: number };
export type DevelopmentScenario = "PERFECT" | "WRONG_PITCH" | "EARLY_ONSET" | "LATE_ONSET" | "MISSED_EVENT" | "LOW_CONFIDENCE";
export const DEVELOPMENT_SCENARIOS: DevelopmentScenario[];
export function canSavePracticeAttempt(input: { isSimulated: boolean }): boolean;
export type PerformanceInputSource = { start(): Promise<void>; stop(): void; readonly isSimulated: boolean };
export function captureTimestampToTick(input: { capturedAtMs: number; transportStartedAtMs: number; startTick: number; ticksPerQuarter: number; bpm: number }): number;
export function simulatedPerformanceReadings(input: { events: Array<{ isRest?: boolean; pitches: number[]; startTick: number }>; ticksPerQuarter: number; bpm: number; scenario: DevelopmentScenario; captureStartedAtMs?: number }): PerformanceInputReading[];
