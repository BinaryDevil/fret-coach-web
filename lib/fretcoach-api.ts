export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
const SESSION_KEY = "fretcoach.session";
export type AuthSession = { accessToken: string; refreshToken: string; user: { id: string; email: string; displayName: string } };
export type LoopRegion = { id: string; title: string; startMeasure: number; endMeasure: number; defaultBpm?: number | null };
export type ScoreNoteEvent = { id: string; measure: number; beat: number; startTick: number; durationTicks: number; pitches: number[]; isRest: boolean };
export type ScoreTimeline = { version: 1; ticksPerQuarter: number; totalTicks: number; totalMeasures: number; timeSignature: string; defaultBpm: number; events: ScoreNoteEvent[] };
export type Exercise = { id: string; slug: string; title: string; description: string; instructions: string; type: string; difficulty: string; configuration: { targetBpm: number; bpmRange: [number, number] }; score: { format: "ALPHA_TEX" | "GUITAR_PRO" | "MUSIC_XML"; content?: string | null; defaultBpm: number; timeSignature: string; totalMeasures: number; backingTrackUrl?: string | null; backingTrackOffsetMs: number; timeline?: ScoreTimeline | null } | null; loopRegions: LoopRegion[] };
export function getSession(): AuthSession | null { if (typeof window === "undefined") return null; try { return JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? "null") as AuthSession | null; } catch { return null; } }
export function saveSession(session: AuthSession) { window.localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> { const response = await fetch(`${API_BASE}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } }); if (!response.ok) { const body = await response.json().catch(() => null) as { message?: string | string[] } | null; throw new Error(Array.isArray(body?.message) ? body.message.join(" ") : body?.message ?? "Request failed"); } return response.json() as Promise<T>; }
export function login(email: string, password: string) { return request<AuthSession>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); }
export function register(email: string, password: string, displayName: string) { return request<AuthSession>("/auth/register", { method: "POST", body: JSON.stringify({ email, password, displayName }) }); }
export function listExercises(token?: string) { return request<Exercise[]>("/exercises", {}, token); }
export function getExercise(slug: string, token?: string) { return request<Exercise>(`/exercises/slug/${encodeURIComponent(slug)}`, {}, token); }
