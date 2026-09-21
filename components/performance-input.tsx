"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AudioInput, AudioInputHandle } from "./audio-input";
import { simulatedPerformanceReadings } from "../lib/performance-input.mjs";
import type { DevelopmentScenario, PerformanceInputReading, PerformanceInputSource } from "../lib/performance-input-types";

export type PerformanceInputHandle = PerformanceInputSource;
type PerformanceEvent = { id: string; pitches: number[]; startTick: number; isRest?: boolean };
type Props = { events: PerformanceEvent[]; ticksPerQuarter: number; bpm: number; targetMidi?: number | null; onReading: (reading: PerformanceInputReading) => void };
const development = process.env.NODE_ENV !== "production";

export const PerformanceInput = forwardRef<PerformanceInputHandle, Props>(function PerformanceInput({ events, ticksPerQuarter, bpm, targetMidi, onReading }, ref) {
  const microphoneRef = useRef<AudioInputHandle>(null);
  const timers = useRef<number[]>([]);
  const onReadingRef = useRef(onReading);
  onReadingRef.current = onReading;
  const [mode, setMode] = useState<"MICROPHONE" | "SIMULATOR">("MICROPHONE");
  const [scenario, setScenario] = useState<DevelopmentScenario>("PERFECT");
  const stopSimulator = () => { timers.current.forEach((timer) => window.clearTimeout(timer)); timers.current = []; };
  useEffect(() => () => { stopSimulator(); microphoneRef.current?.stop(); }, []);
  useEffect(() => () => stopSimulator(), [bpm, events, ticksPerQuarter]);
  useImperativeHandle(ref, () => ({
    get isSimulated() { return development && mode === "SIMULATOR"; },
    get state() { return development && mode === "SIMULATOR" ? (timers.current.length ? "connected" : "idle") : microphoneRef.current?.state ?? "idle"; },
    async start() {
      if (!development || mode === "MICROPHONE") { await microphoneRef.current?.start(); return; }
      stopSimulator();
      const startedAtMs = performance.now();
      const readings = simulatedPerformanceReadings({ events, ticksPerQuarter, bpm, scenario, captureStartedAtMs: startedAtMs });
      timers.current = readings.map((reading: PerformanceInputReading) => window.setTimeout(() => onReadingRef.current(reading), Math.max(0, reading.capturedAtMs - performance.now())));
    },
    stop() { stopSimulator(); microphoneRef.current?.stop(); },
  }), [bpm, events, mode, scenario, ticksPerQuarter]);
  return <>{development && <section aria-label="Development simulator"><label>Performance input <select value={mode} onChange={(event) => { stopSimulator(); microphoneRef.current?.stop(); setMode(event.target.value as "MICROPHONE" | "SIMULATOR"); }}><option value="MICROPHONE">Microphone or direct input</option><option value="SIMULATOR">Development simulator</option></select></label>{mode === "SIMULATOR" && <><label>Simulated performance <select value={scenario} onChange={(event) => { stopSimulator(); setScenario(event.target.value as DevelopmentScenario); }}><option value="PERFECT">Perfect</option><option value="WRONG_PITCH">Wrong pitch</option><option value="EARLY_ONSET">Early onset</option><option value="LATE_ONSET">Late onset</option><option value="MISSED_EVENT">Missed performance event</option><option value="LOW_CONFIDENCE">Low-confidence input</option></select></label><p>Development simulator — results are not saved.</p></>}</section>}{(!development || mode === "MICROPHONE") && <AudioInput ref={microphoneRef} targetMidi={targetMidi} onPitchDetected={onReading}/>}</>;
});
