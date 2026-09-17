export type PrivateWeakPointKind = "PITCH" | "TIMING" | "MISSING" | "CONSISTENCY";
export type TechniqueRecommendation = { slug: string; title: string; reason: string };
export function interventionNavigation(input: { weakPoint: { kind: PrivateWeakPointKind }; scoreImportId: string; trackId: string; from: number; to: number }): { recommendation: TechniqueRecommendation; href: string };
export function safePrivatePassageReturn(value: string | null): string | null;
