/**
 * patternTypeStyles — kleur-mapping per pattern_type voor AnalyseView,
 * SuggestionCard en RapportView.
 *
 * Anker: TYPE_STYLES uit StrategyOnePager.jsx regel 90-94 (warning oranje /
 * info blauw / success groen). Conform PLATFORM_REQUIREMENTS #8.
 *
 * Mapping per Kees-instructie 11.G:
 *   - cluster        → warning  (oranje)   — patroon dat aandacht vraagt
 *   - paradox        → info     (blauw)    — observatie van spanning
 *   - positionering  → success  (groen)    — strategische bevinding
 *   - overstijgend   → custom-purple        — capability-laag (geen StrategyOnePager-anker)
 *   - eigen          → custom-slate         — neutraal voor consultant-eigen
 *
 * Drie van vijf gebruiken letterlijk de StrategyOnePager-warning/info/success-
 * waarden. De twee custom-types (overstijgend, eigen) gebruiken vergelijkbaar
 * contrasterend pattern (purple resp. slate) — zelfde structuur (bg/border/text/label/icon).
 */

export const PATTERN_TYPE_STYLES = {
  cluster: {
    icon:   "⚠",
    bg:     "#fff7ed",
    border: "#f97316",
    text:   "#9a3412",
    label:  "#ea580c",
  },
  paradox: {
    icon:   "ℹ",
    bg:     "#eff6ff",
    border: "#3b82f6",
    text:   "#1e3a8a",
    label:  "#2563eb",
  },
  positionering: {
    icon:   "✓",
    bg:     "#f0fdf4",
    border: "#22c55e",
    text:   "#14532d",
    label:  "#16a34a",
  },
  overstijgend: {
    icon:   "✦",
    bg:     "#faf5ff",
    border: "#a855f7",
    text:   "#581c87",
    label:  "#7e22ce",
  },
  eigen: {
    icon:   "◆",
    bg:     "#f8fafc",
    border: "#64748b",
    text:   "#1e293b",
    label:  "#475569",
  },
  // T4 B2.4: 5e AI-generatie 'Algemeen' — open lens, neutrale teal/cyaan
  // (geen vooraf bepaalde Cluster/Paradox/Positionering/Overstijgend-frame).
  algemeen: {
    icon:   "◎",
    bg:     "#ecfeff",
    border: "#06b6d4",
    text:   "#155e75",
    label:  "#0e7490",
  },
};

/** Tailwind-class-mapping voor in-screen UI (badge / card-border).
 *  Inline-styling met de bovenstaande hex-waardes blijft de bron-van-waarheid;
 *  deze classes zijn een convenience voor componenten die liever Tailwind
 *  gebruiken voor ringen/hover-states. Border-left = 3px solid border-color. */
export const PATTERN_TYPE_TAILWIND = {
  cluster:       { badge: "bg-orange-100 text-orange-700",  border: "border-l-orange-500"  },
  paradox:       { badge: "bg-blue-100 text-blue-800",      border: "border-l-blue-500"    },
  positionering: { badge: "bg-green-100 text-green-800",    border: "border-l-green-500"   },
  overstijgend:  { badge: "bg-purple-100 text-purple-800",  border: "border-l-purple-500"  },
  eigen:         { badge: "bg-slate-200 text-slate-700",    border: "border-l-slate-500"   },
  // T4 B2.4
  algemeen:      { badge: "bg-cyan-100 text-cyan-800",      border: "border-l-cyan-500"    },
};

export const PATTERN_TYPES = ["cluster", "paradox", "positionering", "overstijgend", "eigen", "algemeen"];
export const AI_ACTION_TYPES = ["cluster", "paradox", "positionering", "overstijgend", "algemeen"];

/** Label-key per pattern_type. Component roept appLabel(getPatternTypeLabelKey(type), fallback). */
export function getPatternTypeLabelKey(type) {
  return `klanten.analyse.type.${type}`;
}

export function getPatternTypeLabelFallback(type) {
  return {
    cluster:       "Cluster",
    paradox:       "Paradox",
    positionering: "Positionering",
    overstijgend:  "Overstijgend",
    eigen:         "Eigen",
    algemeen:      "Algemeen",
  }[type] || type;
}

export function getStyle(type) {
  return PATTERN_TYPE_STYLES[type] || PATTERN_TYPE_STYLES.eigen;
}
