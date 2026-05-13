/**
 * AiIcon — pure-icon variant voor AI-affordances (zonder button-wrapper).
 *
 * Gebruik bij inline AI-iconen die binnen bestaande knoppen of in tekst-koppen
 * staan, of bij decoratieve loading-states (animate-pulse).
 *
 * Voor stand-alone AI-knoppen: gebruik <AiIconButton>.
 *
 * Visuele standaard (zie CLAUDE.md sectie 3B):
 *   - Default kleur: text-[var(--color-ai-accent)]/70  (overrideable via colorClass)
 *   - variant="improve"  → Wand2     (verbeter op basis van bestaande context)
 *   - variant="generate" → Sparkles  (genereer nieuw / vrije AI-actie)
 */

import { Wand2, Sparkles, Loader2 } from "lucide-react";

const VARIANT_ICON = {
  improve:  Wand2,
  generate: Sparkles,
};

export default function AiIcon({
  variant   = "improve",
  size      = 12,
  loading   = false,
  className = "",
  colorClass = "text-[var(--color-ai-accent)]/70",
}) {
  const Icon = loading ? Loader2 : (VARIANT_ICON[variant] ?? Wand2);
  const animation = loading ? "animate-spin" : "";
  const cls = [colorClass, animation, className].filter(Boolean).join(" ");
  return <Icon size={size} className={cls} aria-hidden="true" />;
}
