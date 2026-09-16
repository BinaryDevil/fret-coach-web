export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
const SESSION_KEY = "fretcoach.session";
export type AuthSession = { accessToken: string; refreshToken: string; user: { id: string; email: string; displayName?: string | null; handedness: "RIGHT" | "LEFT"; tuning: string; timezone: string } };
export type LoopRegion = { id: string; title: string; startMeasure: number; endMeasure: number; defaultBpm?: number | null };
export type ScoreNoteEvent = { id: string; measure: number; beat: number; startTick: number; durationTicks: number; pitches: number[]; isRest: boolean };
export type ScoreTimeline = { version: 1; ticksPerQuarter: number; totalTicks: number; totalMeasures: number; timeSignature: string; defaultBpm: number; events: ScoreNoteEvent[] };
export type Exercise = { id: string; slug: string; title: string; description: string; instructions: string; type: string; difficulty: string; skillFocus: string; estimatedMinutes: number; libraryOrder: number; configuration: { targetBpm: number; bpmRange: [number, number] }; score: { revision: string; format: "ALPHA_TEX" | "GUITAR_PRO" | "MUSIC_XML"; content?: string | null; defaultBpm: number; timeSignature: string; totalMeasures: number; backingTrackUrl?: string | null; backingTrackOffsetMs: number; timeline?: ScoreTimeline | null } | null; loopRegions: LoopRegion[] };
export type DashboardExerciseCard = { id: string; slug: string; type: "CHROMATIC" | "SCALE" | "FINGER_DEXTERITY"; difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED"; title: string; skillFocus: string; estimatedMinutes: number; configuration: { targetBpm?: number; bpmRange?: [number, number]; tags?: string[] }; targetBpm: number | null };
export type DashboardResponse = { nextPractice: DashboardExerciseCard | null; stats: { currentDayStreak: number; averageAccuracyPercent: number; playedThisWeekMs: number }; coachNote: string; recommendations: Array<DashboardExerciseCard & { rank: number }> };
export type PracticeAttemptOutcome = "CORRECT" | "WRONG_PITCH" | "MISSING" | "EXTRA_NOTE";
export type PracticeAttemptNoteResult = { timelineEventId: string; eventIndex: number; outcome: PracticeAttemptOutcome; detectedMidi?: number; correctedMidi?: number; centsOffset?: number; octaveShift?: number; confidence?: number; timingOffsetMs?: number };
export type CreatePracticeAttempt = { clientRunId: string; exerciseId?: string; scoreImportId?: string; trackId?: string; passageStartMeasure?: number; passageEndMeasure?: number; loopRegionId?: string; scoreRevision: string; bpm: number; countInBeats: 0 | 2 | 4; activeDurationMs: number; startedAt: string; noteResults: PracticeAttemptNoteResult[] };
export type PracticeAttemptSummary = { id: string; exerciseId?: string | null; scoreImportId?: string | null; trackId?: string | null; passageStartMeasure?: number | null; passageEndMeasure?: number | null; loopRegionId?: string | null; scoreRevision?: string; bpm: number; activeDurationMs: number; totalTargetEvents: number; correctCount: number; wrongPitchCount: number; missingCount: number; extraNoteCount: number; accuracyPercent: number; completedAt: string; exercise?: { title: string; slug: string } | null };
export type PracticeAttemptPage = { items: PracticeAttemptSummary[]; nextCursor: string | null };
export type PracticeAttempt = PracticeAttemptSummary & { countInBeats: 0 | 2 | 4; startedAt?: string | null; noteResults: Array<PracticeAttemptNoteResult & { measure?: number; beat?: number; startTick?: number; expectedPitches?: number[] }> };
export type ScoreFormat = "GUITAR_PRO" | "MUSIC_XML" | "ALPHA_TEX";
export type ImportedTrack = { id: string; sourceTrackId: string; trackIndex: number; name: string; instrument: string; tuning: number[]; capo?: number | null };
export type ImportedTimeline = { version: number; defaultBpm: number; ticksPerQuarter?: number; tracks: Array<{ id: string; index: number; name: string; instrument: string; tuning: number[]; capo?: number | null }>; events: Array<ScoreNoteEvent & { trackId?: string; sourceTrackId?: string; trackIndex?: number }> };
export type ScoreImport = { id: string; status: "UPLOAD_PENDING" | "PROCESSING" | "READY" | "FAILED"; format: ScoreFormat; originalFileName: string; parseError?: string | null; score?: { revision: string }; song?: { id: string; title: string; artist?: string | null }; timeline?: ImportedTimeline | null; tracks?: ImportedTrack[] };
export type CreateScoreImportResponse = { song: { id: string; title: string; artist?: string | null }; scoreImport: ScoreImport; upload: { uploadUrl: string; uploadMethod: "PUT"; uploadHeaders: Record<string, string>; expiresInSeconds: number } };
export type ScoreImportSource = { id: string; format: ScoreFormat; originalFileName: string; sourceUrl: string; expiresInSeconds: number };
export type ScoreImportListItem = ScoreImport & { createdAt: string; updatedAt: string; song: { id: string; title: string; artist?: string | null } };
export type ScoreImportListPage = { items: ScoreImportListItem[]; nextCursor: string | null };
export function getSession(): AuthSession | null { if (typeof window === "undefined") return null; try { return JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? "null") as AuthSession | null; } catch { return null; } }
export function saveSession(session: AuthSession) { window.localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
export function clearSession() { if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY); }
export class ApiError extends Error { constructor(message: string, readonly status: number) { super(message); } }
let refreshInFlight: Promise<AuthSession | null> | null = null;

