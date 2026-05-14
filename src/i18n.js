/**
 * i18n — NL / EN vertaalbestand
 * Gebruik: const { t } = useLang();  t("key")
 */

import { createContext, useContext, useState } from "react";

// ── Vertalingen ───────────────────────────────────────────────────────────────
const TRANSLATIONS = {
  nl: {
    // Blocks
    "block.strategy.title":   "Strategie",
    "block.strategy.sub":     "Missie · Visie · Thema's · KPIs",
    "block.principles.title": "Leidende principes",
    "block.principles.sub":   "Spelregels voor alle pijlers",
    "block.customers.title":  "Klanten & Dienstverlening",
    "block.customers.sub":    "Segmenten · Journeys · Kanalen · Producten",
    "block.processes.title":  "Processen & Organisatie",
    "block.processes.sub":    "Procesmodel · Org-design · Governance",
    "block.people.title":     "Mensen & Competenties",
    "block.people.sub":       "Leiderschap · Skills · Cultuur",
    "block.technology.title": "Informatie & Technologie",
    "block.technology.sub":   "Data · Applicaties · Platformen",
    "block.portfolio.title":  "Verander Portfolio",
    "block.portfolio.sub":    "Initiatieven · Waarde · Complexiteit · Eigenaar",

    // Sub-tabs
    "subtab.current": "As Is",
    "subtab.tobe":    "To-Be",
    "subtab.change":  "Change Actions",
    "subtab.generic": "Generiek",

    // Panel tabs
    "panel.tab.upload":  "1. Upload",
    "panel.tab.extract": "2. Extract",
    "panel.tab.review":  "3. Review",
    "panel.tab.canvas":  "4. Canvas",

    // Upload
    "upload.scanning":       "Document wordt gescand…",
    "upload.scanning.sub":   "Poortwachter controleert relevantie",
    "upload.extracting":     "AI haalt inzichten op…",
    "upload.extracting.sub": "Extractie gestart op basis van scan",
    "upload.cta":            "Klik om een document te uploaden",
    "upload.formats":        "PDF · PPTX · DOCX · TXT",
    "upload.docs.label":     "Geüploade documenten",
    "upload.view.insights":  "Bekijk {n} inzichten →",
    "upload.scan.result":    "Scan resultaat",

    // Extract
    "extract.empty":         "Upload een document om inzichten te extraheren",
    "extract.back":          "← Terug naar upload",
    "extract.pending":       "{n} in behandeling",
    "extract.accepted":      "{n} geaccepteerd",
    "extract.source":        "Bron:",
    "extract.accept":        "✓ Accepteer",
    "extract.reject":        "× Verwerp",
    "extract.go.review":     "Review & bewerk {n} geaccepteerd →",

    // Review
    "review.empty":          "Nog geen geaccepteerde inzichten",
    "review.back":           "← Terug naar Extract",
    "review.subtitle":       "{n} inzicht(en) — bewerk indien nodig",
    "review.all.to.canvas":  "Alles naar canvas →",
    "review.to.canvas":      "✓ Naar canvas",
    "review.delete":         "Verwijder",

    // Canvas
    "canvas.empty.sub":      "{label} — nog leeg",
    "canvas.empty.hint":     "Voeg handmatig toe of push vanuit Review",
    "canvas.add.manual":     "Handmatig toevoegen",
    "canvas.bullets.count":  "Canvas bullets ({n}/7)",
    "canvas.add.manual.flat":"Handmatig toevoegen",
    "canvas.empty.flat":     "Nog geen bullets",
    "canvas.empty.flat.hint":"Accepteer inzichten in de Review tab, of voeg handmatig toe",
    "canvas.placeholder":    "Type bullet point…",
    "canvas.move.to":        "Verplaats naar…",

    // Header
    "header.active.canvas":  "Actief canvas",
    "header.tips":           "Tips",
    "header.consistency":    "Consistency Check",
    "header.subtitle":       "Platform voor strategie tot executie",

    // Canvas menu
    "menu.new.canvas":       "Nieuw canvas",
    "menu.load.example":     "Voorbeeld laden",
    "menu.saved":            "Opgeslagen canvassen",
    "menu.save":             "Huidig canvas opslaan",
    "menu.canvas.name.placeholder": "Canvas naam…",
    "menu.edit.name":        "Naam bewerken",
    "menu.unnamed":          "Naamloos canvas",

    // Progress
    "status.empty":          "Leeg",
    "status.uploaded":       "Geüpload",
    "status.insights":       "Inzichten beschikbaar",
    "status.done":           "Klaar",
    "progress.all.done":     "Alle blokken klaar — Volledige analyse starten",

    // Consistency modal
    "consistency.title":     "Canvas Consistency Check",
    "consistency.overall":   "Overall score:",
    "consistency.per.block": "Per blok",
    "consistency.issues":    "Issues & observaties",

    // Tips modal
    "tips.title":            "Tips & werkwijze",
    "tips.subtitle":         "Tips voor strategie & business-transformatie",
    "tips.general":          "Algemeen",
    "tips.prev":             "← Vorige",
    "tips.next":             "Volgende →",
    "tips.footer":           "",
    "tips.panel.button":     "Tips voor dit blok",

    // Consistency issues
    "check.issue.strategy_portfolio":  "Strategie heeft meerdere thema's maar het veranderprogramma is onderontwikkeld.",
    "check.issue.people_technology":   "Sterke technologieagenda maar Mensen & Competenties is onderontwikkeld — uitvoeringsrisico.",
    "check.issue.principles":          "Leidende principes zijn dun — deze zouden beslissingen in alle 4 pijlers moeten sturen.",
    "check.issue.customers_processes": "Klantambities zijn gedefinieerd, maar het operating model om ze waar te maken ontbreekt.",
    "check.issue.default":             "Controleer of elke richtlijn een strategische keuze direct versterkt.",

    // AI prompt language instruction
    "ai.language":           "Respond in Dutch.",
  },

  en: {
    // Blocks
    "block.strategy.title":   "Strategy",
    "block.strategy.sub":     "Mission · Vision · Themes · KPIs",
    "block.principles.title": "Guiding Principles",
    "block.principles.sub":   "Design rules for all pillars",
    "block.customers.title":  "Customers & Services",
    "block.customers.sub":    "Segments · Journeys · Channels · Products",
    "block.processes.title":  "Processes & Organisation",
    "block.processes.sub":    "Process model · Org design · Governance",
    "block.people.title":     "People & Competencies",
    "block.people.sub":       "Leadership · Skills · Culture",
    "block.technology.title": "Information & Technology",
    "block.technology.sub":   "Data · Applications · Platforms",
    "block.portfolio.title":  "Change Portfolio",
    "block.portfolio.sub":    "Initiatives · Value · Complexity · Owner",

    // Sub-tabs
    "subtab.current": "As Is",
    "subtab.tobe":    "To-Be",
    "subtab.change":  "Change Actions",
    "subtab.generic": "Generic",

    // Panel tabs
    "panel.tab.upload":  "1. Upload",
    "panel.tab.extract": "2. Extract",
    "panel.tab.review":  "3. Review",
    "panel.tab.canvas":  "4. Canvas",

    // Upload
    "upload.scanning":       "Scanning document…",
    "upload.scanning.sub":   "Gatekeeper checking relevance",
    "upload.extracting":     "AI extracting insights…",
    "upload.extracting.sub": "Extraction started based on scan",
    "upload.cta":            "Click to upload a document",
    "upload.formats":        "PDF · PPTX · DOCX · TXT",
    "upload.docs.label":     "Uploaded documents",
    "upload.view.insights":  "View {n} insights →",
    "upload.scan.result":    "Scan result",

    // Extract
    "extract.empty":         "Upload a document to extract insights",
    "extract.back":          "← Back to upload",
    "extract.pending":       "{n} pending",
    "extract.accepted":      "{n} accepted",
    "extract.source":        "Source:",
    "extract.accept":        "✓ Accept",
    "extract.reject":        "× Reject",
    "extract.go.review":     "Review & edit {n} accepted →",

    // Review
    "review.empty":          "No accepted insights yet",
    "review.back":           "← Back to Extract",
    "review.subtitle":       "{n} insight(s) — edit if needed",
    "review.all.to.canvas":  "All to canvas →",
    "review.to.canvas":      "✓ To canvas",
    "review.delete":         "Delete",

    // Canvas
    "canvas.empty.sub":      "{label} — empty",
    "canvas.empty.hint":     "Add manually or push from Review",
    "canvas.add.manual":     "Add manually",
    "canvas.bullets.count":  "Canvas bullets ({n}/7)",
    "canvas.add.manual.flat":"Add manually",
    "canvas.empty.flat":     "No bullets yet",
    "canvas.empty.flat.hint":"Accept insights in the Review tab, or add manually",
    "canvas.placeholder":    "Type bullet point…",
    "canvas.move.to":        "Move to…",

    // Header
    "header.active.canvas":  "Active canvas",
    "header.tips":           "Tips",
    "header.consistency":    "Consistency Check",
    "header.subtitle":       "Platform voor strategie tot executie",

    // Canvas menu
    "menu.new.canvas":       "New canvas",
    "menu.load.example":     "Load example",
    "menu.saved":            "Saved canvases",
    "menu.save":             "Save current canvas",
    "menu.canvas.name.placeholder": "Canvas name…",
    "menu.edit.name":        "Edit name",
    "menu.unnamed":          "Unnamed canvas",

    // Progress
    "status.empty":          "Empty",
    "status.uploaded":       "Uploaded",
    "status.insights":       "Insights pending",
    "status.done":           "Done",
    "progress.all.done":     "All blocks done — Run full analysis",

    // Consistency modal
    "consistency.title":     "Canvas Consistency Check",
    "consistency.overall":   "Overall score:",
    "consistency.per.block": "Per block",
    "consistency.issues":    "Issues & observations",

    // Tips modal
    "tips.title":            "Tips & approach",
    "tips.subtitle":         "Tips for strategy & business transformation",
    "tips.general":          "General",
    "tips.prev":             "← Previous",
    "tips.next":             "Next →",
    "tips.footer":           "",
    "tips.panel.button":     "Tips for this block",

    // Consistency issues
    "check.issue.strategy_portfolio":  "Strategy has multiple themes but the change portfolio is underdeveloped.",
    "check.issue.people_technology":   "Strong technology agenda but People & Competencies is underdeveloped — execution risk.",
    "check.issue.principles":          "Guiding principles are thin — these should constrain decisions in all 4 pillars.",
    "check.issue.customers_processes": "Customer ambitions are set, but the operating model to deliver them is not defined.",
    "check.issue.default":             "Check that each guiding principle directly enforces a strategic choice.",

    // AI prompt language instruction
    "ai.language":           "Respond in English.",
  },
};

// ── Context ───────────────────────────────────────────────────────────────────
const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState("nl");

  const t = (key, vars = {}) => {
    let str = TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.nl[key] ?? key;
    Object.entries(vars).forEach(([k, v]) => { str = str.replace(`{${k}}`, v); });
    return str;
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
