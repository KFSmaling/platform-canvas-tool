/**
 * AppConfigContext — prompts + UI labels uit Supabase app_config tabel
 *
 * Laadt alle config éénmalig na login. Geeft label() en prompt() functies
 * die via de hele app beschikbaar zijn zonder props drilling.
 *
 * Gebruik:
 *   const { label, prompt, refresh } = useAppConfig();
 *   label("app.title")                    → "Strategy Platform"
 *   prompt("magic.system_standard")       → "Je bent een Senior Strategie..."
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../services/supabase.client";

// ── Hardcoded fallbacks (veiligheidsnet als DB onbereikbaar is) ──────────────
const LABEL_FALLBACKS = {
  // Applicatie (header + footer)
  "app.title":                      "Strategy Platform",
  "app.subtitle":                   "From strategy to execution",
  "footer.tagline":                 "From strategy to execution",
  // Werkblad namen
  "werkblad.strategie":             "Strategie Werkblad",
  "werkblad.richtlijnen":           "Richtlijnen & Leidende Principes",
  // Strategie Werkblad — secties (legacy, voor backwards-compat)
  "section.extern":                 "Externe Marktontwikkelingen",
  "section.intern":                 "Interne Ontwikkelingen",
  "section.identiteit":             "Identiteit & Positionering",
  "section.executie":               "Executie",
  "section.strategie":              "Strategische Koers",
  // Strategie Werkblad — sectiekoppen
  "strat.section.identiteit":       "Identiteit",
  "strat.section.analyse":          "Analyse",
  "strat.section.executie":         "Executie — 7·3·3 Regel",
  // Strategie Werkblad — veldnamen
  "strat.field.missie":             "Missie",
  "strat.field.visie":              "Visie",
  "strat.field.ambitie":            "Ambitie (BHAG)",
  "strat.field.kernwaarden":        "Kernwaarden",
  "strat.field.samenvatting":       "Strategische Samenvatting",
  "strat.field.extern":             "Externe Ontwikkelingen",
  "strat.field.intern":             "Interne Ontwikkelingen",
  "strat.autotag.button":           "Auto-tag",
  "werkblad.strategie.title":       "Strategie",
  // Werkblad — drie-knoppen-shell (Sprint C, issue #69)
  "werkblad.action.analyseer":              "Analyse draaien",
  "werkblad.action.analyseer_opnieuw":      "Opnieuw analyseren",
  "werkblad.action.analyseert":             "Analyseren…",
  "werkblad.action.bekijk_inzichten":       "Inzichten bekijken",
  "werkblad.action.bekijk_disabled_tooltip":"Eerst een analyse draaien",
  "werkblad.action.rapportage":             "Rapportage",
  "werkblad.action.rapportage_tooltip":     "Volgt in volgende release",
  // Inzichten overlay — generieke labels (alle werkbladen)
  "analysis.title":                          "Inzichten",
  "analysis.subtitle":                       "Strategische Analyse",
  "analysis.kicker":                         "Inzichten",
  "analysis.toc.label":                      "Inhoud",
  "analysis.chapter.onderdelen":             "Onderdelen",
  "analysis.chapter.dwarsverbanden":         "Dwarsverbanden",
  "analysis.chapter.number.onderdelen":      "Hoofdstuk 1",
  "analysis.chapter.number.dwarsverbanden":  "Hoofdstuk 2",
  "analysis.chapter.intro.onderdelen":       "Observaties over losse elementen van de strategie: wat ontbreekt, wat is zwak, waar liggen kansen, waar zit kracht.",
  "analysis.chapter.intro.dwarsverbanden":   "Observaties over samenhang: overlap tussen thema's, consistentie tussen visie en ambitie, en verbanden met andere werkbladen van het canvas.",
  "analysis.type.ontbreekt":                 "Ontbreekt",
  "analysis.type.zwak":                      "Zwak punt",
  "analysis.type.kans":                      "Kans",
  "analysis.type.sterk":                     "Sterkte",
  "analysis.section.observation":            "Observatie",
  "analysis.section.recommendation":         "Aanbeveling",
  "analysis.section.references":             "Verwijst naar",
  "analysis.meta.canvas":                    "Canvas:",
  "analysis.meta.generated":                 "Gegenereerd",
  "analysis.meta.findings":                  "bevindingen",
  "analysis.empty":                          "Nog geen analyse. Klik 'Analyse draaien' in het werkblad.",
  "analysis.empty.filtered":                 "Geen bevindingen zichtbaar met de huidige filters.",
  "analysis.action.terug":                   "← Terug naar werkblad",
  "analysis.loading":                        "AI analyseert uw strategie…",
  "analysis.filter.label":                   "Toon:",
  "analysis.filter.type":                    "Filter type",
  "analysis.sourceref.header":               "Verwijst naar",
  // Richtlijnen Werkblad — segmenten
  "richtl.segment.generiek":        "Generiek",
  "richtl.segment.generiek.sub":    "Strategie & Governance",
  "richtl.segment.klanten":         "Klanten",
  "richtl.segment.klanten.sub":     "Markt & Dienstverlening",
  "richtl.segment.organisatie":     "Organisatie",
  "richtl.segment.organisatie.sub": "Mens & Proces",
  "richtl.segment.it":              "IT",
  "richtl.segment.it.sub":          "Technologie & Data",
  // Klanten & Dienstverlening werkblad (stap 11.D MVP)
  "klanten.werkblad.titel":           "Klanten & Dienstverlening",
  "klanten.section.werkruimte":       "Werkruimte",
  "klanten.section.rapport":          "Rapport",
  "klanten.fase.1.titel":             "Inventarisatie",
  "klanten.fase.2.titel":             "Pijnpunten",
  "klanten.fase.3.titel":             "Analyse",
  "klanten.fase.4.titel":             "Verbeterrichtingen",
  "klanten.fase.disabled.tooltip":    "komt in latere sprint",
  "klanten.dimensie.klantsegment":    "Klantsegmenten",
  "klanten.dimensie.propositie":      "Proposities",
  "klanten.dimensie.kanaal":          "Kanalen",
  "klanten.veld.klantsegment.omvang":             "Omvang",
  "klanten.veld.klantsegment.strategisch_belang": "Strategisch belang",
  "klanten.veld.klantsegment.karakteristieken":   "Karakteristieken",
  "klanten.veld.klantsegment.behoeften":          "Behoeften",
  "klanten.veld.propositie.differentiatie":       "Differentiatie",
  "klanten.veld.propositie.prijsstelling":        "Prijsstelling",
  "klanten.veld.propositie.levensfase":           "Levensfase",
  "klanten.veld.propositie.concurrentiepositie":  "Concurrentiepositie",
  "klanten.veld.kanaal.type":         "Type",
  "klanten.veld.kanaal.bereik":       "Bereik",
  "klanten.veld.kanaal.ervaring":     "Ervaring",
  "klanten.veld.kanaal.economie":     "Economie",
  "klanten.modal.item.titel.add":     "Nieuw item",
  "klanten.modal.item.titel.edit":    "Item bewerken",
  "klanten.knop.dimensie.toevoegen":  "+ dimensie",
  "klanten.knop.item.toevoegen":      "+ item",
  "klanten.knop.item.opslaan":        "Opslaan",
  "klanten.knop.item.annuleren":      "Annuleren",
  "klanten.rapport.titel":            "Klanten & Dienstverlening — overzicht",
  "klanten.rapport.section.samenvatting": "Samenvatting",
  "klanten.rapport.section.huidig":   "Huidige situatie",
  "klanten.rapport.section.patronen": "Patronen",
  "klanten.rapport.section.richtingen": "Verbeterrichtingen",
  "klanten.rapport.knop.print":       "PDF / Printen",
  "klanten.ai.cluster":               "Cluster-analyse",
  "klanten.ai.paradox":               "Paradox-detectie",
  "klanten.ai.positionering":         "Positionering",
  "klanten.ai.overstijgend":          "Overstijgend",
  "klanten.ai.disabled.tooltip":      "AI komt in fase 3",
  "klanten.helper.iteratief":         "werk in uitvoering — geen 'klaar' status",
  "klanten.helper.fase.geen_volgorde":"geen verplichte volgorde",
  // Stap 11.E correctie — DimensieCreateModal + lege-state CTA
  "klanten.knop.dimensie.toevoegen.eerste":         "+ Eerste dimensie aanmaken",
  "klanten.dimensie.create.titel":                  "Nieuwe dimensie",
  "klanten.dimensie.create.archetype.label":        "Archetype",
  "klanten.dimensie.create.archetype.placeholder":  "Kies een archetype…",
  "klanten.dimensie.create.naam.label":             "Naam",
  "klanten.dimensie.create.naam.placeholder":       "bijv. Klantsegmenten of Doelgroepen",
  "klanten.dimensie.create.omschrijving.label":     "Omschrijving (optioneel)",
  "klanten.dimensie.create.omschrijving.placeholder":"korte tenant-beschrijving van deze dimensie",
  "klanten.dimensie.create.error.naam_leeg":        "Naam is verplicht",
  "klanten.archetype.disabled.tooltip":             "komt in latere sprint",
  // Stap 11.F — Boy-scout dimensie-edit + Pijnpunten fase 2
  "klanten.dimensie.edit.titel":                    "Dimensie bewerken",
  "klanten.dimensie.edit.tooltip":                  "Klik om te bewerken",
  "klanten.dimensie.edit.archetype.locked":         "(niet wijzigbaar — datamodel-impact)",
  "klanten.pijnpunt.intro":                         "verzamel waarnemingen en koppel aan items. multi-relationeel — een pijnpunt mag aan meerdere dimensies hangen, of nergens (overstijgend).",
  "klanten.pijnpunt.lijst.titel":                   "Pijnpunten",
  "klanten.pijnpunt.lijst.helper":                  "card laat koppelingen zien als chips",
  "klanten.pijnpunt.lijst.leeg":                    "Nog geen pijnpunten — voeg er één toe.",
  "klanten.pijnpunt.knop.toevoegen":                "+ pijnpunt",
  "klanten.pijnpunt.knop.toevoegen.eerste":         "+ Eerste pijnpunt aanmaken",
  "klanten.pijnpunt.create.titel":                  "Nieuw pijnpunt",
  "klanten.pijnpunt.edit.titel":                    "Pijnpunt bewerken",
  "klanten.pijnpunt.create.tekst.label":            "Pijnpunt-tekst",
  "klanten.pijnpunt.create.tekst.placeholder":      "Beschrijf de waarneming of het pijnpunt — bron mag in de tekst (markdown)",
  "klanten.pijnpunt.create.koppelingen.label":      "Koppelingen aan items (optioneel)",
  "klanten.pijnpunt.create.koppelingen.helper":     "Géén selectie = overstijgend pijnpunt (geen specifieke item-koppeling)",
  "klanten.pijnpunt.create.error.tekst_leeg":       "Tekst is verplicht",
  "klanten.pijnpunt.create.overstijgend.warning":   "Wordt opgeslagen als overstijgend pijnpunt (geen koppeling)",
  "klanten.pijnpunt.overstijgend.label":            "geen koppeling — overstijgend",
  "klanten.rapport.section.pijnpunten":             "Pijnpunten",
  "klanten.rapport.pijnpunten.leeg":                "Nog geen pijnpunten vastgelegd.",
  "klanten.pijnpunt.overstijgend.section":          "Overstijgend (geen koppeling)",
};

const AppConfigContext = createContext(null);

export function AppConfigProvider({ children }) {
  const [config, setConfig]   = useState({});
  const [loading, setLoading] = useState(true);

  const loadConfig = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    // Stap-7 fase-6: tenant-scoped lookup via RPC.
    // Server-side DISTINCT ON kiest per key precies één rij — tenant-override
    // boven globale baseline. Pre-login (anon role) krijgt 0 rijen → frontend
    // valt terug op LABEL_FALLBACKS (zie label/prompt/setting hieronder).
    const { data, error } = await supabase.rpc("get_app_config_for_tenant");

    if (!error && data) {
      const map = {};
      data.forEach(row => { map[row.key] = row; });
      setConfig(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  /**
   * label("app.title") → waarde uit DB, anders hardcoded fallback
   * label("app.title", "Mijn App") → waarde uit DB, anders opgegeven fallback
   */
  const label = useCallback((key, fallback) => {
    const row = config[`label.${key}`];
    if (row?.value && !row.value.startsWith("PLACEHOLDER")) return row.value;
    return fallback ?? LABEL_FALLBACKS[key] ?? key;
  }, [config]);

  /**
   * prompt("magic.system_standard") → volledige prompt-tekst uit DB
   * Geeft null terug als niet gevonden (component valt terug op hardcoded)
   */
  const prompt = useCallback((key) => {
    const row = config[`prompt.${key}`];
    if (row?.value && !row.value.startsWith("PLACEHOLDER")) return row.value;
    return null;
  }, [config]);

  /**
   * setting("autosave.delay_ms", 500) → numerieke instelling
   */
  const setting = useCallback((key, defaultVal) => {
    const row = config[`setting.${key}`];
    if (row?.value) return isNaN(row.value) ? row.value : Number(row.value);
    return defaultVal;
  }, [config]);

  // Alle rijen als array (voor admin UI)
  const allRows = Object.values(config);

  return (
    <AppConfigContext.Provider value={{ label, prompt, setting, allRows, loading, refresh: loadConfig }}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig() {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error("useAppConfig moet binnen AppConfigProvider gebruikt worden");
  return ctx;
}
