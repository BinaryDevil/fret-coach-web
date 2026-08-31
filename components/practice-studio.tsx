"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Exercise, getExercise, getSession } from "../lib/fretcoach-api";
import { midiToNoteName, PitchReading } from "../lib/pitch-detection";
import { AudioInput, AudioInputHandle } from "./audio-input";
import styles from "./practice-studio.module.css";

type AlphaApi = { tex: (value: string) => void; destroy?: () => void; scoreLoaded?: { on: (listener: () => void) => void } };
type Playhead = { left: number; top: number; height: number };
type NoteState = "pending" | "correct" | "wrong-pitch" | "missing" | "extra-note";
type PassSummary = { accuracy: number; correct: number; wrongPitch: number; missing: number; extraNotes: number; total: number };

const TIMING_TOLERANCE_MS = 125;
const PITCH_STABILITY_MS = 180;
const tickToMilliseconds = (tick: number, ticksPerQuarter: number, currentBpm: number) => (tick / ticksPerQuarter) * (60_000 / currentBpm);

export function PracticeStudio() {
  const search = useSearchParams();
  const slug = search.get("slug") ?? "chromatic-1-2-3-4";
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
  const pitchCandidateRef = useRef<{ eventId: string; state: NoteState; since: number } | null>(null);
  const playingRef = useRef(false);
  const noteStatesRef = useRef<Record<string, NoteState>>({});
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
  const [countInBeat, setCountInBeat] = useState(0);
  const [noteStates, setNoteStates] = useState<Record<string, NoteState>>({});
  const [detectedPitch, setDetectedPitch] = useState<PitchReading | null>(null);
  const [summary, setSummary] = useState<PassSummary | null>(null);

  useEffect(() => {
    const session = getSession();
    void getExercise(slug, session?.accessToken)
      .then((item) => { setExercise(item); setBpm(item.configuration.targetBpm); setLoopId(item.loopRegions[0]?.id ?? ""); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load exercise"))
      .finally(() => setLoading(false));
  }, [slug]);

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

  useEffect(() => {
    if (!range) return;
    activeIndexRef.current = range.start;
    currentTickRef.current = range.startTick;
    const frame = requestAnimationFrame(() => setActive(range.start));
    return () => cancelAnimationFrame(frame);
  }, [range]);

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

  useEffect(() => {
    if (!countInBeat) return;
    const millisecondsPerBeat = 60_000 / bpm;
    const step = () => {
      const now = (clockRef.current?.currentTime ?? performance.now() / 1000) * 1000;
      const currentBeat = Math.floor((now - countInStartRef.current) / millisecondsPerBeat) + 1;
      if (currentBeat > countInBeats) {
        elapsedRef.current = 0;
        startRef.current = now;
        loopRef.current = -1;
        playingRef.current = true;
        setCountInBeat(0);
        setPlaying(true);
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
  }, [bpm, countInBeat, countInBeats, metronome]);

  useEffect(() => {
    if (!playing || !timeline || !range) return;
    const millisecondsPerTick = tickToMilliseconds(1, timeline.ticksPerQuarter, bpm);
    const loopDuration = tickToMilliseconds(range.endTick - range.startTick, timeline.ticksPerQuarter, bpm);
    const toleranceTicks = TIMING_TOLERANCE_MS / millisecondsPerTick;
    const step = () => {
      const now = (clockRef.current?.currentTime ?? performance.now() / 1000) * 1000;
      const rawElapsed = Math.max(0, now - startRef.current);
      if (rawElapsed >= loopDuration) {
        const finalStates = { ...noteStatesRef.current };
        for (let index = range.start; index < range.end; index += 1) {
          const event = events[index];
          if (!finalStates[event.id]) finalStates[event.id] = "missing";
        }
        noteStatesRef.current = finalStates;
        setNoteStates(finalStates);
        const targets = events.slice(range.start, range.end).filter((event) => !event.isRest);
        const count = (state: NoteState) => targets.filter((event) => finalStates[event.id] === state).length;
        const correct = count("correct");
        setSummary({ accuracy: targets.length ? Math.round((correct / targets.length) * 100) : 0, correct, wrongPitch: count("wrong-pitch"), missing: count("missing"), extraNotes: events.slice(range.start, range.end).filter((event) => finalStates[event.id] === "extra-note").length, total: targets.length });
        playingRef.current = false;
        setPlaying(false);
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
  }, [bpm, events, metronome, playing, range, timeline, updateStates]);

  const handlePitch = useCallback((reading: PitchReading) => {
    setDetectedPitch(reading);
    if (!playingRef.current || !timeline || !range || reading.confidence < 0.65) return;
    const event = events[activeIndexRef.current];
    if (!event) return;
    const millisecondsPerTick = tickToMilliseconds(1, timeline.ticksPerQuarter, bpm);
    const toleranceTicks = TIMING_TOLERANCE_MS / millisecondsPerTick;
    if (currentTickRef.current < event.startTick - toleranceTicks || currentTickRef.current > event.startTick + event.durationTicks + toleranceTicks) return;
    const matches = !event.isRest && event.pitches.some((expected) => Math.abs(expected - reading.midi) <= 0.5);
    const nextState: NoteState = event.isRest ? "extra-note" : matches ? "correct" : "wrong-pitch";
    const now = performance.now();
    const candidate = pitchCandidateRef.current;
    if (!candidate || candidate.eventId !== event.id || candidate.state !== nextState) {
      pitchCandidateRef.current = { eventId: event.id, state: nextState, since: now };
      return;
    }
    if (now - candidate.since < PITCH_STABILITY_MS) return;
    updateStates((previous) => {
      if (previous[event.id] === "correct") return previous;
      return { ...previous, [event.id]: nextState };
    });
  }, [bpm, events, range, timeline, updateStates]);

  const play = () => {
    if (playing || countInBeat) { playingRef.current = false; setPlaying(false); setCountInBeat(0); return; }
    const Constructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Constructor && !clockRef.current) clockRef.current = new Constructor();
    void clockRef.current?.resume();
    void inputRef.current?.start();
    setSummary(null);
    pitchCandidateRef.current = null;
    const now = (clockRef.current?.currentTime ?? performance.now() / 1000) * 1000;
    if (countInBeats) {
      countInStartRef.current = now;
      setCountInBeat(1);
      metronome(true);
      return;
    }
    startRef.current = now - elapsedRef.current;
    loopRef.current = -1;
    playingRef.current = true;
    setPlaying(true);
    metronome(true);
  };
  const reset = useCallback(() => {
    playingRef.current = false;
    setPlaying(false); setCountInBeat(0); elapsedRef.current = 0; loopRef.current = -1; pitchCandidateRef.current = null; setSummary(null);
    if (range) { setActive(range.start); activeIndexRef.current = range.start; currentTickRef.current = range.startTick; }
    updateStates(() => ({}));
  }, [range, updateStates]);
  const updateBpm = (value: number) => {
    if (timeline && range) {
      const progressedTicks = Math.max(0, currentTickRef.current - range.startTick);
      elapsedRef.current = tickToMilliseconds(progressedTicks, timeline.ticksPerQuarter, value);
      const now = (clockRef.current?.currentTime ?? performance.now() / 1000) * 1000;
      startRef.current = now - elapsedRef.current;
    }
    setBpm(value);
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
    <header className={styles.header}><Link className={styles.brand} href="/library"><span>F</span>FretCoach</Link><div><b>{title}</b><small>{instructions}</small></div></header>
    <section className={styles.scoreCard}>
      <div className={styles.scoreLabel}><span>{exercise.score.timeSignature} · {exercise.score.totalMeasures} measures</span><span className={styles.currentNote}>{isCountingIn ? `GET READY · ${countInBeat} / ${countInBeats}` : playing ? "NOW PLAYING" : "NEXT NOTE"} · {active + 1} of {events.length}</span><span>{loopTitle} · measures {activeLoop?.startMeasure ?? 1}–{activeLoop?.endMeasure ?? exercise.score.totalMeasures}</span></div>
      <div className={styles.feedback} aria-live="polite"><span>EXPECTED <b>{expected}</b></span><span>INPUT <b>{detectedPitch ? midiToNoteName(detectedPitch.midi) : "—"}</b></span><span className={styles[`state${activeState.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}`]}>● {feedbackLabel}</span></div>
      <div ref={scoreViewElement} className={styles.scoreView}><div ref={scoreElement} className="alphaTab" />{playhead && <div aria-hidden="true" className={`${styles.playhead} ${styles[`playhead${activeState.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}`] ?? ""}`} style={{ left: playhead.left, top: playhead.top, height: playhead.height }} />}</div>
    </section>
    <section className={styles.metronome} aria-label="Metronome controls"><div className={styles.beats} aria-label={`Beat ${isCountingIn ? countInBeat : activeEvent?.beat ?? 1} of 4`}>{[1, 2, 3, 4].map((beat) => <i className={(isCountingIn ? beat === countInBeat : playing && beat === activeEvent?.beat) ? styles.beatActive : ""} key={beat} />)}</div><button className={styles.play} onClick={play} aria-label={playing || isCountingIn ? "Pause practice" : "Start practice"}>{playing || isCountingIn ? "❚❚" : "▶"}</button><div className={styles.tempo}><button onClick={() => updateBpm(Math.max(exercise.configuration.bpmRange[0], bpm - 1))} aria-label="Decrease BPM">−</button><b>{bpm}<small>BPM</small></b><button onClick={() => updateBpm(Math.min(exercise.configuration.bpmRange[1], bpm + 1))} aria-label="Increase BPM">+</button></div><input type="range" aria-label="Tempo in BPM" min={exercise.configuration.bpmRange[0]} max={exercise.configuration.bpmRange[1]} value={bpm} onChange={(event) => updateBpm(Number(event.target.value))}/><select aria-label="Count-in beats" value={countInBeats} onChange={(event) => setCountInBeats(Number(event.target.value))}><option value={0}>No count-in</option><option value={2}>2-beat count-in</option><option value={4}>4-beat count-in</option></select><select aria-label="Loop region" value={loopId} onChange={(event) => { setLoopId(event.target.value); reset(); }}>{exercise.loopRegions.map((region) => <option value={region.id} key={region.id}>{isSpiderExercise ? "Full loop" : region.title} · bars {region.startMeasure}–{region.endMeasure}</option>)}</select><button className={styles.reset} onClick={reset} aria-label="Restart exercise">↺</button></section>
    {summary && <section className={styles.summary} aria-live="polite"><p>PASS COMPLETE</p><strong>{summary.accuracy}%</strong><span>{summary.correct} / {summary.total} correct · {summary.wrongPitch} wrong pitch · {summary.missing} missed{summary.extraNotes ? ` · ${summary.extraNotes} extra` : ""}</span><button onClick={reset}>Practice again</button></section>}
    <AudioInput ref={inputRef} onPitchDetected={handlePitch} />
  </main>;
}
