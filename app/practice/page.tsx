import { Suspense } from "react";
import { PracticeStudio } from "../../components/practice-studio";

export const metadata = {
  title: "Spider exercise | FretCoach",
  description: "Practice timing and finger independence with FretCoach.",
};

export default function PracticePage() {
  return <Suspense fallback={<main>Loading your exercise…</main>}><PracticeStudio /></Suspense>;
}
