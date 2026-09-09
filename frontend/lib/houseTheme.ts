// House colour system. Falls back to name-based mapping if the API's
// `colour` field is ever missing, so cards never render colourless.
const NAME_FALLBACK: Record<string, string> = {
  bhagiratha: "#3b82f6",
  karna: "#ef4444",
  arjuna: "#22c55e",
  ekalavya: "#f59e0b",
};

const GLOW_CLASS: Record<string, string> = {
  "#3b82f6": "glow-blue",
  "#ef4444": "glow-red",
  "#22c55e": "glow-green",
  "#f59e0b": "glow-yellow",
};

export function houseColour(house: { name?: string; colour?: string } | null | undefined): string {
  if (!house) return "#6366f1";
  return house.colour || NAME_FALLBACK[house.name?.toLowerCase() || ""] || "#6366f1";
}

export function houseGlowClass(house: { name?: string; colour?: string } | null | undefined): string {
  const c = houseColour(house);
  return GLOW_CLASS[c] || "";
}

// Convert a hex colour to an "r, g, b" string for use inside rgba()/CSS vars.
export function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r}, ${g}, ${b}`;
}
