/**
 * CoverageGauge — drie-segments-bar voor pijnpunt-coverage-status.
 *
 * 11.U Block 3b — RFC-007-rev2 §B, wireframe-doc regel 171-175:
 *  - Drie-segments-bar (160px breed): groen (covered/addressed) + grijs (dismissed)
 *    + amber (open)
 *  - Telling rechts: (addressed+dismissed)/total in monospaced
 *  - Update real-time bij elke actie (via getCoverageGauge service-call)
 *
 * Tooltip-on-hover toont breakdown per status.
 */

import React from "react";

export default function CoverageGauge({
  open = 0,
  addressed = 0,
  dismissed = 0,
  total = 0,
  appLabel,
}) {
  const lbl = (key, fb) => (appLabel ? appLabel(key, fb) : fb);
  const safeTotal = Math.max(total || 0, 1); // voorkom division-by-zero
  const addressedPct = ((addressed || 0) / safeTotal) * 100;
  const dismissedPct = ((dismissed || 0) / safeTotal) * 100;
  const openPct = ((open || 0) / safeTotal) * 100;

  const tooltipText = lbl(
    "klanten.verbeteracties.gauge.tooltip",
    "{addressed} geadresseerd · {dismissed} genegeerd · {open} open",
  )
    .replace("{addressed}", addressed)
    .replace("{dismissed}", dismissed)
    .replace("{open}", open);

  const ariaLabel = lbl(
    "klanten.verbeteracties.gauge.label.aria",
    "Coverage: {addressed} van {total} geadresseerd",
  )
    .replace("{addressed}", addressed)
    .replace("{total}", total);

  return (
    <div
      className="flex items-center gap-2"
      data-testid="coverage-gauge"
      title={tooltipText}
      role="meter"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={addressed + dismissed}
    >
      {/* 3-segments-bar */}
      <div
        className="flex h-2 w-[160px] rounded-full overflow-hidden bg-slate-100"
        data-testid="coverage-gauge-bar"
      >
        {addressed > 0 && (
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${addressedPct}%` }}
            data-testid="coverage-gauge-addressed"
            aria-hidden="true"
          />
        )}
        {dismissed > 0 && (
          <div
            className="h-full bg-slate-400"
            style={{ width: `${dismissedPct}%` }}
            data-testid="coverage-gauge-dismissed"
            aria-hidden="true"
          />
        )}
        {open > 0 && (
          <div
            className="h-full bg-amber-400"
            style={{ width: `${openPct}%` }}
            data-testid="coverage-gauge-open"
            aria-hidden="true"
          />
        )}
      </div>
      {/* Telling */}
      <span
        className="text-xs font-mono text-slate-700 whitespace-nowrap"
        data-testid="coverage-gauge-count"
      >
        {addressed + dismissed}/{total}
      </span>
    </div>
  );
}
