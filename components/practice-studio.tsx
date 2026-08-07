"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./practice-studio.module.css";

const SPIDER_TEX = String.raw`\\title "Spider exercise"
\\subtitle "Finger independence · Standard tuning"
\\tempo 80
.
:4 1.6 2.6 3.6 4.6 | 1.5 2.5 3.5 4.5 | 1.4 2.4 3.4 4.4 | 1.3 2.3 3.3 4.3 |
:4 4.3 3.3 2.3 1.3 | 4.4 3.4 2.4 1.4 | 4.5 3.5 2.5 1.5 | 4.6 3.6 2.6 1.6`;

const notes = [
  [1, 6, "F", "Index"], [2, 6, "F♯", "Middle"], [3, 6, "G", "Ring"], [4, 6, "G♯", "Pinky"],
  [1, 5, "B♭", "Index"], [2, 5, "B", "Middle"], [3, 5, "C", "Ring"], [4, 5, "C♯", "Pinky"],
  [1, 4, "E♭", "Index"], [2, 4, "E", "Middle"], [3, 4, "F", "Ring"], [4, 4, "F♯", "Pinky"],
  [1, 3, "A♭", "Index"], [2, 3, "A", "Middle"], [3, 3, "B♭", "Ring"], [4, 3, "B", "Pinky"],
] as const;

type AlphaApi = { tex: (value: string) => void; destroy?: () => void; scoreLoaded?: { on: (listener: () => void) => void }; score?: { tracks?: Array<{ staves?: Array<{ bars?: Array<{ voices?: Array<{ beats?: unknown[] }> }> }> }> }; highlightPlaybackRange?: (start: unknown, end: unknown) => void };

export function PracticeStudio() {
  const scoreElement = useRef<HTMLDivElement>(null);
  const apiRef = useRef<AlphaApi | null>(null);
  const beatsRef = useRef<unknown[]>([]);
  const startTime = useRef(0);
  const frameRef = useRef<number>();
  const priorNote = useRef(-1);
  const audioRef = useRef<AudioContext | null>(null);
  const [bpm, setBpm] = useState(80);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function setupScore() {
      const alphaTab = await import("@coderline/alphatab");
      if (cancelled || !scoreElement.current) return;
      const api = new alphaTab.AlphaTabApi(scoreElement.current, { core: { tex: false }, display: { layoutMode: alphaTab.LayoutMode.Page, scale: 1.12 } }) as AlphaApi;
      apiRef.current = api;
      api.scoreLoaded?.on(() => {
        const bars = api.score?.tracks?.[0]?.staves?.[0]?.bars ?? [];
        beatsRef.current = bars.flatMap((bar) => bar.voices?.[0]?.beats ?? []);
      });
      api.tex(SPIDER_TEX);
    }
    void setupScore();
    return () => { cancelled = true; apiRef.current?.destroy?.(); apiRef.current = null; };
  }, []);

  const metronome = useCallback((accent: boolean) => {
    const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = audioRef.current ?? new AudioContextConstructor();
    audioRef.current = context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = accent ? 1046.5 : 783.99;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.16 : 0.09, context.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.055);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 0.06);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const msPerBeat = 60000 / bpm;
    const advance = (now: number) => {
      const position = now - startTime.current;
      const rawIndex = Math.floor(position / msPerBeat);
      if (!loop && rawIndex >= notes.length) { setPlaying(false); setActive(notes.length - 1); return; }
      const index = rawIndex % notes.length;
      if (index !== priorNote.current) {
        priorNote.current = index;
        setActive(index);
        metronome(index % 4 === 0);
        const beat = beatsRef.current[index];
        if (beat) apiRef.current?.highlightPlaybackRange?.(beat, beat);
      }
      setElapsed(position);
      frameRef.current = requestAnimationFrame(advance);
    };
    frameRef.current = requestAnimationFrame(advance);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [bpm, loop, metronome, playing]);

  const jump = (index: number) => { setPlaying(false); setActive(index); setElapsed(index * (60000 / bpm)); priorNote.current = index - 1; };
  const toggle = () => { if (playing) { setPlaying(false); } else { startTime.current = performance.now() - elapsed; priorNote.current = -1; setPlaying(true); } };
  const reset = () => jump(0);
  const beatInBar = active % 4;

  return <main className={styles.page}>
    <header className={styles.header}><Link className={styles.brand} href="/"><span>F</span>FretCoach</Link><button onClick={() => history.back()}>Exit</button></header>
    <section className={styles.scoreCard}>
      <div className={styles.scoreLabel}><span>SPIDER EXERCISE</span><span>STANDARD TUNING</span></div>
      <div className={styles.scoreView}><div ref={scoreElement} className="alphaTab" /></div>
    </section>
    <section className={styles.metronome} aria-label="Metronome controls">
      <div className={styles.beats} aria-label={`Beat ${beatInBar + 1} of 4`}>{[0, 1, 2, 3].map((beat) => <i className={playing && beat === beatInBar ? styles.beatActive : ""} key={beat} />)}</div>
      <button className={styles.play} onClick={toggle} aria-label={playing ? "Pause metronome" : "Start metronome"}>{playing ? "❚❚" : "▶"}</button>
      <div className={styles.tempo}><button onClick={() => { const value = Math.max(50, bpm - 1); setBpm(value); startTime.current = performance.now() - elapsed; }} aria-label="Decrease BPM">−</button><b>{bpm}<small>BPM</small></b><button onClick={() => { const value = Math.min(140, bpm + 1); setBpm(value); startTime.current = performance.now() - elapsed; }} aria-label="Increase BPM">+</button></div>
      <input type="range" aria-label="Tempo in BPM" min="50" max="140" value={bpm} onChange={(event) => { const value = Number(event.target.value); setBpm(value); startTime.current = performance.now() - elapsed; }} />
      <button className={styles.loop} onClick={() => setLoop(!loop)} aria-pressed={loop}>↻ {loop ? "Loop on" : "Loop off"}</button>
      <button className={styles.reset} onClick={reset} aria-label="Restart exercise">↺</button>
    </section>
  </main>;
}
