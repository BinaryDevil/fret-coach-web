"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, CreatePracticeAttempt, Exercise, getExercise, getSession, PracticeAttemptOutcome, savePracticeAttempt } from "../lib/fretcoach-api";
import { midiToNoteName, PitchReading } from "../lib/pitch-detection";
import { DEFAULT_PRACTICE_STRICTNESS, findTargetForReading, isNewNoteAttack, LastAcceptedPitch, PRACTICE_STRICTNESS, PracticeStrictnessId, ticksToMilliseconds } from "../lib/practice-evaluation";
import { ASSESSMENT_CRITERIA } from "../lib/attempt-evaluation.mjs";
import { evaluateAttempt } from "../lib/attempt-evaluation.mjs";
import { safePrivatePassageReturn } from "../lib/private-intervention.mjs";
import { AudioInput, AudioInputHandle } from "./audio-input";
import { HomeNavigation } from "./home-navigation";
import styles from "./practice-studio.module.css";

type AlphaApi = { tex: (value: string) => void; destroy?: () => void; scoreLoaded?: { on: (listener: () => void) => void } };
type Playhead = { left: number; top: number; height: number };
type NoteState = "pending" | "correct" | "wrong-pitch" | "missing" | "extra-note";
type PassSummary = { assessable: boolean; accuracy: number; correct: number; wrongPitch: number; missing: number; extraNotes: number; total: number; pitchCorrect: number; onsetTimingCorrect: number; inputConfidencePercent: number };
type InputQuality = "CHECK" | "PASS" | "RETRY" | "PRACTICE_WITHOUT_ASSESSMENT";
type NoteDiagnostic = { detectedMidi: number; correctedMidi: number; centsOffset: number; octaveShift: number; confidence: number; timingOffsetMs: number };
type SaveStatus = "saving" | "saved" | "retrying" | "unsaved" | "stale";
type PracticeTraceEntry = {
  elapsedMs: number;
  tick: number;
  activeEventIndex: number;
  detectedMidi: number;
  detectedNote: string;
  confidence: number;
  rms: number;
  onset: boolean;
  decision: "ignored" | "no-target" | "matched";
  targetEventIndex?: number;
  targetEventId?: string;
  expectedMidi?: number[];
  centsOffset?: number;
  octaveShift?: number;
  result?: NoteState;
};

// TODO(practice-transport): Keep the curated player aligned with the shared imported-song
// transport when restart/measure looping and rhythm-accurate synthesized guitar preview land.

