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
  // Stap 11.K.2 F16 — canonical-delete-knoppen + inline-bevestigingsdialog
  "klanten.knop.item.verwijderen":         "Verwijderen",
  "klanten.knop.pijnpunt.verwijderen":     "Verwijderen",
  "klanten.modal.delete.confirm.titel":    "Permanent verwijderen?",
  "klanten.modal.delete.confirm.tekst":    "Dit kan niet ongedaan gemaakt worden.",
  "klanten.modal.delete.confirm.ja":       "Verwijder definitief",
  "klanten.modal.delete.confirm.nee":      "Annuleer",
  "klanten.rapport.titel":            "Klanten & Dienstverlening — overzicht",
  "klanten.rapport.section.samenvatting": "Samenvatting",
  "klanten.rapport.section.huidig":   "Huidige situatie",
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
  // Stap 11.G — Fase 3 Analyse + AI (canvas-niveau-affordances)
  "klanten.analyse.intro":                          "AI doet een eerste pas met patroon-suggesties. Consultant blijft eigenaar — accept, verfijn, of wuif weg.",
  "klanten.analyse.knop.cluster":                   "Cluster zoeken",
  "klanten.analyse.knop.cluster.helper":            "Groepen pijnpunten met gemeenschappelijke oorzaak",
  "klanten.analyse.knop.paradox":                   "Paradox zoeken",
  "klanten.analyse.knop.paradox.helper":            "Pijnpunten die elkaar tegenspreken",
  "klanten.analyse.knop.positionering":             "Positionering toetsen",
  "klanten.analyse.knop.positionering.helper":      "Wie zijn we voor wie — zwakke plekken",
  "klanten.analyse.knop.overstijgend":              "Overstijgend zoeken",
  "klanten.analyse.knop.overstijgend.helper":       "Capabilities die het hele werkblad raken",
  "klanten.analyse.loading":                        "AI denkt na…",
  "klanten.analyse.error.generic":                  "Genereren mislukt",
  "klanten.analyse.error.parse":                    "AI-output kon niet gelezen worden — probeer opnieuw",
  "klanten.analyse.error.retry":                    "Opnieuw",
  "klanten.analyse.empty.geen_data":                "Voeg eerst pijnpunten toe in fase 2 voordat je analyse draait.",
  "klanten.analyse.counter.geaccepteerd":           "geaccepteerd",
  "klanten.analyse.counter.weggewuifd":             "weggewuifd",
  "klanten.analyse.counter.separator":              "·",
  "klanten.analyse.lijst.titel":                    "Suggesties",
  "klanten.analyse.lijst.leeg":                     "Nog geen suggesties — klik een AI-knop hierboven of voeg een eigen patroon toe.",
  "klanten.analyse.type.cluster":                   "Cluster",
  "klanten.analyse.type.paradox":                   "Paradox",
  "klanten.analyse.type.positionering":             "Positionering",
  "klanten.analyse.type.overstijgend":              "Overstijgend",
  "klanten.analyse.type.eigen":                     "Eigen",
  // Stap 11.G.2 F5 — helper-tekst per pattern-type + intro
  "klanten.analyse.helper.cluster":                 "Groep pijnpunten die samen wijzen op een capability- of positionering-vraagstuk",
  "klanten.analyse.helper.paradox":                 "Pijnpunten die elkaar conceptueel tegenspreken of waar oplossing van A juist B verergert",
  "klanten.analyse.helper.positionering":           "Propositie of segment waar pijnpunten wijzen op onduidelijke plek t.o.v. concurrenten",
  "klanten.analyse.helper.overstijgend":            "Pijnpunten zonder specifieke koppeling die het hele werkblad raken",
  "klanten.analyse.helper.intro":                   "AI doet een eerste pas op je pijnpunten. Per suggestie kies je: markeer als richting, bewerk (eigen tekst), graaf dieper (AI verfijnt), of verwijder.",
  "klanten.analyse.badge.verfijnd":                 "verfijnd",
  // Stap 11.G.3 F9 — rebrand naar consultant-vriendelijke terminologie
  // (audit-laag intact, alleen UI-tekst gewijzigd)
  "klanten.analyse.actie.accept":                   "Markeer als richting",
  "klanten.analyse.actie.refine.edit":              "Bewerk",
  "klanten.analyse.actie.refine.deeper":            "Verfijn — graaf dieper",
  "klanten.analyse.actie.reject":                   "Verwijder",
  "klanten.analyse.accept.tooltip.fase4":           "nog te promoten in fase 4 (verbeterrichtingen) — komt later",
  // Stap 11.G.3 F8 — collapse-secties Gemarkeerd + Verwijderd
  "klanten.analyse.gemarkeerd.titel":               "Gemarkeerd voor verbeterrichtingen",
  "klanten.analyse.gemarkeerd.leeg":                "Nog niets gemarkeerd",
  "klanten.analyse.gemarkeerd.terug":               "Terug naar voorraad",
  "klanten.analyse.verwijderd.titel":               "Verwijderd",
  "klanten.analyse.verwijderd.leeg":                "Niets verwijderd",
  "klanten.analyse.verwijderd.herstel":             "Herstellen",
  "klanten.analyse.vanuit.label":                   "Vanuit:",
  "klanten.analyse.modal.edit.titel":               "Suggestie bewerken",
  "klanten.analyse.modal.edit.tekst.label":         "Tekst",
  "klanten.analyse.modal.edit.origineel.toggle":    "originele AI-tekst",
  "klanten.analyse.modal.edit.opslaan":             "Opslaan",
  "klanten.analyse.modal.edit.annuleer":            "Annuleren",
  "klanten.analyse.modal.deeper.titel":             "Wat wil je dieper laten graven?",
  "klanten.analyse.modal.deeper.placeholder":       "bijv. specifiek voor SME-segment",
  "klanten.analyse.modal.deeper.helper":            "AI gebruikt deze focus om een verfijnde suggestie te genereren",
  "klanten.analyse.modal.deeper.submit":            "Genereer verfijning",
  "klanten.analyse.knop.eigen_patroon":             "+ eigen patroon",
  "klanten.analyse.modal.eigen.titel":              "Eigen patroon toevoegen",
  "klanten.analyse.modal.eigen.type.label":         "Type",
  "klanten.analyse.modal.eigen.tekst.label":        "Beschrijving",
  "klanten.analyse.modal.eigen.tekst.placeholder":  "Beschrijf het patroon dat je ziet (markdown ondersteund)",
  "klanten.analyse.modal.eigen.vanuit.label":       "Vanuit (optioneel)",
  "klanten.analyse.modal.eigen.vanuit.helper":      "Welke pijnpunten of items onderbouwen dit patroon?",
  "klanten.analyse.modal.eigen.opslaan":            "Toevoegen",
  "klanten.rapport.section.patronen":               "Geaccepteerde patronen",
  "klanten.rapport.patronen.leeg":                  "Nog geen geaccepteerde patronen — accepteer suggesties in fase 3 (Analyse).",
  // Stap 11.G Vervolg-sessie B — RapportView AI-sectie + toggle
  "klanten.rapport.toggle.disabled":                "Geen geaccepteerde patronen — accepteer er minstens één",
  "klanten.rapport.toggle.uit":                     "Klik om AI-advies uit print te verwijderen",
  "klanten.rapport.toggle.aan":                     "Klik om AI-advies toe te voegen aan print",
  "klanten.rapport.toggle.label.aan":               "Advies in print ✓",
  "klanten.rapport.toggle.label.uit":               "Advies in print",
  "klanten.rapport.patronen.uit":                   "AI-advies staat uit voor deze print — klik 'Advies in print' bovenin om te tonen.",
  "klanten.rapport.patronen.meer":                  "+ N meer geaccepteerd, niet getoond in deze print-samenvatting.",
  // Stap 11.H — Fase 4 Verbeterrichtingen. Nieuwe algemene actie-keys
  // (Optie 2 uit RFC-002 RP1 open vraag #11) — herbruikbaar over werkbladen
  // heen. Deprecatie van `klanten.analyse.actie.*` blijft achter.
  "klanten.actie.bewerk":                            "Bewerk",
  "klanten.actie.verwijder":                         "Verwijder",
  "klanten.actie.promote":                           "Promote naar verbeterrichting",
  // Stap 11.K F13 — werkblad-onderdeel-prefix voor context-specifieke acties.
  // `klanten.actie.markeer/.terugtrekken` zijn 11 mei gerenamed naar
  // `verbeterrichting.actie.*` (intent-context). Nieuwe `dossier.actie.*` voor
  // draft-acceptance. Generieke bewerk/verwijder blijven context-onafhankelijk.
  "klanten.verbeterrichting.actie.markeer":          "Markeer als in roadmap",
  "klanten.verbeterrichting.actie.terugtrekken":     "Haal uit roadmap",
  "klanten.dossier.actie.markeer":                   "Markeer als richting",
  "klanten.dossier.actie.bewerk":                    "Bewerk",
  "klanten.dossier.actie.verwijder":                 "Verwijder",
  "klanten.dossier.items_extract":                   "Items vanuit dossier",
  "klanten.dossier.fields_fill":                     "Velden invullen vanuit dossier",
  "klanten.dossier.pain_points_extract":             "Pijnpunten extraheren vanuit dossier",
  "klanten.dossier.draft_badge":                     "dossier-suggestie",
  "klanten.dossier.disabled_no_uploads":             "Upload eerst documenten",
  "klanten.dossier.disabled_no_items":               "Voeg eerst items toe",
  "klanten.dossier.disabled_processing":             "Documenten worden nog verwerkt",
  "klanten.verbeterrichting.titel":                  "Verbeterrichtingen",
  "klanten.verbeterrichting.intro":                  "Verscherp geaccepteerde patronen tot intent. Verstuur naar Roadmap voor concrete acties, eigenaars en planning.",
  "klanten.verbeterrichting.counter.concept":        "concept",
  "klanten.verbeterrichting.counter.verstuurd":      "in roadmap",
  "klanten.verbeterrichting.counter.separator":      "·",
  "klanten.verbeterrichting.lijst.leeg":             "Nog geen verbeterrichtingen — promoot een gemarkeerd patroon vanuit fase 3 of voeg een eigen richting toe.",
  "klanten.verbeterrichting.knop.toevoegen":         "+ verbeterrichting toevoegen",
  "klanten.verbeterrichting.knop.opslaan":           "Opslaan",
  "klanten.verbeterrichting.knop.annuleren":         "Annuleren",
  "klanten.verbeterrichting.status.concept":         "concept",
  "klanten.verbeterrichting.status.verstuurd":       "in roadmap",
  "klanten.verbeterrichting.modal.create.titel":     "Nieuwe verbeterrichting",
  "klanten.verbeterrichting.modal.edit.titel":       "Verbeterrichting bewerken",
  "klanten.verbeterrichting.veld.titel.label":       "Titel",
  "klanten.verbeterrichting.veld.titel.placeholder": "Korte titel (\"SME-bediening structureel versterken\")",
  "klanten.verbeterrichting.veld.intent.label":      "Beschrijving",
  "klanten.verbeterrichting.veld.intent.placeholder":"Verscherp het patroon tot een concrete verbeterrichting. Wat moet er gebeuren en waarom?",
  "klanten.verbeterrichting.veld.vanuit.label":      "Vanuit",
  "klanten.verbeterrichting.veld.vanuit.helper":     "Verwijst naar bron-patronen of context — automatisch gevuld bij promote.",
  "klanten.verbeterrichting.error.titel_leeg":       "Titel is verplicht (1-100 tekens)",
  "klanten.verbeterrichting.error.intent_leeg":      "Beschrijving is verplicht (minimaal 50 tekens)",
  "klanten.verbeterrichting.error.intent_te_lang":   "Beschrijving overschrijdt 2000 tekens",
  "klanten.verbeterrichting.promote.titel":          "Promote naar verbeterrichting",
  "klanten.verbeterrichting.promote.intro":          "Verscherp dit gemarkeerde patroon tot een concrete verbeterrichting. Title en beschrijving zijn vooringevuld — bewerk waar nodig.",
  "klanten.verbeterrichting.handover.confirm":       "Roadmap-werkblad is nog niet beschikbaar — actie wordt vastgelegd zodat hij later kan worden opgepakt. Doorgaan?",
  "klanten.verbeterrichting.handover.datum":         "in roadmap sinds",
  "klanten.verbeterrichting.handover.tooltip":       "Markeer deze richting als in roadmap (stub — Roadmap-werkblad volgt)",
  "klanten.rapport.section.verbeterrichtingen":      "Verbeterrichtingen",
  "klanten.rapport.verbeterrichtingen.leeg":         "Nog geen verbeterrichtingen vastgelegd — werkblad zit nog in inventarisatie/analyse-fase.",
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
