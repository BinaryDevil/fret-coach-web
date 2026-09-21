"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { midiToNoteName, pitchMatch } from "../lib/pitch-detection";
import { CapturedPitchReading, MicrophoneInputState, useMicrophonePerformanceSource } from "./microphone-performance-source";
import styles from "./audio-input.module.css";

export type AudioInputHandle = { start: () => Promise<void>; stop: () => void; readonly state: MicrophoneInputState };
type AudioInputProps = { onPitchDetected?: (reading: CapturedPitchReading) => void; targetMidi?: number | null };

export const AudioInput = forwardRef<AudioInputHandle, AudioInputProps>(function AudioInput({ onPitchDetected, targetMidi }, ref) {
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [checkingInput, setCheckingInput] = useState(false);
  const [isPageScrolling, setIsPageScrolling] = useState(false);
  const { state, level, devices, deviceId, setDeviceId, pitch, message, start, stop } = useMicrophonePerformanceSource(onPitchDetected);
  useEffect(() => {
    const handleScroll = () => {
      setIsPageScrolling(true);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => setIsPageScrolling(false), 180);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => { window.removeEventListener("scroll", handleScroll); if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current); };
  }, []);
  useImperativeHandle(ref, () => ({ start: () => start(), stop, get state() { return state; } }), [start, state, stop]);
  const isConnected = state === "connected";
  const status = state === "connecting" ? "Connecting" : isConnected ? "Live" : "Off";
  const targetMatch = pitch && targetMidi !== null && targetMidi !== undefined ? pitchMatch(pitch, [targetMidi]) : null;
  return <section className={`${styles.panel} ${isPageScrolling && !isExpanded ? styles.panelScrolling : ""}`} aria-label="Guitar input">
    <button className={styles.toggle} type="button" aria-expanded={isExpanded} aria-controls="guitar-input-details" onClick={() => setIsExpanded((value) => !value)}>
      <span className={styles.title}><i className={isConnected ? styles.live : ""} /> GUITAR INPUT</span>
      <span className={isConnected ? styles.statusLive : styles.status}>{status}</span>
      <span className={isExpanded ? styles.chevronOpen : styles.chevron} aria-hidden="true">⌄</span>
    </button>
    {isExpanded && <div id="guitar-input-details" className={styles.details}>
      <div className={styles.copy}><strong>{isConnected ? "Connected" : "Connect your guitar"}</strong><span>{pitch ? `Detected ${midiToNoteName(pitch.midi)} · ${Math.round(pitch.confidence * 100)}% confidence${pitch.onset ? " · pluck" : ""}` : message}</span></div>
      <div className={styles.meter} aria-label={`Input level ${Math.round(level * 100)}%`}><div style={{ transform: `scaleX(${Math.max(0.015, level)})` }} /></div>
      <div className={styles.diagnostics}>{targetMatch ? <><span>Target {midiToNoteName(targetMidi!)}</span><span>{targetMatch.cents >= 0 ? "+" : ""}{Math.round(targetMatch.cents)} cents{targetMatch.octaveShift ? " · octave corrected" : ""}</span></> : <><span>Local audio only</span><span>Pitch checks never leave this device</span></>}</div>
      <div className={styles.actions}>
        {devices.length > 1 && <select aria-label="Audio input device" value={deviceId} onChange={(event) => { setDeviceId(event.target.value); void start(event.target.value); }}><option value="">Default input</option>{devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Input ${index + 1}`}</option>)}</select>}
        <button className={isConnected ? styles.disconnect : styles.connect} onClick={() => { if (isConnected) stop(); else void start(); }} disabled={state === "connecting"}>{state === "connecting" ? "Connecting…" : isConnected ? "Disconnect" : "Connect guitar"}</button>
      </div>
      <button className={styles.check} type="button" onClick={() => setCheckingInput((value) => !value)}>{checkingInput ? "Stop input check" : "Check open low E"}</button>
      {checkingInput && <p className={styles.checkResult}>{pitch ? `${midiToNoteName(pitch.midi)} · ${Math.round((pitch.midi - 40) * 100)} cents from E2` : "Play an open low E string (E2)."}</p>}
    </div>}
  </section>;
});
