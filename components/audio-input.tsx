"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { detectPitch, medianPitch, midiToNoteName, pitchMatch, PitchReading } from "../lib/pitch-detection";
import styles from "./audio-input.module.css";

type AudioState = "idle" | "connecting" | "connected" | "unsupported" | "denied" | "error";
export type AudioInputHandle = { start: () => Promise<void>; stop: () => void };
type AudioInputProps = { onPitchDetected?: (reading: PitchReading) => void; targetMidi?: number | null };

export const AudioInput = forwardRef<AudioInputHandle, AudioInputProps>(function AudioInput({ onPitchDetected, targetMidi }, ref) {
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastAnalysisRef = useRef(0);
  const lastRmsRef = useRef(0);
  const readingsRef = useRef<PitchReading[]>([]);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<AudioState>("idle");
  const [level, setLevel] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [pitch, setPitch] = useState<PitchReading | null>(null);
  const [checkingInput, setCheckingInput] = useState(false);
  const [isPageScrolling, setIsPageScrolling] = useState(false);
  const [message, setMessage] = useState("Connect a guitar interface or microphone to monitor its input level.");

  const stop = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    setLevel(0);
    setPitch(null);
    readingsRef.current = [];
    setState("idle");
    setMessage("Input monitoring is off. Your audio never leaves this device.");
  }, []);

  const loadDevices = useCallback(async () => {
    const listed = await navigator.mediaDevices.enumerateDevices();
    setDevices(listed.filter((device) => device.kind === "audioinput"));
  }, []);

  const connect = useCallback(async (selectedDeviceId = deviceId) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      setMessage("This browser does not support audio input.");
      return;
    }
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    setState("connecting");
    setMessage("Requesting access to your guitar input…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
      });
      streamRef.current = stream;
      const context = new AudioContext();
      contextRef.current = context;
      await context.resume();
      const analyser = context.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0.78;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const draw = () => {
        analyser.getFloatTimeDomainData(samples);
        let total = 0;
        for (const sample of samples) total += sample * sample;
        const rms = Math.sqrt(total / samples.length);
        setLevel(Math.min(1, rms * 4.5));
        const now = performance.now();
        if (now - lastAnalysisRef.current >= 80) {
          lastAnalysisRef.current = now;
          const detected = detectPitch(samples, context.sampleRate);
          const onset = rms > 0.014 && rms > lastRmsRef.current * 1.45 + 0.003;
          lastRmsRef.current = rms;
          if (detected) {
            const reading = { ...detected, rms, onset };
            readingsRef.current = [...readingsRef.current.slice(-4), reading];
            const stable = medianPitch(readingsRef.current);
            if (stable) {
              const stabilized = { ...stable, rms, onset };
              setPitch(stabilized);
              onPitchDetected?.(stabilized);
            }
          }
        }
        frameRef.current = requestAnimationFrame(draw);
      };
      draw();
      await loadDevices();
      const activeId = stream.getAudioTracks()[0]?.getSettings().deviceId ?? selectedDeviceId;
      setDeviceId(activeId);
      setState("connected");
      setMessage("Listening locally. Play a note to check your input level.");
    } catch (cause) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      void contextRef.current?.close();
      contextRef.current = null;
      const name = cause instanceof DOMException ? cause.name : "";
      setState(name === "NotAllowedError" ? "denied" : "error");
      setMessage(name === "NotAllowedError" ? "Microphone permission was denied. Allow it in your browser settings, then try again." : "Could not connect to this input. Check your interface, then try again.");
    }
  }, [deviceId, loadDevices, onPitchDetected]);

  useEffect(() => () => stop(), [stop]);
  useEffect(() => {
    const handleScroll = () => {
      setIsPageScrolling(true);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => setIsPageScrolling(false), 180);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => { window.removeEventListener("scroll", handleScroll); if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current); };
  }, []);
  useImperativeHandle(ref, () => ({ start: () => connect(), stop }), [connect, stop]);
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
        {devices.length > 1 && <select aria-label="Audio input device" value={deviceId} onChange={(event) => { setDeviceId(event.target.value); void connect(event.target.value); }}><option value="">Default input</option>{devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Input ${index + 1}`}</option>)}</select>}
        <button className={isConnected ? styles.disconnect : styles.connect} onClick={() => { if (isConnected) stop(); else void connect(); }} disabled={state === "connecting"}>{state === "connecting" ? "Connecting…" : isConnected ? "Disconnect" : "Connect guitar"}</button>
      </div>
      <button className={styles.check} type="button" onClick={() => setCheckingInput((value) => !value)}>{checkingInput ? "Stop input check" : "Check open low E"}</button>
      {checkingInput && <p className={styles.checkResult}>{pitch ? `${midiToNoteName(pitch.midi)} · ${Math.round((pitch.midi - 40) * 100)} cents from E2` : "Play an open low E string (E2)."}</p>}
    </div>}
  </section>;
});
