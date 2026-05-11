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
  // Klantreis BLIJFT minimal-stub — wordt uitgewerkt in 11.I.2.
  klantreis: [
    { key: "stap_type", labelKey: "klanten.veld.klantreis.stap_type", fallback: "Stap-type", type: "text" },
  ],
};

export function getSchemaFor(archetype) {
  return ARCHETYPE_SCHEMAS[archetype] || [];
}