export function PracticeStudio() {
  const router = useRouter();
  const search = useSearchParams();
  const slug = search.get("slug") ?? "chromatic-1-2-3-4";
  const returnTo = safePrivatePassageReturn(search.get("returnTo"));
  const practicePath = `/practice?${new URLSearchParams({ slug, ...(returnTo ? { returnTo } : {}) })}`;
  const scoreViewElement = useRef<HTMLDivElement>(null);
  const scoreElement = useRef<HTMLDivElement>(null);
  const apiRef = useRef<AlphaApi | null>(null);
  const inputRef = useRef<AudioInputHandle>(null);
  const clockRef = useRef<AudioContext | null>(null);
  const startRef = useRef(0);
  const elapsedRef = useRef(0);
  const currentTickRef = useRef(0);
  const activeIndexRef = useRef(0);
  const loopRef = useRef(-1);
  const countInStartRef = useRef(0);
  const countInFrameRef = useRef<number | null>(null);
  const lastScoredPitchRef = useRef<LastAcceptedPitch>(null);
  const playingRef = useRef(false);
  const noteStatesRef = useRef<Record<string, NoteState>>({});
  const noteDiagnosticsRef = useRef<Record<string, NoteDiagnostic>>({});
  const practiceTraceRef = useRef<PracticeTraceEntry[]>([]);
  const clientRunIdRef = useRef<string | null>(null);
  const attemptStartedAtMsRef = useRef<number | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retrySaveRef = useRef<(() => void) | null>(null);
  const frameRef = useRef<number | null>(null);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [bpm, setBpm] = useState(60);
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState(0);
  const [playhead, setPlayhead] = useState<Playhead | null>(null);
  const [loopId, setLoopId] = useState("");
  const [countInBeats, setCountInBeats] = useState(4);
  const [strictness, setStrictness] = useState<PracticeStrictnessId>(DEFAULT_PRACTICE_STRICTNESS.id);
  const [countInBeat, setCountInBeat] = useState(0);
  const [noteStates, setNoteStates] = useState<Record<string, NoteState>>({});
  const [detectedPitch, setDetectedPitch] = useState<PitchReading | null>(null);
  const [summary, setSummary] = useState<PassSummary | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);
  const [saveError, setSaveError] = useState("");
  const [inputQuality, setInputQuality] = useState<InputQuality>("CHECK");
  const [assessmentEnabled, setAssessmentEnabled] = useState(true);

  const loadExercise = useCallback(() => {
    const session = getSession();
    if (!session) {
      router.replace(`/login?next=${encodeURIComponent(practicePath)}`);
      return Promise.resolve();
    }
    return getExercise(slug, session.accessToken)
      .then((item) => { setExercise(item); setBpm(item.configuration.targetBpm); setLoopId(item.loopRegions[0]?.id ?? ""); })
      .catch((cause) => { setError(cause instanceof Error ? cause.message : "Unable to load exercise"); })
      .finally(() => setLoading(false));
  }, [practicePath, router, slug]);

  useEffect(() => { void loadExercise(); }, [loadExercise]);

  useEffect(() => () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); }, []);

  useEffect(() => {
    const content = exercise?.score?.content;
    if (!content || exercise.score?.format !== "ALPHA_TEX") return;
    const scoreContent = content;
    let cancelled = false;
    async function renderScore() {
      const alphaTab = await import("@coderline/alphatab");
      if (cancelled || !scoreElement.current) return;
      const api = new alphaTab.AlphaTabApi(scoreElement.current, { core: { tex: false, fontDirectory: "/font/", useWorkers: false }, display: { layoutMode: alphaTab.LayoutMode.Page, scale: 1.12 } }) as AlphaApi;
      apiRef.current = api;
      api.tex(scoreContent);
    }
    void renderScore();
    return () => { cancelled = true; apiRef.current?.destroy?.(); apiRef.current = null; };
  }, [exercise]);

  const timeline = exercise?.score?.timeline;
  const events = useMemo(() => timeline?.events ?? [], [timeline]);
  const activeLoop = useMemo(() => exercise?.loopRegions.find((region) => region.id === loopId) ?? exercise?.loopRegions[0], [exercise, loopId]);
  const range = useMemo(() => {
    const selected = events.map((event, index) => ({ event, index })).filter(({ event }) => event.measure >= (activeLoop?.startMeasure ?? 1) && event.measure <= (activeLoop?.endMeasure ?? Number.MAX_SAFE_INTEGER));
    const first = selected[0];
    const last = selected.at(-1);
    return first && last ? { start: first.index, end: last.index + 1, startTick: first.event.startTick, endTick: last.event.startTick + last.event.durationTicks } : null;
  }, [activeLoop, events]);
  const activeEvent = events[active];
  const activeState: NoteState = activeEvent ? noteStates[activeEvent.id] ?? "pending" : "pending";

  const updateStates = useCallback((update: (previous: Record<string, NoteState>) => Record<string, NoteState>) => {
    const next = update(noteStatesRef.current);
    if (next !== noteStatesRef.current) { noteStatesRef.current = next; setNoteStates(next); }
  }, []);

  const saveFinalizedAttempt = useCallback((finalStates: Record<string, NoteState>, activeDurationMs: number) => {
    if (!exercise?.score?.revision || !range) return;
    const session = getSession();
    if (!session) return;
    const clientRunId = clientRunIdRef.current ?? crypto.randomUUID();
    clientRunIdRef.current = clientRunId;
    const noteResults = events
      .map((event, eventIndex) => ({ event, eventIndex }))
      .filter(({ eventIndex, event }) => eventIndex >= range.start && eventIndex < range.end && !event.isRest)
      .map(({ event, eventIndex }) => ({
        timelineEventId: event.id,
        eventIndex,
        outcome: outcomeForState(finalStates[event.id] ?? "missing"),
        ...noteDiagnosticsRef.current[event.id],
      }));
    const payload: CreatePracticeAttempt = {
      clientRunId,
      exerciseId: exercise.id,
      ...(activeLoop ? { loopRegionId: activeLoop.id } : {}),
      scoreRevision: exercise.score.revision,
      bpm,
      countInBeats: countInBeats as 0 | 2 | 4,
      activeDurationMs: Math.round(activeDurationMs),
      startedAt: new Date(attemptStartedAtMsRef.current ?? Date.now() - activeDurationMs).toISOString(),
      noteResults,
    };
    const submit = (retry: number) => {
      if (clientRunIdRef.current !== clientRunId) return;
      setSaveStatus(retry ? "retrying" : "saving");
      setSaveError("");
      const latestSession = getSession();
      if (!latestSession) { setSaveStatus("unsaved"); setSaveError("Sign in again to save this pass."); return; }
      void savePracticeAttempt(payload, latestSession.accessToken)
        .then(() => { if (clientRunIdRef.current === clientRunId) { setSaveStatus("saved"); retrySaveRef.current = null; } })
        .catch((cause) => {
          if (clientRunIdRef.current !== clientRunId) return;
          if (cause instanceof ApiError && cause.status === 409) {
            if (clientRunIdRef.current === clientRunId) {
              noteStatesRef.current = {};
              noteDiagnosticsRef.current = {};
              setNoteStates({});
              setSummary(null);
              setSaveStatus("stale");
              void loadExercise();
            }
            return;
          }
          if (retry < 3) {
            retryTimerRef.current = setTimeout(() => submit(retry + 1), 1000 * 2 ** retry);
            return;
          }
          setSaveStatus("unsaved");
          setSaveError(cause instanceof Error ? cause.message : "The server did not accept this result.");
        });
    };
    retrySaveRef.current = () => submit(0);
    submit(0);
  }, [activeLoop, bpm, countInBeats, events, exercise, loadExercise, range]);

  const finishPass = useCallback((activeDurationMs: number) => {
    if (!range) return;
    const finalStates = { ...noteStatesRef.current };
    for (let index = range.start; index < range.end; index += 1) {
      const event = events[index];
      if (!event.isRest && !finalStates[event.id]) finalStates[event.id] = "missing";
    }
    const assessment = assessmentEnabled ? evaluateAttempt({ events: events.slice(range.start, range.end), readings: practiceTraceRef.current.map((reading) => ({ midi: reading.detectedMidi, tick: reading.tick, confidence: reading.confidence, onset: reading.onset })), ticksPerQuarter: timeline?.ticksPerQuarter ?? 480, bpm }) : null;
    if (assessment?.assessable && assessment.rating) {
      for (const outcome of assessment.events) finalStates[outcome.eventId] = outcome.outcome === "CORRECT" ? "correct" : outcome.outcome === "WRONG_PITCH" ? "wrong-pitch" : "missing";
      setSummary({ assessable: true, accuracy: assessment.rating.accuracyPercent, correct: assessment.rating.correct, wrongPitch: assessment.events.filter((event: { outcome: string }) => event.outcome === "WRONG_PITCH").length, missing: assessment.events.filter((event: { outcome: string }) => event.outcome === "MISSING" || event.outcome === "WRONG_TIMING").length, extraNotes: 0, total: assessment.rating.total, pitchCorrect: assessment.rating.pitchCorrect, onsetTimingCorrect: assessment.rating.onsetTimingCorrect, inputConfidencePercent: assessment.rating.inputConfidencePercent });
      saveFinalizedAttempt(finalStates, activeDurationMs);
    } else {
      setSummary({ assessable: false, accuracy: 0, correct: 0, wrongPitch: 0, missing: 0, extraNotes: 0, total: events.slice(range.start, range.end).filter((event) => !event.isRest).length, pitchCorrect: 0, onsetTimingCorrect: 0, inputConfidencePercent: 0 });
    }
    noteStatesRef.current = finalStates;
    setNoteStates(finalStates);
    playingRef.current = false;
    setPlaying(false);
  }, [assessmentEnabled, bpm, events, range, saveFinalizedAttempt, timeline]);

  useEffect(() => {
    if (!range) return;
    activeIndexRef.current = range.start;
    currentTickRef.current = range.startTick;
    const frame = requestAnimationFrame(() => setActive(range.start));
    return () => cancelAnimationFrame(frame);
  }, [range]);

  useEffect(() => {
    const saved = window.localStorage.getItem("fretcoach-practice-strictness") as PracticeStrictnessId | null;
    if (!saved || !PRACTICE_STRICTNESS.some((option) => option.id === saved)) return;
    const frame = requestAnimationFrame(() => setStrictness(saved));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => { window.localStorage.setItem("fretcoach-practice-strictness", strictness); }, [strictness]);

  useEffect(() => {
    const score = scoreElement.current;
    const view = scoreViewElement.current;
    if (!score || !view || !events.length) return;
    const highlightActiveBeat = () => {
      score.querySelectorAll(".fretcoach-current-beat,.fretcoach-note-correct,.fretcoach-note-wrong-pitch,.fretcoach-note-missing,.fretcoach-note-extra-note").forEach((element) => element.classList.remove("fretcoach-current-beat", "fretcoach-note-correct", "fretcoach-note-wrong-pitch", "fretcoach-note-missing", "fretcoach-note-extra-note"));
      const markers = Array.from(score.querySelectorAll<SVGGElement>(`.b${active}`));
      markers.forEach((element) => element.classList.add("fretcoach-current-beat", `fretcoach-note-${activeState}`));
      const viewBounds = view.getBoundingClientRect();
      const bounds = markers.map((element) => element.getBoundingClientRect()).filter((item) => item.width > 0 && item.height > 0);
      if (!bounds.length) return;
      const left = bounds.reduce((total, item) => total + item.left + item.width / 2, 0) / bounds.length - viewBounds.left;
      const top = Math.min(...bounds.map((item) => item.top)) - viewBounds.top;
      const bottom = Math.max(...bounds.map((item) => item.bottom)) - viewBounds.top;
      setPlayhead({ left, top, height: bottom - top });
      if (playingRef.current) {
        const markerTop = Math.min(...bounds.map((item) => item.top));
        const markerBottom = Math.max(...bounds.map((item) => item.bottom));
        const safeTop = window.innerHeight * 0.24;
        const safeBottom = window.innerHeight * 0.76;
        if (markerTop < safeTop || markerBottom > safeBottom) {
          window.scrollTo({ top: Math.max(0, window.scrollY + (markerTop + markerBottom) / 2 - window.innerHeight * 0.48), behavior: "smooth" });
        }
      }
    };
    highlightActiveBeat();
    const observer = new MutationObserver(highlightActiveBeat);
    observer.observe(score, { childList: true, subtree: true });
    window.addEventListener("resize", highlightActiveBeat);
    return () => { observer.disconnect(); window.removeEventListener("resize", highlightActiveBeat); };
  }, [active, activeState, events.length]);

  const metronome = useCallback((accent: boolean) => {
    const context = clockRef.current;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = accent ? 1046.5 : 783.99;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.15 : 0.09, context.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.055);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 0.06);
  }, []);

  const beginAttempt = useCallback((now: number) => {
    startRef.current = now - elapsedRef.current;
    loopRef.current = -1;
    if (!clientRunIdRef.current) clientRunIdRef.current = crypto.randomUUID();
    if (!attemptStartedAtMsRef.current) attemptStartedAtMsRef.current = Date.now() - elapsedRef.current;
    playingRef.current = true;
    setPlaying(true);
  }, []);

  useEffect(() => {
    if (!countInBeat) return;
    const millisecondsPerBeat = 60_000 / bpm;
    const step = () => {
      const now = (clockRef.current?.currentTime ?? performance.now() / 1000) * 1000;
      const currentBeat = Math.floor((now - countInStartRef.current) / millisecondsPerBeat) + 1;
      if (currentBeat > countInBeats) {
        elapsedRef.current = 0;
        setCountInBeat(0);
        beginAttempt(now);
        metronome(true);
        return;
      }
      if (currentBeat !== countInBeat) {
        setCountInBeat(currentBeat);
        metronome(currentBeat === 1);
      }
      countInFrameRef.current = requestAnimationFrame(step);
    };
    countInFrameRef.current = requestAnimationFrame(step);
    return () => { if (countInFrameRef.current) cancelAnimationFrame(countInFrameRef.current); };
  }, [beginAttempt, bpm, countInBeat, countInBeats, metronome]);

  useEffect(() => {
    if (!playing || !timeline || !range) return;
    const millisecondsPerTick = ticksToMilliseconds(1, timeline.ticksPerQuarter, bpm);
    const loopDuration = ticksToMilliseconds(range.endTick - range.startTick, timeline.ticksPerQuarter, bpm);
    const toleranceTicks = ASSESSMENT_CRITERIA.onsetTimingToleranceMs / millisecondsPerTick;
    const step = () => {
      const now = (clockRef.current?.currentTime ?? performance.now() / 1000) * 1000;
      const rawElapsed = Math.max(0, now - startRef.current);
      if (rawElapsed >= loopDuration) {
        finishPass(rawElapsed);
        return;
      }
      const tick = range.startTick + (rawElapsed / millisecondsPerTick);
      currentTickRef.current = tick;
      elapsedRef.current = rawElapsed;
      let index = range.start;
      for (let candidate = range.start; candidate < range.end; candidate += 1) {
        if (events[candidate].startTick <= tick) index = candidate; else break;
      }
      if (index !== activeIndexRef.current) {
        activeIndexRef.current = index;
        setActive(index);
        const event = events[index];
        metronome(event.beat === 1);
      }
      updateStates((previous) => {
        let next = previous;
        for (let index = range.start; index < range.end; index += 1) {
          const event = events[index];
          if (event.startTick + event.durationTicks + toleranceTicks < tick && !previous[event.id]) {
            if (next === previous) next = { ...previous };
            next[event.id] = "missing";
          }
        }
        return next;
      });
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [bpm, events, finishPass, metronome, playing, range, timeline, updateStates]);

  const handlePitch = useCallback((reading: PitchReading) => {
    setDetectedPitch(reading);
    if (assessmentEnabled) setInputQuality((quality) => reading.confidence >= ASSESSMENT_CRITERIA.minimumInputConfidence ? "PASS" : quality === "CHECK" ? "RETRY" : quality);
    const trace: PracticeTraceEntry = {
      elapsedMs: Math.round(elapsedRef.current),
      tick: Math.round(currentTickRef.current),
      activeEventIndex: activeIndexRef.current,
      detectedMidi: Math.round(reading.midi * 100) / 100,
      detectedNote: midiToNoteName(reading.midi),
      confidence: Math.round(reading.confidence * 1000) / 1000,
      rms: Math.round(reading.rms * 10000) / 10000,
      onset: reading.onset,
      decision: "ignored",
    };
    const addTrace = () => {
      if (practiceTraceRef.current.length < 2_000) practiceTraceRef.current.push(trace);
    };
    if (!playingRef.current || !timeline || !range || reading.confidence < 0.65) { addTrace(); return; }
    const millisecondsPerTick = ticksToMilliseconds(1, timeline.ticksPerQuarter, bpm);
    const target = findTargetForReading(events, range, currentTickRef.current, millisecondsPerTick, reading, noteStatesRef.current);
    if (!target) { trace.decision = "no-target"; addTrace(); return; }
    const event = events[target.index];
    const match = target.match;
    const nextState: NoteState = match.inTune ? "correct" : "wrong-pitch";
    trace.decision = "matched";
    trace.targetEventIndex = target.index;
    trace.targetEventId = event.id;
    trace.expectedMidi = event.pitches;
    trace.centsOffset = Math.round(match.cents);
    trace.octaveShift = match.octaveShift;
    trace.result = nextState;
    addTrace();
    const isCorrection = noteStatesRef.current[event.id] === "wrong-pitch" && match.inTune;
    if (!isCorrection && !isNewNoteAttack(reading, event.id, lastScoredPitchRef.current)) return;
    if (!isCorrection) lastScoredPitchRef.current = { eventId: event.id, midi: reading.midi };
    updateStates((previous) => {
      if (previous[event.id] === "correct") return previous;
      noteDiagnosticsRef.current[event.id] = {
        detectedMidi: reading.midi,
        correctedMidi: match.correctedMidi,
        centsOffset: Math.round(match.cents),
        octaveShift: match.octaveShift,
        confidence: reading.confidence,
        timingOffsetMs: Math.round((currentTickRef.current - event.startTick) * millisecondsPerTick),
      };
      return { ...previous, [event.id]: nextState };
    });
  }, [assessmentEnabled, bpm, events, range, timeline, updateStates]);

  const play = () => {
    if (playing || countInBeat) { playingRef.current = false; setPlaying(false); setCountInBeat(0); return; }
    const Constructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Constructor && !clockRef.current) clockRef.current = new Constructor();
    void clockRef.current?.resume();
    void inputRef.current?.start();
    setSummary(null);
    lastScoredPitchRef.current = null;
    const now = (clockRef.current?.currentTime ?? performance.now() / 1000) * 1000;
    if (countInBeats) {
      countInStartRef.current = now;
      setCountInBeat(1);
      metronome(true);
      return;
    }
    beginAttempt(now);
    metronome(true);
  };
  const reset = useCallback(() => {
    playingRef.current = false;
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    setPlaying(false); setCountInBeat(0); elapsedRef.current = 0; loopRef.current = -1; lastScoredPitchRef.current = null; clientRunIdRef.current = null; attemptStartedAtMsRef.current = null; retrySaveRef.current = null; noteDiagnosticsRef.current = {}; practiceTraceRef.current = []; setSummary(null); setSaveStatus(null); setSaveError(""); setInputQuality("CHECK"); setAssessmentEnabled(true);
    if (range) { setActive(range.start); activeIndexRef.current = range.start; currentTickRef.current = range.startTick; }
    updateStates(() => ({}));
  }, [range, updateStates]);
  const updateBpm = (value: number) => {
    if (timeline && range) {
      const progressedTicks = Math.max(0, currentTickRef.current - range.startTick);
      elapsedRef.current = ticksToMilliseconds(progressedTicks, timeline.ticksPerQuarter, value);
      const now = (clockRef.current?.currentTime ?? performance.now() / 1000) * 1000;
      startRef.current = now - elapsedRef.current;
    }
    setBpm(value);
  };
  const downloadDiagnostics = () => {
    if (!exercise || !timeline || !range) return;
    const payload = {
      version: 1,
      generatedAt: new Date().toISOString(),
      exercise: { id: exercise.id, slug: exercise.slug, title: exercise.title },
      transport: { bpm, countInBeats, practiceAssist: strictness, assessmentCriteria: ASSESSMENT_CRITERIA, ticksPerQuarter: timeline.ticksPerQuarter },
      range: { startEventIndex: range.start, endEventIndex: range.end - 1, startTick: range.startTick, endTick: range.endTick },
      expectedEvents: events.map((event, eventIndex) => ({ event, eventIndex })).filter(({ eventIndex, event }) => eventIndex >= range.start && eventIndex < range.end && !event.isRest).map(({ event, eventIndex }) => ({ eventIndex, id: event.id, startTick: event.startTick, durationTicks: event.durationTicks, pitches: event.pitches, measure: event.measure, beat: event.beat, state: noteStatesRef.current[event.id] ?? "missing" })),
      readings: practiceTraceRef.current,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `fretcoach-diagnostics-${exercise.slug}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <main className={styles.state}>Loading your exercise…</main>;
  if (error || !exercise || !exercise.score?.content) return <main className={styles.state}><p>{error || "This exercise does not have a playable score yet."}</p><Link href="/library">Back to library</Link></main>;
  if (exercise.score.format !== "ALPHA_TEX") return <main className={styles.state}><p>This score format will be available soon.</p><Link href="/library">Back to library</Link></main>;
  if (!timeline || !events.length || !range) return <main className={styles.state}><p>This exercise is still preparing its practice timeline.</p><Link href="/library">Back to library</Link></main>;

  const isCountingIn = countInBeat > 0;
  const expected = activeEvent?.isRest ? "Rest" : activeEvent?.pitches.map(midiToNoteName).join(" + ") ?? "—";
  const feedbackLabel = activeState.replace("-", " ");
  const isSpiderExercise = slug === "chromatic-1-2-3-4";
  const title = isSpiderExercise ? "1-2-3-4 Spider Exercise" : exercise.title;
  const instructions = isSpiderExercise ? "Start at 60 BPM, and raise the tempo by 5 BPM after each clean pass." : exercise.instructions;
  const loopTitle = isSpiderExercise ? "Full loop" : activeLoop?.title ?? "Full loop";
  return <main className={styles.page}>
    <HomeNavigation />
    <div className={styles.practiceContext}><b>{title}</b><small>{instructions}</small></div>
    <section className={styles.scoreCard}>
      <div className={styles.scoreLabel}><span>{exercise.score.timeSignature} · {exercise.score.totalMeasures} measures</span><span className={styles.currentNote}>{isCountingIn ? `GET READY · ${countInBeat} / ${countInBeats}` : playing ? "NOW PLAYING" : "NEXT NOTE"} · {active + 1} of {events.length}</span><span>{loopTitle} · one pass · measures {activeLoop?.startMeasure ?? 1}–{activeLoop?.endMeasure ?? exercise.score.totalMeasures}</span></div>
      <div className={styles.feedback} aria-live="polite"><span>PLAY <b>{expected}</b></span><span className={styles[`state${activeState.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}`]}>● {readingStatus(detectedPitch, activeState, feedbackLabel)}</span></div>
      <div ref={scoreViewElement} className={styles.scoreView}><div ref={scoreElement} className="alphaTab" />{playhead && <div aria-hidden="true" className={`${styles.playhead} ${styles[`playhead${activeState.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}`] ?? ""}`} style={{ left: playhead.left, top: playhead.top, height: playhead.height }} />}</div>
    </section>
    <section className={styles.inputQuality} aria-label="Input quality">
      <div><p>INPUT QUALITY</p><strong>{inputQuality === "PASS" ? "Ready for assessment" : inputQuality === "RETRY" ? "Try your input again" : inputQuality === "PRACTICE_WITHOUT_ASSESSMENT" ? "Practice without assessment" : "Check your input"}</strong><span>{inputQuality === "PASS" ? "A clear note was detected with enough confidence for an Accuracy rating." : inputQuality === "RETRY" ? "Play a clear note, reduce background sound, or choose a different input." : inputQuality === "PRACTICE_WITHOUT_ASSESSMENT" ? "You can practice, but this Attempt will not receive an Accuracy rating." : "Connect your guitar and play one clear note before starting an assessable Attempt."}</span></div>
      <div><button onClick={() => void inputRef.current?.start()}>Check input</button><button className={styles.withoutAssessment} onClick={() => { setAssessmentEnabled(false); setInputQuality("PRACTICE_WITHOUT_ASSESSMENT"); }}>Practice without assessment</button></div>
    </section>
    <section className={styles.metronome} aria-label="Metronome controls"><div className={styles.beats} aria-label={`Beat ${isCountingIn ? countInBeat : activeEvent?.beat ?? 1} of 4`}>{[1, 2, 3, 4].map((beat) => <i className={(isCountingIn ? beat === countInBeat : playing && beat === activeEvent?.beat) ? styles.beatActive : ""} key={beat} />)}</div><button className={styles.play} onClick={play} aria-label={playing || isCountingIn ? "Pause practice" : "Start practice"}>{playing || isCountingIn ? "❚❚" : "▶"}</button><div className={styles.tempo}><button onClick={() => updateBpm(Math.max(exercise.configuration.bpmRange[0], bpm - 1))} aria-label="Decrease BPM">−</button><b>{bpm}<small>BPM</small></b><button onClick={() => updateBpm(Math.min(exercise.configuration.bpmRange[1], bpm + 1))} aria-label="Increase BPM">+</button></div><input type="range" aria-label="Tempo in BPM" min={exercise.configuration.bpmRange[0]} max={exercise.configuration.bpmRange[1]} value={bpm} onChange={(event) => updateBpm(Number(event.target.value))}/><select aria-label="Scoring strictness" value={strictness} onChange={(event) => setStrictness(event.target.value as PracticeStrictnessId)}>{PRACTICE_STRICTNESS.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select><select aria-label="Count-in beats" value={countInBeats} onChange={(event) => setCountInBeats(Number(event.target.value))}><option value={0}>No count-in</option><option value={2}>2-beat count-in</option><option value={4}>4-beat count-in</option></select><select aria-label="Loop region" value={loopId} onChange={(event) => { setLoopId(event.target.value); reset(); }}>{exercise.loopRegions.map((region) => <option value={region.id} key={region.id}>{isSpiderExercise ? "Full loop" : region.title} · bars {region.startMeasure}–{region.endMeasure}</option>)}</select>{playing && <button className={styles.finish} onClick={() => finishPass(elapsedRef.current)}>Finish & review</button>}<button className={styles.reset} onClick={reset} aria-label="Restart exercise">↺</button></section>
    {summary && <div className={styles.resultOverlay} role="presentation"><section className={styles.resultModal} role="dialog" aria-modal="true" aria-labelledby="practice-result-title"><p>{summary.assessable ? "ATTEMPT REVIEW" : "UNASSESSABLE ATTEMPT"}</p><h2 id="practice-result-title">{summary.assessable ? `${summary.accuracy}% Accuracy rating` : "No Accuracy rating"}</h2>{summary.assessable ? <><span className={styles.resultCounts}>{summary.correct} / {summary.total} correct · {summary.wrongPitch} wrong pitch · {summary.missing} missed</span><div className={styles.ratingEvidence}><span>Pitch <b>{summary.pitchCorrect} / {summary.total}</b></span><span>Onset timing <b>{summary.onsetTimingCorrect} / {summary.total}</b></span><span>Input confidence <b>{summary.inputConfidencePercent}%</b></span></div><p className={styles.resultAdvice}>{resultAdvice(summary)}</p><small className={styles.saveStatus}>{saveMessage(saveStatus)}{saveError ? ` ${saveError}` : ""}</small></> : <p className={styles.resultAdvice}>Your input was not clear enough for a trustworthy Performance diagnosis. Adjust your input or choose practice without assessment again.</p>}<div><button onClick={reset}>Practice again</button>{summary.assessable && saveStatus === "unsaved" && <button onClick={() => retrySaveRef.current?.()}>Retry save</button>}{summary.assessable && <button onClick={downloadDiagnostics}>Download diagnostics</button>}<Link href={returnTo ?? "/library"}>{returnTo ? "Return to your passage" : "Back to library"}</Link></div></section></div>}
    <AudioInput ref={inputRef} onPitchDetected={handlePitch} targetMidi={activeEvent?.pitches[0] ?? null} />
  </main>;
}

function readingStatus(reading: PitchReading | null, state: NoteState, fallback: string) {
  if (!reading) return fallback;
  if (reading.onset) return "pluck detected";
  return state === "pending" ? "waiting for pluck" : fallback;
}

function outcomeForState(state: NoteState): PracticeAttemptOutcome {
  if (state === "correct") return "CORRECT";
  if (state === "wrong-pitch") return "WRONG_PITCH";
  if (state === "extra-note") return "EXTRA_NOTE";
  return "MISSING";
}

function saveMessage(status: SaveStatus | null) {
  if (status === "saving") return "Saving result…";
  if (status === "retrying") return "Saving result again…";
  if (status === "saved") return "Saved to history";
  if (status === "unsaved") return "Couldn’t save this result";
  return "";
}

function resultAdvice(summary: PassSummary) {
  if (summary.accuracy >= 90) return "Strong pass. Raise the tempo a little when this feels relaxed.";
  if (summary.wrongPitch >= summary.missing) return "Slow down slightly and prioritize clean fretting before increasing tempo.";
  return "Try another pass at this tempo and focus on landing each note with the click.";
}
