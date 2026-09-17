export type PrivateWeakPointKind = "PITCH" | "TIMING" | "MISSING" | "CONSISTENCY";
export type TechniqueRecommendation = { slug: string; title: string; reason: string };
export type PrivatePassageTarget = { scoreImportId: string; trackId: string; from: number; to: number };
export function interventionNavigation(input: { weakPoint: { kind: PrivateWeakPointKind }; target: PrivatePassageTarget }): { recommendation: TechniqueRecommendation; href: string };
export function privatePassageReturnTarget(value: string | null): PrivatePassageTarget | null;
