/**
 * OverflowMenu — drie-puntjes-menu rechtsboven (Fase 3 design-systeem).
 *
 * Designer-output 2026-05-13 §7 punt 10: "Overflow-menu identiek voor alle
 * users, admins krijgen extra 'App config'-optie binnen het menu". Vervangt
 * twee aparte hamburger-iconen in huidige App.js header (SlidersHorizontal
 * voor project-info + SlidersHorizontal voor admin-link + LogOut).
 *
 * Props:
 *   items: Array<{ id, label, icon?, onClick, divider?, danger?, hidden? }>
 *
 * Items renderen in volgorde. `divider: true` → horizontale lijn boven item.
 * `danger: true` → rode tekst (bv. Uitloggen). `hidden: true` → niet
 * gerendered (handig voor conditionele admin-link).
 *
 * Component beheert eigen open/close-state + klik-buiten-sluiten via
 * useEffect-mousedown-listener (geen externe dependency).
 *
 * Visueel: button met MoreVertical-icon (designer §2.4 icon-md = 18px),
 * dropdown-paneel positie absolute rechts-uitgelijnd met `shadow-card`
 * (token uit Fase 1) + `bg-white border-neutral-200`.
 */

import React, { useState, useRef, useEffect } from "react";
import { MoreVertical } from "lucide-react";

export default function OverflowMenu({
  items = [],
  triggerLabel = "Meer opties",
  triggerClassName = "text-white/60 hover:text-white",
  size = 18,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Klik-buiten-sluiten + Esc-toets-sluiten.
  useEffect(() => {
    if (!open) return undefined;
    function handleMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const visibleItems = items.filter(it => !it.hidden);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        title={triggerLabel}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open ? "true" : "false"}
        data-testid="overflow-menu-trigger"
        className={`flex items-center justify-center w-9 h-9 rounded-md transition-colors ${triggerClassName}`}
      >
        <MoreVertical size={size} />
      </button>
      {open && (
        <div
          role="menu"
          data-testid="overflow-menu-panel"
          className="absolute right-0 top-full mt-1 min-w-[220px] bg-white border border-neutral-200 rounded-md shadow-card z-50 py-1.5"
        >
          {visibleItems.map((item, idx) => {
            const showDivider = item.divider && idx > 0;
            return (
              <React.Fragment key={item.id}>
                {showDivider && <div className="border-t border-neutral-200 my-1" />}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (typeof item.onClick === "function") item.onClick();
                  }}
                  role="menuitem"
                  data-testid={`overflow-menu-item-${item.id}`}
                  data-danger={item.danger ? "true" : "false"}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors hover:bg-neutral-100 ${
                    item.danger ? "text-danger" : "text-neutral-900"
                  }`}
                  style={item.danger
                    ? { color: "var(--color-danger)" }
                    : { color: "var(--neutral-900)" }}
                >
                  {item.icon && (
                    <item.icon size={14} className={item.danger ? "text-danger" : "text-neutral-500"} />
                  )}
                  <span>{item.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
