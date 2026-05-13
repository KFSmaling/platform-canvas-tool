/** @type {import('tailwindcss').Config} */
//
// Design-systeem tokens — Fase 1 fundament (2026-05-13).
// Designer-output §2 staat in src/index.css als CSS-vars. Tailwind extend
// hieronder koppelt utilities aan de tokens zodat bouwers `text-base`,
// `rounded-md`, `shadow-card`, `bg-category-klanten` etc. kunnen gebruiken.
//
// Discipline:
// - Tokens-only voor nieuwe code. Geen `text-[15px]` of `rounded-[7px]` meer.
// - Tenant-overridable kleuren (color-primary/accent/etc.) via ThemeProvider.
// - Categorie/SWOT/pattern/flow/AI-accent kleuren zijn platform-vast.
//
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      // Designer §2.1 — typografie-schaal. Twee weights (400 / 500).
      fontSize: {
        "xs":   ["var(--text-xs)",   { lineHeight: "1.5" }],
        "sm":   ["var(--text-sm)",   { lineHeight: "1.5" }],
        "base": ["var(--text-base)", { lineHeight: "1.7" }],
        "md":   ["var(--text-md)",   { lineHeight: "1.4", fontWeight: "500" }],
        "lg":   ["var(--text-lg)",   { lineHeight: "1.3", fontWeight: "500", letterSpacing: "-0.01em" }],
        "xl":   ["var(--text-xl)",   { lineHeight: "1.2", fontWeight: "500", letterSpacing: "-0.01em" }],
      },
      // Designer §2.3 — radius-tokens (overschrijft Tailwind defaults; bestaande
      // utilities zoals `rounded-md` blijven werken maar verwijzen nu naar 6px
      // ipv Tailwind's 0.375rem default — token-vast)
      borderRadius: {
        "sm":   "var(--radius-sm)",
        "md":   "var(--radius-md)",
        "lg":   "var(--radius-lg)",
        "xl":   "var(--radius-xl)",
        "full": "var(--radius-full)",
      },
      // Designer §2.5 — shadow-levels
      boxShadow: {
        "none":   "var(--shadow-none)",
        "subtle": "var(--shadow-subtle)",
        "card":   "var(--shadow-card)",
        "modal":  "var(--shadow-modal)",
      },
      // Designer §2.6–§2.13 — kleur-tokens. Tailwind genereert hier
      // bg-*/text-*/border-*/ring-*/divide-*/etc. utilities voor.
      colors: {
        // Tenant-overridable (via ThemeProvider runtime-override)
        primary:        "var(--color-primary)",
        "primary-text": "var(--color-primary-text)",
        accent:         "var(--color-accent)",
        "accent-hover": "var(--color-accent-hover)",
        "accent-light": "var(--color-accent-light)",
        success:        "var(--color-success)",
        analysis:       "var(--color-analysis)",
        overlay:        "var(--color-overlay)",

        // AI-accent (token-laag boven tenant-accent — anti-conflict)
        "ai-accent": "var(--color-ai-accent)",

        // Flow-accent (platform-vast — klantreis-chevrons)
        "flow-accent":             "var(--color-flow-accent)",
        "flow-accent-pain":        "var(--color-flow-accent-pain)",
        "flow-accent-asymmetrie":  "var(--color-flow-accent-asymmetrie)",

        // Categorie-kleuren (platform-vast)
        "category-klanten":         "var(--category-klanten)",
        "category-klanten-light":   "var(--category-klanten-light)",
        "category-processen":       "var(--category-processen)",
        "category-processen-light": "var(--category-processen-light)",
        "category-mensen":          "var(--category-mensen)",
        "category-mensen-light":    "var(--category-mensen-light)",
        "category-it":              "var(--category-it)",
        "category-it-light":        "var(--category-it-light)",
        "category-strategie":       "var(--category-strategie)",
        "category-richtlijnen":     "var(--category-richtlijnen)",

        // SWOT-palet
        "swot-kans":             "var(--swot-kans)",
        "swot-kans-light":       "var(--swot-kans-light)",
        "swot-sterkte":          "var(--swot-sterkte)",
        "swot-sterkte-light":    "var(--swot-sterkte-light)",
        "swot-bedreiging":       "var(--swot-bedreiging)",
        "swot-bedreiging-light": "var(--swot-bedreiging-light)",
        "swot-zwakte":           "var(--swot-zwakte)",
        "swot-zwakte-light":     "var(--swot-zwakte-light)",

        // Pattern-typestyle-palet (Klanten-Inzichten)
        "pattern-cluster":             "var(--pattern-cluster)",
        "pattern-cluster-light":       "var(--pattern-cluster-light)",
        "pattern-paradox":             "var(--pattern-paradox)",
        "pattern-paradox-light":       "var(--pattern-paradox-light)",
        "pattern-positionering":       "var(--pattern-positionering)",
        "pattern-positionering-light": "var(--pattern-positionering-light)",
        "pattern-overstijgend":        "var(--pattern-overstijgend)",
        "pattern-overstijgend-light":  "var(--pattern-overstijgend-light)",

        // Asymmetrie (80/20-denkdwang cues)
        "asymmetrie-accent": "var(--asymmetrie-accent)",

        // Semantische status-kleuren
        "success-light": "var(--color-success-light)",
        warning:         "var(--color-warning)",
        "warning-light": "var(--color-warning-light)",
        danger:          "var(--color-danger)",
        "danger-light":  "var(--color-danger-light)",
        info:            "var(--color-info)",
        "info-light":    "var(--color-info-light)",

        // Neutrale grijs-schaal (NIET tenant-overridable — design-systeem-vast).
        // Overschrijft Tailwind's koel-grijze `neutral`-schaal met warmere tinten
        // uit designer-spec §2.13. Bouwers in nieuwe code gebruiken `neutral-100`
        // etc. uit dit design-systeem.
        neutral: {
          50:  "var(--neutral-50)",
          100: "var(--neutral-100)",
          200: "var(--neutral-200)",
          300: "var(--neutral-300)",
          400: "var(--neutral-400)",
          500: "var(--neutral-500)",
          600: "var(--neutral-600)",
          700: "var(--neutral-700)",
          800: "var(--neutral-800)",
          900: "var(--neutral-900)",
        },
      },
    },
  },
  plugins: [],
}
