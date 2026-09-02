"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HomeNavigation } from "../../components/home-navigation";
import { Exercise, getSession, listExercises } from "../../lib/fretcoach-api";
import styles from "./page.module.css";
export default function LibraryPage() { const router = useRouter(); const [items, setItems] = useState<Exercise[]>([]); const [error, setError] = useState(""); useEffect(() => { const session = getSession(); if (!session) { router.replace("/login?next=/library"); return; } void listExercises(session.accessToken).then(setItems).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load practice library")); }, [router]); return <main className={styles.page}><HomeNavigation /><section><div className={styles.titleRow}><div><p className={styles.kicker}>BUILD YOUR FOUNDATION</p><h1>Choose an exercise</h1></div><Link className={styles.upload} href="/my-songs">Upload a tab ↑</Link></div>{error && <output>{error}</output>}<div className={styles.grid}>{items.map((exercise) => <Link className={styles.card} href={`/practice?slug=${exercise.slug}`} key={exercise.id}><small>{exercise.type} · {exercise.difficulty}</small><h2>{exercise.title}</h2><p>{exercise.skillFocus}</p><footer><span>{exercise.estimatedMinutes} min</span><b>{exercise.configuration.targetBpm} BPM →</b></footer></Link>)}</div></section></main>; }
