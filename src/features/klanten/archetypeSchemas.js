/**
 * archetypeSchemas.js — frontend-spiegel van api/klanten/_archetypes.js
 *
 * Bron: RFC-001 §2.2.1.
 * Voor MVP-scope (klantsegment / propositie / kanaal) zijn de velden
 * volledig gevuld met label-keys. Voor de overige zes archetypes is het
 * schema aanwezig zodat ItemModal ze kan renderen wanneer ze later worden
 * geactiveerd.
 *
 * Bij wijziging: ook api/klanten/_archetypes.js bijwerken (server- en
 * client-side validatie moeten matchen).
 */

export const ARCHETYPES = [
  "regio", "klantsegment", "propositie", "kanaal",
  "behoefte", "merk", "gedragspatroon", "klantreis", "anders",
];

// Per archetype: array van { key, labelKey, type } voor formulier-render.
// labelKey = AppConfig-key voor i18n-vrije label-tekst.
// type = "text" of "textarea" — voor MVP allemaal text/textarea (geen
//        gestructureerde validatie, principe 1 "items mogen onaf zijn").
export const ARCHETYPE_SCHEMAS = {
  klantsegment: [
    { key: "omvang",             labelKey: "klanten.veld.klantsegment.omvang",             fallback: "Omvang",             type: "text" },
    { key: "strategisch_belang", labelKey: "klanten.veld.klantsegment.strategisch_belang", fallback: "Strategisch belang", type: "text" },
    { key: "karakteristieken",   labelKey: "klanten.veld.klantsegment.karakteristieken",   fallback: "Karakteristieken",   type: "textarea" },
    { key: "behoeften",          labelKey: "klanten.veld.klantsegment.behoeften",          fallback: "Behoeften",          type: "textarea" },
  ],
  propositie: [
    { key: "differentiatie",      labelKey: "klanten.veld.propositie.differentiatie",      fallback: "Differentiatie",      type: "textarea" },
    { key: "prijsstelling",       labelKey: "klanten.veld.propositie.prijsstelling",       fallback: "Prijsstelling",       type: "text" },
    { key: "levensfase",          labelKey: "klanten.veld.propositie.levensfase",          fallback: "Levensfase",          type: "text" },
    { key: "concurrentiepositie", labelKey: "klanten.veld.propositie.concurrentiepositie", fallback: "Concurrentiepositie", type: "textarea" },
  ],
  kanaal: [
    { key: "type",     labelKey: "klanten.veld.kanaal.type",     fallback: "Type",     type: "text" },
    { key: "bereik",   labelKey: "klanten.veld.kanaal.bereik",   fallback: "Bereik",   type: "textarea" },
    { key: "ervaring", labelKey: "klanten.veld.kanaal.ervaring", fallback: "Ervaring", type: "textarea" },
    { key: "economie", labelKey: "klanten.veld.kanaal.economie", fallback: "Economie", type: "textarea" },
  ],
  // Stap 11.I.1 — 5 lichte archetypes uitgewerkt. Klantreis blijft minimal-
  // stub (komt 11.I.2 met is_ordered-UI + DMU + insurance-overlay).
  // Veld-volgorde: betekenisvol (RFC-001 §2.2.1) i.p.v. alfabetisch.
  regio: [
    { key: "geografie",        labelKey: "klanten.veld.regio.geografie",        fallback: "Geografie",        type: "text" },
    { key: "marktgrootte",     labelKey: "klanten.veld.regio.marktgrootte",     fallback: "Marktgrootte",     type: "text" },
    { key: "lokale_kenmerken", labelKey: "klanten.veld.regio.lokale_kenmerken", fallback: "Lokale kenmerken", type: "textarea" },
  ],
  // behoefte = jobs-to-be-done-frame (ADR-003 §C). job_to_be_done eerst,
  // dan context (waarin/wanneer), dan bestaande oplossingen, dan frustraties.
  behoefte: [
    { key: "job_to_be_done",        labelKey: "klanten.veld.behoefte.job_to_be_done",        fallback: "Job to be done",        type: "textarea" },
    { key: "context",               labelKey: "klanten.veld.behoefte.context",               fallback: "Context",               type: "textarea" },
    { key: "bestaande_oplossingen", labelKey: "klanten.veld.behoefte.bestaande_oplossingen", fallback: "Bestaande oplossingen", type: "text" },
    { key: "frustraties",           labelKey: "klanten.veld.behoefte.frustraties",           fallback: "Frustraties",           type: "textarea" },
  ],
  merk: [
    { key: "positionering",             labelKey: "klanten.veld.merk.positionering",             fallback: "Positionering",             type: "textarea" },
    { key: "belofte",                   labelKey: "klanten.veld.merk.belofte",                   fallback: "Belofte",                   type: "textarea" },
    { key: "doelgroep",                 labelKey: "klanten.veld.merk.doelgroep",                 fallback: "Doelgroep",                 type: "text" },
    { key: "relatie_tot_andere_merken", labelKey: "klanten.veld.merk.relatie_tot_andere_merken", fallback: "Relatie tot andere merken", type: "textarea" },
  ],
  gedragspatroon: [
    { key: "intensiteit",            labelKey: "klanten.veld.gedragspatroon.intensiteit",            fallback: "Intensiteit",            type: "text" },
    { key: "loyaliteit",             labelKey: "klanten.veld.gedragspatroon.loyaliteit",             fallback: "Loyaliteit",             type: "text" },
    { key: "koopgedrag",             labelKey: "klanten.veld.gedragspatroon.koopgedrag",             fallback: "Koopgedrag",             type: "textarea" },
    { key: "digitale_volwassenheid", labelKey: "klanten.veld.gedragspatroon.digitale_volwassenheid", fallback: "Digitale volwassenheid", type: "text" },
  ],
  // Stap 11.I.1: `anders.vrije_velden` jsonb met max 4 keys. UI rendert
  // 4 key+value-paren-formulier via CustomPairsField. Save filtert lege
  // paren; server-validatie blokkeert >4 keys (RFC-001 §2.2.1 + _archetypes.js).
  anders: [
    { key: "vrije_velden", labelKey: "klanten.veld.anders.vrije_velden", fallback: "Eigen velden (max 4)", type: "custom_pairs" },
  ],
  // Stap 11.I.2 — klantreis Scope A volledig uitgewerkt. 12 velden in 3
  // visuele blokken (Wat / Hoe / Strategisch). 80/20-denkdwang = MoT +
  // Silent Period + weight_multiplier (asymmetrie-erkenning) — UI rendert
  // deze drie in een eigen "Strategische weging"-blok met visual emphasis.
  //
  // Schema-properties (uitbreidingen op base { key, labelKey, fallback, type }):
  //   - enumKey:        voor type=dropdown — app_config-key met jsonb-array van opties
  //   - conditionalOn:  veld-key; render alleen wanneer archetypeData[that] === true
  //   - denkdwang:      "asymmetrie" | "trade-off" | "onderscheiding" | "intentionaliteit"
  //                     (markeert design-principe-veld voor visual emphasis)
  //   - visualEmphasis: "prominent" → ItemModal-renderer past extra styling toe
  //   - defaultValue:   initial waarde bij create-mode
  //   - helperKey:      app_config-key met uitleg-tekst onder veld-label
  klantreis: [
    // ── Wat — kern-identiteit van de stage ──────────────────────────────────
    { key: "stap_type",     labelKey: "klanten.veld.klantreis.stap_type",     fallback: "Stap-type",          type: "dropdown", enumKey: "enum.klanten.klantreis.stap_type", enumLabelPrefix: "klanten.klantreis.stap_type." },
    { key: "customer_goal", labelKey: "klanten.veld.klantreis.customer_goal", fallback: "Doel van de klant", type: "textarea" },
    // ── Hoe — touchpoints, betrokkenen, signalen ────────────────────────────
    { key: "touchpoints", labelKey: "klanten.veld.klantreis.touchpoints", fallback: "Touchpoints",                 type: "tag_list" },
    { key: "dmu",         labelKey: "klanten.veld.klantreis.dmu",         fallback: "DMU (Decision Making Unit)", type: "tag_list", helperKey: "klanten.veld.klantreis.dmu.helper" },
    { key: "emotions",    labelKey: "klanten.veld.klantreis.emotions",    fallback: "Klant-emoties",               type: "tag_list" },
    { key: "kpis",        labelKey: "klanten.veld.klantreis.kpis",        fallback: "KPI's",                       type: "tag_list" },
    // ── Strategisch — 80/20-denkdwang asymmetrie + insight ──────────────────
    { key: "is_moment_of_truth", labelKey: "klanten.veld.klantreis.is_moment_of_truth", fallback: "Moment of Truth?", type: "boolean", denkdwang: "asymmetrie", visualEmphasis: "prominent", group: "strategische_weging" },
    { key: "is_silent_period",   labelKey: "klanten.veld.klantreis.is_silent_period",   fallback: "Silent period?",   type: "boolean", denkdwang: "asymmetrie", visualEmphasis: "prominent", group: "strategische_weging" },
    { key: "weight_multiplier",  labelKey: "klanten.veld.klantreis.weight_multiplier",  fallback: "Weging (1.0-3.0)", type: "numeric", defaultValue: 1.0, step: 0.1, min: 0.5, max: 5.0, helperKey: "klanten.veld.klantreis.weight_multiplier.helper", group: "strategische_weging" },
    { key: "silent_period_risk",  labelKey: "klanten.veld.klantreis.silent_period_risk",  fallback: "Risico in silent period",                  type: "textarea", conditionalOn: "is_silent_period" },
    { key: "regulatoire_context", labelKey: "klanten.veld.klantreis.regulatoire_context", fallback: "Regulatoire context (Wft/IDD/zorgplicht)", type: "textarea" },
    { key: "insight",             labelKey: "klanten.veld.klantreis.insight",             fallback: "Strategisch inzicht",                       type: "textarea" },
  ],
};

export function getSchemaFor(archetype) {
  return ARCHETYPE_SCHEMAS[archetype] || [];
}
