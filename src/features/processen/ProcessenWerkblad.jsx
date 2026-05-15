/**
 * ProcessenWerkblad — root-component voor Processen & Organisatie-werkblad (11.M).
 *
 * Geactiveerd via DeepDiveOverlay's WERKBLAD_REGISTRY met blockId="processes".
 *
 * RFC-005-implementatie:
 *  - 3 fase-tabs: Inventarisatie / Pijnpunten / Verbeteracties (§2.1 afwijking ADR-004)
 *  - Sub-tabs alleen op fase 1 (Variant A wireframe-doc regel 133)
 *  - 4 sub-tabs: Bedrijfsprocessen / Lijnorganisatie / Veranderorganisatie / Besturing
 *  - GEEN "Naar Roadmap"-knop (Designer-Principe 7 pull-model)
 *  - Categorie="processen" + groen-token (#639922 via Tailwind border-b-category-processen)
 *
 * Per CLAUDE.md §4.1: key={canvasId} via DeepDiveOverlay (al geïmplementeerd).
 *
 * Volgende stappen (deferred uit 11.M C5+C10+C11):
 *  - Dossier-AI affordances per sub-tab (C5 follow-up; nu 501 server-side)
 *  - Fase 2/3 functionele rendering (C10/C11 follow-up; nu placeholder)
 */

import React, { useState } from "react";
import { Workflow, Info } from "lucide-react";
import { useAppConfig } from "../../shared/context/AppConfigContext";
import { useAuth } from "../../shared/services/auth.service";
import { useLang } from "../../i18n";
import WerkbladHeader from "../../shared/components/WerkbladHeader";
import WerkbladActieknoppen from "../../shared/components/WerkbladActieknoppen";
import WerkbladTipsModal from "../../shared/components/WerkbladTipsModal";
// Hergebruik useCanvasUploads uit klanten (RFC-002-pattern; klanten anker).
// Boy-scout-mogelijkheid: lift naar shared/hooks in volgend block.
import { useCanvasUploads } from "../klanten/hooks/useCanvasUploads";

import BedrijfsprocessenView from "./components/BedrijfsprocessenView";
import LijnorganisatieView   from "./components/LijnorganisatieView";
import VeranderorganisatieView from "./components/VeranderorganisatieView";
import BesturingView from "./components/BesturingView";
import PijnpuntenView from "./components/PijnpuntenView";
import VerbeteractiesView from "./components/VerbeteractiesView";

const FASE_TABS = [
  { id: 1, num: 1, labelKey: "processen.fase.1.titel", fallback: "Inventarisatie" },
  { id: 2, num: 2, labelKey: "processen.fase.2.titel", fallback: "Pijnpunten" },
  { id: 3, num: 3, labelKey: "processen.fase.3.titel", fallback: "Verbeteracties" },
];

const SUB_TABS = [
  { id: "bedrijfsprocessen",     labelKey: "processen.subtab.bedrijfsprocessen",     fallback: "Bedrijfsprocessen" },
  { id: "lijnorganisatie",       labelKey: "processen.subtab.lijnorganisatie",       fallback: "Lijnorganisatie" },
  { id: "veranderorganisatie",   labelKey: "processen.subtab.veranderorganisatie",   fallback: "Veranderorganisatie" },
  { id: "besturing",             labelKey: "processen.subtab.besturing",             fallback: "Besturing" },
];

export default function ProcessenWerkblad({ canvasId, onClose }) {
  const { label: appLabel } = useAppConfig();
  const { user, signOut } = useAuth();
  const { lang, setLang } = useLang();

  const [activeFase, setActiveFase]     = useState(1);
  const [activeSubTab, setActiveSubTab] = useState("bedrijfsprocessen");
  const [showTips, setShowTips] = useState(false);

  // Dossier-AI affordance-status (block-1): single source of truth via klanten-hook.
  const { hasUploads, hasIndexedChunks, uploadsProcessing } = useCanvasUploads(canvasId);
  const aiAffordanceProps = { hasUploads, hasIndexedChunks, uploadsProcessing };

  // Tips-content per sub-tab (Variant A: tips ALLEEN tijdens fase 1)
  const tipsTitelKey = `processen.tips.${activeSubTab}.titel`;
  const tipsBodyKey  = `processen.tips.${activeSubTab}.body`;
  // Mapping naar `label.tips.processen.<sub-tab>.*` zoals seed in C2
  const tipsTitelLabel = appLabel(`tips.processen.${activeSubTab}.titel`, `Tips`);
  const tipsBodyLabel  = appLabel(`tips.processen.${activeSubTab}.body`, "");

  const faseTabs = FASE_TABS.map(t => ({
    id: t.id,
    num: t.num,
    label: appLabel(t.labelKey, t.fallback),
  }));

  // ── Render fase-body ──
  function renderFaseBody() {
    if (activeFase === 1) {
      if (activeSubTab === "bedrijfsprocessen")     return <BedrijfsprocessenView   canvasId={canvasId} {...aiAffordanceProps} />;
      if (activeSubTab === "lijnorganisatie")       return <LijnorganisatieView     canvasId={canvasId} {...aiAffordanceProps} />;
      if (activeSubTab === "veranderorganisatie")   return <VeranderorganisatieView canvasId={canvasId} {...aiAffordanceProps} />;
      if (activeSubTab === "besturing")             return <BesturingView           canvasId={canvasId} {...aiAffordanceProps} />;
      return null;
    }
    if (activeFase === 2) return <PijnpuntenView      canvasId={canvasId} {...aiAffordanceProps} />;
    if (activeFase === 3) return <VerbeteractiesView  canvasId={canvasId} />;
    return null;
  }

  return (
    <div data-testid="processen-werkblad" className="h-full flex flex-col bg-slate-50">
      <WerkbladHeader
        categorie="processen"
        icon={Workflow}
        titel={appLabel("processen.werkblad.titel", "Processen & Organisatie")}
        capsLabel={appLabel("processen.werkblad.label_categorie", "Werkblad")}
        showLogo
        lang={lang}
        onLangSwitch={() => setLang(lang === "nl" ? "en" : "nl")}
        onClose={onClose}
        overflowItems={user ? [
          { id: "signout", label: "Uitloggen", onClick: signOut, divider: true },
        ] : []}
        tabs={faseTabs}
        activeTabId={activeFase}
        onTabClick={(id) => setActiveFase(id)}
        actieknoppen={
          <WerkbladActieknoppen
            actions={[
              { id: "tips", label: "Tips", onClick: () => setShowTips(true), variant: "secondary" },
              { id: "inzichten", label: "Inzichten", onClick: () => {}, variant: "secondary", disabled: true },
              { id: "rapport",   label: "Rapportage", onClick: () => {}, variant: "secondary", disabled: true },
            ]}
          />
        }
      />

      {/* Sub-tab strip: alleen op fase 1 (Variant A) */}
      {activeFase === 1 && (
        <div
          data-testid="processen-subtab-strip"
          className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-2 flex items-center gap-2"
        >
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              data-testid={`processen-subtab-${tab.id}`}
              data-active={activeSubTab === tab.id ? "true" : "false"}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeSubTab === tab.id
                  ? "bg-category-processen text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {appLabel(tab.labelKey, tab.fallback)}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {renderFaseBody()}
      </div>

      {/* Tips-modal — shared platform-pattern (T2-precedent) */}
      {showTips && (
        <WerkbladTipsModal
          titel={tipsTitelLabel}
          body={tipsBodyLabel}
          onClose={() => setShowTips(false)}
        />
      )}
    </div>
  );
}