async function refreshSession() {
  const existing = getSession();
  if (!existing?.refreshToken) return null;
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE}/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: existing.refreshToken }) })
      .then(async (response) => {
        if (!response.ok) return null;
        const renewed = await response.json() as AuthSession;
        if (!renewed.accessToken || !renewed.refreshToken) return null;
        saveSession(renewed);
        return renewed;
      })
      .catch(() => null)
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

async function request<T>(path: string, options: RequestInit = {}, token?: string, didRefresh = false): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  if (response.status === 401 && token && !didRefresh && path !== "/auth/refresh") {
    const renewed = await refreshSession();
    if (renewed) return request<T>(path, options, renewed.accessToken, true);
    clearSession();
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
    throw new ApiError(Array.isArray(body?.message) ? body.message.join(" ") : body?.message ?? (response.status === 401 ? "Your session has expired. Please sign in again." : "Request failed"), response.status);
  }
  return response.json() as Promise<T>;
}
export function login(email: string, password: string) { return request<AuthSession>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); }
export function register(email: string, password: string, displayName: string) { return request<AuthSession>("/auth/register", { method: "POST", body: JSON.stringify({ email, password, displayName }) }); }
export function loginWithGoogleCredential(credential: string) { return request<AuthSession>("/auth/google", { method: "POST", body: JSON.stringify({ credential }) }); }
export function listExercises(token?: string) { return request<Exercise[]>("/exercises", {}, token); }
export function getDashboard(token: string) { return request<DashboardResponse>("/dashboard/me", {}, token); }
export function getExercise(slug: string, token?: string) { return request<Exercise>(`/exercises/slug/${encodeURIComponent(slug)}`, {}, token); }
export function savePracticeAttempt(attempt: CreatePracticeAttempt, token: string) { return request<PracticeAttempt>("/practice-attempts", { method: "POST", body: JSON.stringify(attempt) }, token); }
export function getPracticeAttempts(token: string, limit = 20, cursor?: string | null, scoreImportId?: string) {
  return request<PracticeAttemptPage>(`/practice-attempts?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}${scoreImportId ? `&scoreImportId=${encodeURIComponent(scoreImportId)}` : ""}`, {}, token);
}
export function getPracticeAttempt(id: string, token: string) { return request<PracticeAttempt>(`/practice-attempts/${encodeURIComponent(id)}`, {}, token); }
export function createScoreImport(input: { title: string; artist?: string; format: ScoreFormat; fileName: string; mimeType: string; sizeBytes: number }, token: string) { return request<CreateScoreImportResponse>("/score-imports", { method: "POST", body: JSON.stringify(input) }, token); }
export function completeScoreImport(importId: string, token: string) { return request<ScoreImport>(`/score-imports/${encodeURIComponent(importId)}/complete`, { method: "POST" }, token); }
export function getScoreImport(importId: string, token: string) { return request<ScoreImport>(`/score-imports/${encodeURIComponent(importId)}`, {}, token); }
export function getScoreImportSource(importId: string, token: string) { return request<ScoreImportSource>(`/score-imports/${encodeURIComponent(importId)}/source`, {}, token); }
export function listScoreImports(token: string, limit = 30, cursor?: string | null) { return request<ScoreImportListPage>(`/score-imports?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, {}, token); }
