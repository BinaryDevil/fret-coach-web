import type { AssessmentResult } from "./attempt-evaluation.mjs";
import type { CreatePracticeAttempt, PracticeAttempt } from "./fretcoach-api";
import type { ScoreNoteEvent } from "./fretcoach-api";

export const MAX_ASSESSABLE_EVENTS: number;
export function selectPrivatePassage(input: { allEvents: ScoreNoteEvent[]; from: number; to: number; scoreRevision?: string }): { events: ScoreNoteEvent[]; reason: string | null; assessable: boolean };
export function inputQualityForConfidence(confidence: number): "PASS" | "RETRY";
export function privateAttemptPayload(input: { assessment: AssessmentResult; allEvents: ScoreNoteEvent[]; scoreImportId: string; trackId: string; from: number; to: number; scoreRevision: string; bpm: number; clientRunId: string; activeDurationMs: number; startedAt: string }): CreatePracticeAttempt | null;
export function reviewFromSavedAttempt(attempt: PracticeAttempt): { accuracyPercent: number; correct: number; total: number; pitchCorrect: number; onsetTimingCorrect: number; inputConfidencePercent: number; saved: true };
