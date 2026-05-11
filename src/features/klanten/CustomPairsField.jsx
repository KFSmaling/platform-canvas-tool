/**
 * CustomPairsField — UI voor `archetype_data.vrije_velden` jsonb (RFC-001 §2.2.1).
 *
 * Toont 4 vaste key+value-paren in een grid. Consultant kan elk paar invullen
 * of leeg laten. Lege paren (key === '') worden buiten de save-payload gefilterd.
 * Server-validatie blokkeert >4 keys (api/klanten/_archetypes.js regel 71-78).
 *
 * Stap 11.I.1: gebruikt interne array-state om pair-posities stabiel te
 * houden tijdens typen. Object-naar-pairs gebeurt alleen bij init (mount);
 * daarna is de array de bron van waarheid en wordt `onChange` aangeroepen
 * met het gefilterde object. Dit voorkomt dat halfgevulde paren (key zonder
 * value of vice versa) "verschuiven" in de UI tijdens typen.
 *
 * Hergebruikbaar voor toekomstige archetypes met vergelijkbaar jsonb-vrije-
 * velden-pattern.
 *
 * Props:
 *   - value: object — vrije_velden bij mount (bv. { sleutel1: waarde1 })
 *   - onChange(nextObject) — vuurt bij elke wijziging, lege keys er al uit
 *   - labelKey + fallback — voor de sectie-titel via appLabel
 *   - helperKey + helperFallback (optioneel) — uitleg-tekst onder titel
 *   - appLabel — context-functie uit useAppConfig
 *   - max — max aantal paren (default 4)
 *   - fieldKey (optioneel) — voor data-testid-prefix
 */

import React, { useState } from "react";

const MAX_PAIRS_DEFAULT = 4;

/** Object → array van { key, value }-paren, aangevuld tot `count` lege paren. */
function objectToInitialPairs(obj, count) {
  const entries = Object.entries(obj || {});
  const pairs = entries.map(([key, value]) => ({ key, value: value == null ? "" : String(value) }));
  while (pairs.length < count) pairs.push({ key: "", value: "" });
  return pairs.slice(0, count);
}

/** Array → object, filtert lege keys uit. */
function pairsToObject(pairs) {
  const out = {};
  for (const p of pairs) {
    const k = (p?.key || "").trim();
    if (k.length === 0) continue;
    out[k] = (p?.value || "").trim();
  }
  return out;
}

export default function CustomPairsField({
  value,
  onChange,
  labelKey,
  fallback,
  helperKey,
  helperFallback,
  appLabel,
  max = MAX_PAIRS_DEFAULT,
  fieldKey,
}) {
  // Init alleen bij mount — daarna is `pairs` de bron van waarheid.
  // Voorkomt dat lege-key-paren "verdwijnen" uit de UI tijdens typen.
  const [pairs, setPairs] = useState(() => objectToInitialPairs(value, max));

  function update(index, patch) {
    setPairs(prev => {
      const next = prev.map((p, i) => (i === index ? { ...p, ...patch } : p));
      onChange(pairsToObject(next));
      return next;
    });
  }

  return (
    <div data-testid={`custom-pairs-${fieldKey || "vrije_velden"}`}>
      <label className="block text-[11px] font-medium text-slate-600 mb-1">
        {appLabel(labelKey, fallback)}
      </label>
      {helperKey && (
        <p className="text-[10px] text-slate-500 italic mb-2">
          {appLabel(helperKey, helperFallback || "")}
        </p>
      )}
      <div className="space-y-2 border border-slate-200 rounded p-3 bg-slate-50">
        {pairs.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 w-8 shrink-0">{i + 1}.</span>
            <input
              type="text"
              value={p.key}
              onChange={e => update(i, { key: e.target.value })}
              placeholder="sleutel"
              data-testid={`custom-pairs-key-${i}`}
              className="w-2/5 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-[var(--color-accent)]"
            />
            <input
              type="text"
              value={p.value}
              onChange={e => update(i, { value: e.target.value })}
              placeholder="waarde"
              data-testid={`custom-pairs-value-${i}`}
              className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
