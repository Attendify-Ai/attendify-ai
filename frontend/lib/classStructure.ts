export const STANDARDS = Array.from({ length: 12 }, (_, i) => i + 1);

export function sectionsForStandard(standard: number): string[] {
  return standard >= 11 ? ["A", "B", "C", "D"] : ["A", "B", "C"];
}

export function parseClassString(classString?: string | null): { standard: number; section: string } | null {
  if (!classString) return null;
  const m = classString.trim().match(/^(\d{1,2})([A-Za-z])$/);
  if (!m) return null;
  return { standard: Number(m[1]), section: m[2].toUpperCase() };
}
