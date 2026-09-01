"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DashboardExerciseCard, DashboardResponse, getDashboard, getSession } from "../lib/fretcoach-api";
import { HomeNavigation } from "../components/home-navigation";

export default function Home() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const session = getSession();
    if (!session) {
      const frame = requestAnimationFrame(() => setLoading(false));
      return () => cancelAnimationFrame(frame);
    }
    void getDashboard(session.accessToken)
      .then(setDashboard)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load your dashboard."))
      .finally(() => setLoading(false));
  }, []);

  return <main className="shell">
    <HomeNavigation />
    {loading ? <section className="home-state">Loading your practice dashboard…</section> : dashboard ? <Dashboard dashboard={dashboard} /> : error ? <section className="home-state"><p>{error}</p><Link className="primary" href="/library">Open practice library <span>→</span></Link></section> : <Marketing />}
  </main>;
}

function Dashboard({ dashboard }: { dashboard: DashboardResponse }) {
  const next = dashboard.nextPractice;
  return <>
    <section className="hero" id="home">
      <div><p className="eyebrow">TODAY&apos;S PRACTICE</p><h1>{next ? "Your next focused\nsession." : "Build your\npractice habit."}</h1><p className="hero-copy">{next ? `Keep building ${next.skillFocus.toLowerCase()} with a focused session chosen for you.` : "Choose an exercise from your practice library to get started."}</p><div className="hero-actions"><Link className="primary" href={next ? `/practice?slug=${next.slug}` : "/library"}>{next ? "Start next practice" : "Choose an exercise"} <span>→</span></Link></div></div>
      {next ? <PracticeCard exercise={next} /> : <aside className="session-card"><div className="session-topline"><span className="pulse" /> READY WHEN YOU ARE</div><h2>Choose your next exercise</h2><div className="session-meta"><span>Your plan will appear here.</span></div></aside>}
    </section>
    <section className="stats" id="progress" aria-label="Practice statistics"><div><span>{dashboard.stats.currentDayStreak}</span><p>day streak</p></div><div><span>{dashboard.stats.averageAccuracyPercent}<span className="unit">%</span></span><p>average accuracy</p></div><div><span>{formatWeeklyTime(dashboard.stats.playedThisWeekMs)}</span><p>played this week</p></div><div className="coach-note"><b>Coach&apos;s note</b><p>{dashboard.coachNote}</p></div></section>
    <section className="library" id="library"><div className="section-heading"><div><p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p><h2>Recommended for you</h2></div><Link href="/library">View all →</Link></div><div className="exercise-grid">{dashboard.recommendations.map((exercise) => <RecommendationCard exercise={exercise} key={exercise.id} />)}</div></section>
  </>;
}

function Marketing() {
  return <section className="hero" id="home"><div><p className="eyebrow">A BETTER WAY TO PRACTICE</p><h1>Make every note<br />land with intent.</h1><p className="hero-copy">Train timing, accuracy, and confidence with a focused guitar practice coach.</p><div className="hero-actions"><Link className="primary" href="/login?next=/library">Start practicing <span>→</span></Link></div></div><aside className="session-card"><div className="session-topline"><span className="pulse" /> PERSONALIZED PRACTICE</div><h2>Your next session awaits.</h2><div className="session-meta"><span>Sign in to build your plan.</span></div></aside></section>;
}

function PracticeCard({ exercise }: { exercise: DashboardExerciseCard }) {
  return <aside className="session-card" aria-label="Next practice session"><div className="session-topline"><span className="pulse" /> READY TO PLAY</div><p className="session-type">{exercise.skillFocus}</p><h2>{exercise.title}</h2><div className="session-meta"><span>{exercise.targetBpm === null ? "Tempo flexible" : `♩ ${exercise.targetBpm} BPM`}</span><span>{exercise.estimatedMinutes} min</span><span>{displayLevel(exercise.difficulty)}</span></div></aside>;
}

function RecommendationCard({ exercise }: { exercise: DashboardExerciseCard & { rank: number } }) {
  return <Link className="exercise-card" href={`/practice?slug=${exercise.slug}`}><div className="card-number">{String(exercise.rank).padStart(2, "0")}</div><p>{exercise.skillFocus}</p><h3>{exercise.title}</h3><footer><span>{exercise.estimatedMinutes} min</span><span>{exercise.targetBpm === null ? "Tempo flexible" : `♩ ${exercise.targetBpm} BPM`}</span></footer></Link>;
}

function displayLevel(difficulty: DashboardExerciseCard["difficulty"]) { return `Level ${difficulty === "BEGINNER" ? 1 : difficulty === "INTERMEDIATE" ? 2 : 3}`; }
function formatWeeklyTime(playedThisWeekMs: number) { const totalMinutes = Math.round(playedThisWeekMs / 60_000); const hours = Math.floor(totalMinutes / 60); const minutes = totalMinutes % 60; return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`; }
