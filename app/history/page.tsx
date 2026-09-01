"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HomeNavigation } from "../../components/home-navigation";
import { getPracticeAttempts, getSession, PracticeAttemptSummary } from "../../lib/fretcoach-api";
import styles from "./page.module.css";

export default function HistoryPage() {
  const router = useRouter();
  const [attempts, setAttempts] = useState<PracticeAttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const session = getSession();
    if (!session) { router.replace("/login?next=/history"); return; }
    void getPracticeAttempts(session.accessToken)
      .then((response) => setAttempts(response.items))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load practice history."))
      .finally(() => setLoading(false));
  }, [router]);

  return <main className={styles.page}><HomeNavigation /><section><p className={styles.kicker}>YOUR PROGRESS</p><h1>Practice history</h1>{loading ? <p className={styles.state}>Loading your practice history…</p> : error ? <p className={styles.error}>{error}</p> : attempts.length ? <div className={styles.list}>{attempts.map((attempt) => <article className={styles.attempt} key={attempt.id}><div><p>{attempt.exercise?.title ?? "Practice attempt"}</p><small>{formatDate(attempt.completedAt)} · {attempt.bpm} BPM · {formatDuration(attempt.activeDurationMs)}</small></div><strong>{attempt.accuracyPercent}%<small>accuracy</small></strong><span>{attempt.correctCount} correct · {attempt.wrongPitchCount} wrong · {attempt.missingCount} missed{attempt.extraNoteCount ? ` · ${attempt.extraNoteCount} extra` : ""}</span></article>)}</div> : <div className={styles.empty}><h2>Your history will appear here.</h2><p>Complete a practice pass to start tracking your progress.</p><Link href="/library">Choose an exercise →</Link></div>}</section></main>;
}

function formatDuration(milliseconds: number) { const seconds = Math.max(0, Math.round(milliseconds / 1000)); const minutes = Math.floor(seconds / 60); return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`; }
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)); }
