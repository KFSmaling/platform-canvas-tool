/**
 * _archetypes.js — gedeelde archetype-schema-definities + jsonb-validatie
 *
 * Bron: RFC-001 §2.2.1 (archetype_data jsonb-keys per archetype).
 * Gebruikt door api/klanten/items.js voor input-validatie en door
 * src/features/klanten/archetypeSchemas.js voor frontend-formulieren.
 *
 * Server- en client-side dezelfde lijst; bij wijziging beide bijwerken.
 */

const ARCHETYPES = [
  'regio', 'klantsegment', 'propositie', 'kanaal',
  'behoefte', 'merk', 'gedragspatroon', 'klantreis', 'anders',
];

// Per archetype: toegestane keys binnen archetype_data jsonb.
// MVP-scope = drie eerste archetypes; rest is voorbereiding voor latere fases.
const ARCHETYPE_FIELDS = {
  klantsegment:  ['omvang', 'strategisch_belang', 'karakteristieken', 'behoeften'],
  propositie:    ['differentiatie', 'prijsstelling', 'levensfase', 'concurrentiepositie'],
  kanaal:        ['type', 'bereik', 'ervaring', 'economie'],
  regio:         ['geografie', 'marktgrootte', 'lokale_kenmerken'],
  behoefte:      ['job_to_be_done', 'context', 'bestaande_oplossingen', 'frustraties'],
  merk:          ['positionering', 'belofte', 'doelgroep', 'relatie_tot_andere_merken'],
  gedragspatroon:['intensiteit', 'loyaliteit', 'koopgedrag', 'digitale_volwassenheid'],
  // Stap 11.I.2 — klantreis volledig uitgewerkt (Scope A). Vervangt
  // RFC-001-preliminary-velden (klant_actie/aanbieder_actie/friction_indicators)
  // door de 12-veld-lijst uit Kees-input §8.4 + 80/20-denkdwang.
  // Server-side validatie alleen op key-allow-list; type-coercion blijft aan
  // jsonb over (MVP-keuze, zie instructie discipline-noten).
  klantreis:     [
    'stap_type', 'customer_goal', 'emotions', 'touchpoints', 'kpis',
    'is_moment_of_truth', 'is_silent_period', 'weight_multiplier',
    'silent_period_risk', 'regulatoire_context', 'insight', 'dmu',
  ],
  anders:        ['vrije_velden'], // jsonb met max 4 keys (RFC §2.2.1)
};

/**
 * Valideer archetype_data jsonb tegen het schema voor het opgegeven archetype.
 * Onbekende keys → throw met 400-error-message. Lege strings zijn toegestaan
 * (consistent met principe 1: items mogen onaf zijn).
 *
 * @returns {{ ok: boolean, error?: string }}
 */
function validateArchetypeData(archetype, archetypeData) {
  if (!ARCHETYPES.includes(archetype)) {
    return { ok: false, error: `Onbekend archetype: ${archetype}` };
  }
  if (archetypeData == null) {
    return { ok: true };
  }
  if (typeof archetypeData !== 'object' || Array.isArray(archetypeData)) {
    return { ok: false, error: 'archetype_data moet een object zijn' };
  }

  const allowed = ARCHETYPE_FIELDS[archetype] || [];
  const provided = Object.keys(archetypeData);
  const unknown = provided.filter(k => !allowed.includes(k));

  if (unknown.length > 0) {
    return {
      ok: false,
      error: `Onbekende keys voor archetype "${archetype}": ${unknown.join(', ')}. Toegestaan: ${allowed.join(', ')}`,
    };
  }

  // Voor archetype 'anders': max 4 keys binnen vrije_velden-jsonb.
  if (archetype === 'anders' && archetypeData.vrije_velden != null) {
    const vv = archetypeData.vrije_velden;
    if (typeof vv !== 'object' || Array.isArray(vv)) {
      return { ok: false, error: '"anders".vrije_velden moet een object zijn' };
    }
    if (Object.keys(vv).length > 4) {
      return { ok: false, error: '"anders".vrije_velden mag maximaal 4 keys hebben (RFC-001 principe 5)' };
    }
  }

  return { ok: true };
}

module.exports = { ARCHETYPES, ARCHETYPE_FIELDS, validateArchetypeData };
