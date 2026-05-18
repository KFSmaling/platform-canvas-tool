/**
 * useVerbeteracties — combineert pattern_suggestions + improvement_intents tot
 * één concept/definitief-flow voor de S4 VerbeteractiesView (RFC-007 §5.2).
 *
 * Mapping (RFC-007 §3.1):
 *   • pattern_suggestion.current_status IN open/edited/accepted/refined → concept
 *   • pattern_suggestion.current_status = rejected                       → deleted (collapse)
 *   • pattern_suggestion.current_status = promoted                       → verborgen
 *   • improvement_intent.status = concept                                → concept
 *   • improvement_intent.status = verstuurd                              → definitief
 *
 * `verstuurd` blijft DB-truth-source voor cross-werkblad-handover naar Roadmap
 * (RFC-003 §6 ongewijzigd). UI toont alleen "Definitief".
 *
 * Hook gebruikt BESTAANDE state — geen nieuwe API-endpoints. Pure UI-laag.
 *
 * Returned shape:
 *   {
 *     conceptEntries,        // array van { ...row, _type: 'suggestion'|'intent', _ui_status: 'concept' }
 *     definitiefEntries,     // array van { ...row, _type: 'intent', _ui_status: 'definitief' }
 *     markedSuggestions,     // pattern_suggestion.current_status='accepted' — collapse "Gemarkeerd"
 *     deletedSuggestions,    // pattern_suggestion.current_status='rejected' — collapse "Verwijderd"
 *     promotedSuggestionIds, // Set<string> van suggestion-ids met 1:1 child-intent
 *     loading, error,
 *     reload(): roept beide bron-reloads aan
 *   }
 *
 * Single source of truth blijft `usePatternSuggestions` + `useIntents` in
 * KlantenWerkblad — deze hook is pure derive-laag.
 */

import { useMemo } from "react";

const CONCEPT_SUGGESTION_STATUSES = new Set(["open", "edited", "accepted", "refined"]);
const MARKED_STATUS  = "accepted";
const DELETED_STATUS = "rejected";

export function useVerbeteracties({
  suggestions,
  intents,
  suggestionsLoading,
  intentsLoading,
  suggestionsError,
  intentsError,
  reloadSuggestions,
  reloadIntents,
}) {
  const loading = (suggestionsLoading || intentsLoading);
  const error   = suggestionsError || intentsError || null;

  const promotedSuggestionIds = useMemo(
    () => new Set((intents || []).map(i => i.source_suggestion_id).filter(Boolean)),
    [intents]
  );

  const conceptEntries = useMemo(() => {
    const fromSuggestions = (suggestions || [])
      .filter(s => CONCEPT_SUGGESTION_STATUSES.has(s.current_status))
      // Verberg suggestions die al een child-intent hebben (RFC §3.1 promoted-pad)
      .filter(s => !promotedSuggestionIds.has(s.id))
      .map(s => ({ ...s, _type: "suggestion", _ui_status: "concept" }));

    const fromIntents = (intents || [])
      .filter(i => i.status === "concept")
      .map(i => ({ ...i, _type: "intent", _ui_status: "concept" }));

    // Sorteer: nieuwste eerst (created_at DESC) — UX-feel: consultant ziet
    // net-toegevoegd werk bovenaan (RFC §5.3 ConceptList-aanbeveling).
    return [...fromSuggestions, ...fromIntents]
      .sort((a, b) => {
        const aTs = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTs = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTs - aTs;
      });
  }, [suggestions, intents, promotedSuggestionIds]);

  const definitiefEntries = useMemo(
    () => (intents || [])
      // 11.U Block 1 (RFC-007-rev2): status='verstuurd' → 'definitief' via migratie.
      .filter(i => i.status === "definitief" || i.status === "verstuurd")
      .map(i => ({ ...i, _type: "intent", _ui_status: "definitief" }))
      .sort((a, b) => {
        // Bouwer-keuze RFC §7 open vraag #1: handover_to_roadmap_at DESC
        // (chronologisch, meest recent definitief eerst). Architect-aanbeveling
        // gevolgd. Motivatie in result-file.
        const aTs = a.handover_to_roadmap_at ? new Date(a.handover_to_roadmap_at).getTime() : 0;
        const bTs = b.handover_to_roadmap_at ? new Date(b.handover_to_roadmap_at).getTime() : 0;
        return bTs - aTs;
      }),
    [intents]
  );

  // "Gemarkeerd"-bucket (accepted) — apart zichtbaar in concept-lijst met
  // visuele highlight, behalve als reeds gepromoot.
  const markedSuggestions = useMemo(
    () => (suggestions || [])
      .filter(s => s.current_status === MARKED_STATUS)
      .filter(s => !promotedSuggestionIds.has(s.id)),
    [suggestions, promotedSuggestionIds]
  );

  const deletedSuggestions = useMemo(
    () => (suggestions || []).filter(s => s.current_status === DELETED_STATUS),
    [suggestions]
  );

  function reload() {
    reloadSuggestions?.();
    reloadIntents?.();
  }

  return {
    conceptEntries,
    definitiefEntries,
    markedSuggestions,
    deletedSuggestions,
    promotedSuggestionIds,
    loading,
    error,
    reload,
  };
}

export default useVerbeteracties;
