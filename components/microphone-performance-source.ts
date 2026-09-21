"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectPitch, medianPitch, PitchReading } from "../lib/pitch-detection";

export type MicrophoneInputState = "idle" | "connecting" | "connected" | "unsupported" | "denied" | "error";
export type CapturedPitchReading = PitchReading & { capturedAtMs: number };

/**
 * Browser-only capture adapter. It owns media permissions and on-device analysis;
 * callers only receive stabilized, timestamped performance readings.
 */
export function useMicrophonePerformanceSource(onReading?: (reading: CapturedPitchReading) => void) {
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastAnalysisRef = useRef(0);
  const lastRmsRef = useRef(0);
  const readingsRef = useRef<PitchReading[]>([]);
  const [state, setState] = useState<MicrophoneInputState>("idle");
  const [level, setLevel] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [pitch, setPitch] = useState<PitchReading | null>(null);
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

  const start = useCallback(async (selectedDeviceId = deviceId) => {
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined, autoGainControl: false, echoCancellation: false, noiseSuppression: false } });
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
              onReading?.({ ...stabilized, capturedAtMs: now });
            }
          }
        }
        frameRef.current = requestAnimationFrame(draw);
      };
      draw();
      await loadDevices();
      setDeviceId(stream.getAudioTracks()[0]?.getSettings().deviceId ?? selectedDeviceId);
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
  }, [deviceId, loadDevices, onReading]);

  useEffect(() => () => stop(), [stop]);
  return { state, level, devices, deviceId, setDeviceId, pitch, message, start, stop };
}
