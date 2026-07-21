// Color system from the design export: node kinds, edge styles, pack accents.

export const KIND_COLORS: Record<string, string> = {
  library: "#22d3ee",
  package: "#e879f9",
  service: "#fbbf24",
  tool: "#a78bfa",
  binary: "#4ade80",
};

const FALLBACK_COLORS = ["#a5f3fc", "#f0abfc", "#fde68a", "#c4b5fd", "#86efac", "#67e8f9"];

export const PACK_ACCENT = "#e879f9";
export const PACK_ACCENT_LIGHT = "#f0abfc";
export const DYNAMIC_EDGE = "#22d3ee";
export const STATIC_EDGE = "#fbbf24";
export const TEXT = "#e6e9f2";
export const MUTED = "#8b93a7";

export function kindColor(kind: string): string {
  const known = KIND_COLORS[kind];
  if (known) return known;
  let hash = 0;
  for (const ch of kind) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

/** "#22d3ee" + alpha 0.4 -> "rgba(34,211,238,0.4)" */
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
