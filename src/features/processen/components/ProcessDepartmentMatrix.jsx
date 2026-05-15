/**
 * ProcessDepartmentMatrix — M:N matrix-render proces × afdeling (11.M.1 block-3b D1).
 *
 * RFC-005 §5.3 `org_process_department_intensity`:
 *  - Per cel: 2-niveau-intensity (involved / niet)
 *  - Cross-functional-chip bij ≥3 betrokken afdelingen voor één proces
 *
 * Proceseigenaar-tekst per proces-rij (Kees-keuze: vrije tekst, geen FK):
 *  - Opgeslagen in `pr_processes.archetype_data.proces_eigenaar` (jsonb-sub-key)
 *    om DB-migratie te vermijden — instructie D1.4 accepteert "of equivalent"
 *  - UPDATE via svc.updateProcess(id, { archetype_data: { ...existing, proces_eigenaar } })
 *
 * UX:
 *  - Rijen = processen (alle canonical), Kolommen = afdelingen (alle canonical)
 *  - Cel toont ✓ als involved, leeg als niet
 *  - Click op cel toggle't intensity
 *  - Inline proces-eigenaar-edit naast procesnaam met blur-save
 *
 * Props:
 *  - canvasId
 *  - onReload(): trigger parent-reload
 */

import React, { useState } from "react";

export default function ProcessDepartmentMatrix({ processes, departments, intensity, onToggleCell, onSaveOwner }) {
  const [editingOwner, setEditingOwner] = useState(null); // process_id
  const [ownerDraft, setOwnerDraft] = useState("");

  // Lookup: intensityMap.get(`${process_id}::${department_id}`) → row of undefined
  const intensityMap = new Map();
  for (const row of intensity) {
    intensityMap.set(`${row.process_id}::${row.department_id}`, row);
  }

  // Cross-functional: count distinct departments per process
  function deptCountForProcess(processId) {
    const set = new Set();
    for (const row of intensity) {
      if (row.process_id === processId) set.add(row.department_id);
    }
    return set.size;
  }

  function handleCellClick(processId, departmentId) {
    const existing = intensityMap.get(`${processId}::${departmentId}`);
    onToggleCell(processId, departmentId, existing); // existing=row|undefined
  }

  function startEditOwner(p) {
    setEditingOwner(p.id);
    setOwnerDraft(p.archetype_data?.proces_eigenaar || "");
  }

  function commitOwner(p) {
    const newVal = ownerDraft.trim();
    const oldVal = p.archetype_data?.proces_eigenaar || "";
    if (newVal !== oldVal) onSaveOwner(p.id, newVal);
    setEditingOwner(null);
  }

  if (processes.length === 0 || departments.length === 0) {
    return (
      <p className="text-xs text-slate-400 italic px-2 py-1">
        {processes.length === 0
          ? "Voeg eerst bedrijfsprocessen toe (sub-tab Bedrijfsprocessen)"
          : "Voeg eerst afdelingen toe (boven)"}
      </p>
    );
  }

  return (
    <div data-testid="pdi-matrix" className="overflow-x-auto">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="px-2 py-2 text-left font-bold text-slate-600 uppercase tracking-wider text-[9px] border-b border-slate-200 sticky left-0 bg-white z-10">
              Proces
            </th>
            <th className="px-2 py-2 text-left font-bold text-slate-600 uppercase tracking-wider text-[9px] border-b border-slate-200">
              Proceseigenaar
            </th>
            {departments.map(d => (
              <th
                key={d.id}
                data-testid={`pdi-col-${d.id}`}
                className="px-1 py-2 text-center font-medium text-slate-600 text-[10px] border-b border-slate-200 max-w-[80px]"
              >
                <span className="block truncate" title={d.name}>{d.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {processes.map(p => {
            const deptCount = deptCountForProcess(p.id);
            const isCrossFunctional = deptCount >= 3;
            return (
              <tr key={p.id} data-testid={`pdi-row-${p.id}`} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-2 py-2 align-top sticky left-0 bg-white">
                  <div className="flex items-start gap-1.5">
                    <span className="text-sm text-slate-800 truncate max-w-[180px]" title={p.name}>{p.name}</span>
                    {isCrossFunctional && (
                      <span
                        data-testid={`pdi-cross-functional-${p.id}`}
                        className="shrink-0 px-1.5 py-0.5 text-[8px] uppercase tracking-wider rounded bg-purple-100 text-purple-800 border border-purple-200"
                        title={`Cross-functional · ${deptCount} afdelingen`}
                      >
                        cross-fn ×{deptCount}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 align-top">
                  {editingOwner === p.id ? (
                    <input
                      type="text"
                      value={ownerDraft}
                      onChange={(e) => setOwnerDraft(e.target.value)}
                      onBlur={() => commitOwner(p)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitOwner(p);
                        if (e.key === "Escape") setEditingOwner(null);
                      }}
                      autoFocus
                      data-testid={`pdi-owner-input-${p.id}`}
                      className="w-full px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-[var(--color-accent)]"
                      placeholder="Naam proceseigenaar…"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEditOwner(p)}
                      data-testid={`pdi-owner-edit-${p.id}`}
                      className={`w-full text-left text-xs px-1.5 py-0.5 rounded hover:bg-slate-100 ${
                        p.archetype_data?.proces_eigenaar ? "text-slate-700 italic" : "text-slate-400"
                      }`}
                    >
                      {p.archetype_data?.proces_eigenaar || "+ eigenaar"}
                    </button>
                  )}
                </td>
                {departments.map(d => {
                  const cell = intensityMap.get(`${p.id}::${d.id}`);
                  const involved = !!cell;
                  return (
                    <td key={d.id} className="px-1 py-1 text-center border-r border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleCellClick(p.id, d.id)}
                        data-testid={`pdi-cell-${p.id}-${d.id}`}
                        data-involved={involved ? "true" : "false"}
                        aria-label={involved ? "Verwijder koppeling" : "Voeg koppeling toe"}
                        className={`w-7 h-7 rounded transition-colors ${
                          involved
                            ? "bg-category-processen text-white hover:bg-green-700"
                            : "bg-slate-50 text-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        {involved ? "✓" : "·"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-slate-400 italic">
        Click op een cel toggle't de koppeling. Cross-functional-chip verschijnt bij ≥3 betrokken afdelingen. Proceseigenaar is vrije tekst per proces.
      </p>
    </div>
  );
}
