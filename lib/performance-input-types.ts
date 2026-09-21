import type { PitchReading } from "./pitch-detection";

/** Stable boundary shared by microphone and development performance sources. */
export type PerformanceInputReading = PitchReading & { capturedAtMs: number };
export type DevelopmentScenario = "PERFECT" | "WRONG_PITCH" | "EARLY_ONSET" | "LATE_ONSET" | "MISSED_EVENT" | "LOW_CONFIDENCE";
export type PerformanceInputState = "idle" | "connecting" | "connected" | "unsupported" | "denied" | "error";
export type PerformanceInputSource = {
  start(): Promise<void>;
  stop(): void;
  readonly isSimulated: boolean;
  readonly state: PerformanceInputState;
};
