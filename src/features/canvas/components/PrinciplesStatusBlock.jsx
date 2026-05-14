import React from "react";
import { CheckCircle2 } from "lucide-react";
import { useLang } from "../../../i18n";
import { useAppConfig } from "../../../shared/context/AppConfigContext";
import { STATUS_COLORS, STATUS_BADGE_KEYS } from "./BlockCard";

// ── Segmentdefinities — labels via appLabel(), fallback hardcoded ─────────────
// T1 A9: vijf categorieën (Generiek + Klanten + Processen + Mensen + IT) —
// consistent met werkblad-categorieën. Processen + Mensen tonen voorlopig leeg
// zonder data-migratie (Kees expliciet: geen data-impact).
const SEGMENTS = [
  { key: "generiek",    fallbackNl: "Generiek",    fallbackEn: "Generic"      },
  { key: "klanten",     fallbackNl: "Klanten",     fallbackEn: "Customers"    },
  { key: "processen",   fallbackNl: "Processen",   fallbackEn: "Processes"    },
  { key: "mensen",      fallbackNl: "Mensen",      fallbackEn: "People"       },
  { key: "it",          fallbackNl: "IT",          fallbackEn: "IT"           },
];

// ── Principles Status Block (canvas dashboard view) ──────────────────────────
function PrinciplesStatusBlock({ block, status, bullets, guidelineCounts = {}, onClick }) {
  const { t, lang }        = useLang();
  const { label: appLabel } = useAppConfig();
  const title    = t(block.titleKey);
  const badgeDef = STATUS_BADGE_KEYS[status];
  const badge    = badgeDef ? { label: t(badgeDef.labelKey), color: badgeDef.color } : null;

  const totalCount     = Object.values(guidelineCounts).reduce((s, v) => s + v, 0);
  const filledSegments = Object.values(guidelineCounts).filter(v => v > 0).length;

  return (
    <div
      className={`col-span-12 p-5 rounded shadow-md hover:shadow-xl cursor-pointer transition-all relative flex flex-col gap-3 min-h-[140px] ${STATUS_COLORS[status]}`}
      onClick={onClick}
    >
      {/* ── Titel + statusbadge ── */}
      <div className="flex items-start justify-between">
        <h3
          className="text-[var(--color-primary)] font-bold text-[13px] uppercase tracking-[0.12em]"
          style={{ fontFamily: "'Montserrat','Inter',sans-serif" }}
        >
          {title}
        </h3>
        {badge && (
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${badge.color}`}>
            {badge.label}
          </span>
        )}
      </div>

      {/* ── Preview / hint ── */}
      {totalCount > 0 ? (
        <p className="text-xs text-slate-600 leading-relaxed border-l-2 border-[var(--color-accent)] pl-3 italic">
          {lang === "en"
            ? `${totalCount} guiding principle${totalCount !== 1 ? "s" : ""} defined across ${filledSegments} segment${filledSegments !== 1 ? "s" : ""}`
            : `${totalCount} leidende principe${totalCount !== 1 ? "s" : ""} gedefinieerd in ${filledSegments} segment${filledSegments !== 1 ? "en" : ""}`
          }
        </p>
      ) : (
        <p className="text-[11px] text-slate-300 italic">
          {lang === "en"
            ? "Click to open the Guidelines Workbook →"
            : "Klik om het richtlijnen werkblad te openen →"
          }
        </p>
      )}

      {/* ── Segmentstatus — vier bolletjes met vinkje, labels via appLabel ── */}
      <div className="flex items-center gap-4 flex-wrap pt-1 border-t border-slate-100">
        {SEGMENTS.map(seg => {
          const count = guidelineCounts[seg.key] || 0;
          // Labels via DB (admin aanpasbaar), fallback op hardcoded waarden
          const label = lang === "en"
            ? seg.fallbackEn   // Engels heeft nog geen DB-label; veld toe te voegen indien nodig
            : appLabel(`richtl.segment.${seg.key}`, seg.fallbackNl);
          return (
            <div key={seg.key} className="flex items-center gap-1.5">
              {count > 0
                ? <CheckCircle2 size={13} className="text-[var(--color-success)] flex-shrink-0" />
                : <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 flex-shrink-0" />
              }
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${count > 0 ? "text-slate-600" : "text-slate-300"}`}>
                {label}
              </span>
              {count > 0 && (
                <span className="text-[9px] text-slate-400">({count})</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PrinciplesStatusBlock;
