/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioInput, AudioInputHandle } from "./audio-input";
import { ApiError, getPracticeAttempt, getPracticeAttempts, getSession, ImportedTimeline, ImportedTrack, savePracticeAttempt } from "../lib/fretcoach-api";
import { ASSESSMENT_CRITERIA, evaluateAttempt } from "../lib/attempt-evaluation.mjs";
import { inputQualityForConfidence, privateAttemptPayload, reviewFromSavedAttempt, selectPrivatePassage } from "../lib/private-passage-attempt.mjs";
import { midiToNoteName, PitchReading } from "../lib/pitch-detection";
import { ticksToMilliseconds } from "../lib/practice-evaluation";
import styles from "./imported-song-practice.module.css";

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
type InputQuality = "CHECK" | "PASS" | "RETRY";
type AttemptReview = { accuracyPercent: number; correct: number; total: number; pitchCorrect: number; onsetTimingCorrect: number; inputConfidencePercent: number; saved: boolean };

export function ImportedSongPractice({ timeline, track, scoreImportId, scoreRevision, onActiveBeatChange }: { timeline: ImportedTimeline; track: ImportedTrack | null; scoreImportId: string; scoreRevision?: string; onActiveBeatChange?: (beat: number) => void }) {
  const input = useRef<AudioInputHandle>(null);
  const audio = useRef<AudioContext | null>(null);
  const frame = useRef<number | null>(null);
  const started = useRef(0);
  const currentTick = useRef(0);
  const readings = useRef<Array<{ midi: number; tick: number; confidence: number; onset: boolean }>>([]);
  const previewNodes = useRef<OscillatorNode[]>([]);
  const previewTimer = useRef<number | null>(null);
  const attemptStartedAt = useRef<number | null>(null);
  const [bpm, setBpm] = useState(timeline.defaultBpm);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [inputQuality, setInputQuality] = useState<InputQuality>("CHECK");
  const [review, setReview] = useState<AttemptReview | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const q = timeline.ticksPerQuarter ?? 960;
  const all = useMemo(() => timeline.events.filter((event) => !event.isRest && (!track || !event.trackId || event.trackId === track.sourceTrackId || event.trackId === track.id)), [timeline.events, track]);
  const measures = useMemo(() => [...new Set(all.map((event) => event.measure))], [all]);
  const [from, setFrom] = useState(measures[0] ?? 1);
  const [to, setTo] = useState(measures.at(-1) ?? 1);
  const passage = useMemo(() => selectPrivatePassage({ allEvents: all, from, to, scoreRevision }), [all, from, scoreRevision, to]);
  const events: ImportedTimeline["events"] = passage.events;
  const current = events[active];
  const assessabilityReason = passage.reason;
  const assessable = passage.assessable;

  const resetAttempt = useCallback(() => {
    readings.current = [];
    attemptStartedAt.current = null;
    setActive(0);
    setReview(null);
    setSaveMessage("");
  }, []);

  useEffect(() => {
    setFrom(measures[0] ?? 1);
    setTo(measures.at(-1) ?? 1);
    setBpm(timeline.defaultBpm);
    resetAttempt();
  }, [measures, resetAttempt, timeline.defaultBpm]);
  useEffect(() => { onActiveBeatChange?.(current?.beat ?? 0); }, [current?.beat, onActiveBeatChange]);
  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    previewNodes.current.forEach((node) => { try { node.stop(); } catch { /* already stopped */ } });
    void input.current?.stop();
  }, []);

  const readSavedAttempt = useCallback(() => {
    const session = getSession();
    if (!session || !track) return;
    void getPracticeAttempts(session.accessToken, 50, undefined, scoreImportId)
      .then(async ({ items }) => {
        const saved = items.find((attempt) => attempt.trackId === track.sourceTrackId && attempt.passageStartMeasure === from && attempt.passageEndMeasure === to && attempt.scoreRevision === scoreRevision);
        return saved ? getPracticeAttempt(saved.id, session.accessToken) : null;
      })
      .then((attempt) => { if (attempt) setReview(reviewFromSavedAttempt(attempt)); })
      .catch(() => undefined);
  }, [from, scoreImportId, scoreRevision, to, track]);
  useEffect(() => { readSavedAttempt(); }, [readSavedAttempt]);

  const context = () => {
    if (!audio.current) audio.current = new AudioContext();
    void audio.current.resume();
    return audio.current;
  };
  const stop = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = null;
    setPlaying(false);
    void input.current?.stop();
  }, []);

  const persist = useCallback((assessment: ReturnType<typeof evaluateAttempt>, activeDurationMs: number) => {
    if (!assessment.rating || !track || !scoreRevision) return;
    const session = getSession();
    if (!session) { setSaveMessage("Sign in again to save this Attempt."); return; }
    const payload = privateAttemptPayload({ assessment, allEvents: all, scoreImportId, trackId: track.sourceTrackId, from, to, scoreRevision, bpm, clientRunId: crypto.randomUUID(), activeDurationMs, startedAt: new Date(attemptStartedAt.current ?? Date.now() - activeDurationMs).toISOString() });
    if (!payload) return;
    setSaveMessage("Saving Attempt…");
    void savePracticeAttempt(payload, session.accessToken)
      .then((attempt) => { setReview(reviewFromSavedAttempt(attempt)); setSaveMessage("Saved Attempt"); })
      .catch((cause) => setSaveMessage(cause instanceof ApiError ? cause.message : "Couldn’t save this Attempt."));
  }, [all, bpm, from, scoreImportId, scoreRevision, to, track]);

  const finish = useCallback(() => {
    if (!playing || !assessable) return;
    const activeDurationMs = performance.now() - started.current;
    const assessment = evaluateAttempt({ events, readings: readings.current, ticksPerQuarter: q, bpm });
    stop();
    if (!assessment.assessable || !assessment.rating) {
      setReview(null);
      setInputQuality("RETRY");
      setSaveMessage("No Accuracy rating was saved. Check your input and try again.");
      return;
    }
    setReview({ ...assessment.rating, saved: false });
    persist(assessment, activeDurationMs);
  }, [assessable, bpm, events, persist, playing, q, stop]);

  const begin = () => {
    if (!assessable || inputQuality !== "PASS" || !events.length) return;
    context();
    resetAttempt();
    started.current = performance.now();
    attemptStartedAt.current = Date.now();
    currentTick.current = events[0].startTick;
    setPlaying(true);
    void input.current?.start();
  };
  useEffect(() => {
    if (!playing || !events.length) return;
    const startTick = events[0].startTick;
    const endTick = events.at(-1)!.startTick + events.at(-1)!.durationTicks;
    const duration = ticksToMilliseconds(endTick - startTick, q, bpm);
    const step = () => {
      const elapsed = performance.now() - started.current;
      if (elapsed >= duration) { finish(); return; }
      const tick = startTick + elapsed / ticksToMilliseconds(1, q, bpm);
      currentTick.current = tick;
      let index = 0;
      for (; index < events.length - 1 && events[index + 1].startTick <= tick; index += 1) { /* advance to the active event */ }
      setActive(index);
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [bpm, events, finish, playing, q]);

  const preview = () => {
    if (!events.length) return;
    previewNodes.current.forEach((node) => { try { node.stop(); } catch { /* already stopped */ } });
    const ctx = context(); const origin = ctx.currentTime + 0.05; const startTick = events[0].startTick; const endTick = events.at(-1)!.startTick + events.at(-1)!.durationTicks;
    setPreviewing(true);
    events.forEach((event) => event.pitches.forEach((pitch) => {
      const oscillator = ctx.createOscillator(); const gain = ctx.createGain(); const at = origin + ticksToMilliseconds(event.startTick - startTick, q, bpm) / 1000; const duration = Math.max(0.08, ticksToMilliseconds(event.durationTicks, q, bpm) / 1000 * 0.8);
      oscillator.type = "triangle"; oscillator.frequency.value = hz(pitch); gain.gain.setValueAtTime(0.0001, at); gain.gain.exponentialRampToValueAtTime(0.07, at + 0.01); gain.gain.exponentialRampToValueAtTime(0.0001, at + duration); oscillator.connect(gain).connect(ctx.destination); oscillator.start(at); oscillator.stop(at + duration + 0.03); previewNodes.current.push(oscillator);
    }));
    previewTimer.current = window.setTimeout(() => { previewNodes.current = []; setPreviewing(false); }, ticksToMilliseconds(endTick - startTick, q, bpm) + 100);
  };
  const onPitch = (reading: PitchReading) => {
    if (reading.confidence >= ASSESSMENT_CRITERIA.minimumInputConfidence) setInputQuality(inputQualityForConfidence(reading.confidence));
    else if (inputQuality === "CHECK") setInputQuality(inputQualityForConfidence(reading.confidence));
    if (!playing) return;
    readings.current.push({ midi: reading.midi, tick: currentTick.current, confidence: reading.confidence, onset: reading.onset });
  };
  const expected = current?.pitches.map(midiToNoteName).join(" + ") ?? "—";

  return <section className={styles.player}>
    <div className={styles.status}><span>{playing ? "NOW PLAYING" : previewing ? "PREVIEWING" : "READY"}</span><b>Play {expected}</b><i>{assessable ? `${events.length} assessable notes` : "Not assessable"}</i></div>
    <div className={styles.controls}><button className={styles.play} onClick={() => { if (playing) stop(); else begin(); }} disabled={!playing && (!assessable || inputQuality !== "PASS")}>{playing ? "❚❚" : "▶"}</button><button className={styles.restart} onClick={resetAttempt}>↺ Restart</button><button onClick={() => setBpm((value) => Math.max(40, value - 1))}>−</button><strong>{bpm}<small>BPM</small></strong><button onClick={() => setBpm((value) => Math.min(240, value + 1))}>+</button><input aria-label="Tempo in BPM" type="range" min="40" max="240" value={bpm} onChange={(event) => setBpm(Number(event.target.value))}/><button className={styles.preview} onClick={preview} disabled={previewing}>♫ Hear it</button>{playing && <button className={styles.finish} onClick={finish}>Finish & review</button>}</div>
    <div className={styles.range}><label>From <select value={from} onChange={(event) => { const value = Number(event.target.value); setFrom(value); if (value > to) setTo(value); resetAttempt(); }}>{measures.map((measure) => <option key={measure}>{measure}</option>)}</select></label><label>To <select value={to} onChange={(event) => { setTo(Number(event.target.value)); resetAttempt(); }}>{measures.filter((measure) => measure >= from).map((measure) => <option key={measure}>{measure}</option>)}</select></label><span>{active + 1} / {events.length}</span></div>
    <section className={styles.inputQuality} aria-label="Input quality"><div><b>INPUT QUALITY</b><strong>{inputQuality === "PASS" ? "Ready for assessment" : inputQuality === "RETRY" ? "Try your input again" : "Check your input"}</strong><small>{inputQuality === "PASS" ? "A clear note was detected with enough confidence for an Accuracy rating." : "Play one clear note before starting an assessable Attempt."}</small></div><button onClick={() => void input.current?.start()}>Check input</button></section>
    {assessabilityReason && <p className={styles.unassessable}>This passage is not assessable. {assessabilityReason}</p>}
    {(review || saveMessage) && <section className={styles.review} aria-live="polite"><b>{review?.saved ? "SAVED ATTEMPT" : "ATTEMPT REVIEW"}</b>{review && <><strong>{review.accuracyPercent}% Accuracy rating</strong><span>Pitch {review.pitchCorrect} / {review.total} · Onset timing {review.onsetTimingCorrect} / {review.total} · Input confidence {review.inputConfidencePercent}%</span></>}{saveMessage && <small>{saveMessage}</small>}</section>}
    <AudioInput ref={input} onPitchDetected={onPitch} targetMidi={current?.pitches[0] ?? null}/>
  </section>;
}
