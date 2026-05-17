/**
 * strategieRapportageConfig.js — werkblad-specifieke config voor OnepagerBuilder.
 *
 * RFC-008 §C — Strategie-specifieke injectie van vasteBlokken / modelLib /
 * dataResolver in shared/OnepagerBuilder. Andere werkbladen
 * (Klanten/Processen/Richtlijnen) krijgen hun eigen *RapportageConfig.js
 * bij replicatie (RFC-008 §D).
 *
 * Block 3 scope:
 *   - vasteBlokken: 3 (Identiteits-band / KPI-strip / Strategische thema's)
 *   - modelLib: 3 groepen / 8 modellen (alleen SWOT + Kernwaarden conditioneel
 *     enabled; rest disabled met "komt in fase 2"-reason — designer-spec)
 *   - dataResolver: completeness-check per blok-id (designer-spec
 *     rapportage-spec.md §3 regel 112-119)
 *
 * Block 4 vult dataResolver uit met echte data-mapping per model + payload-shape
 * voor StrategyOnePager v2-render.
 *
 * Labels: model-namen + disabled-reasons komen uit DB via appLabel (zie
 * migratie `20260518000400_seed_labels_onepager_builder_rfc008_11s_block3.sql`).
 * Fallback-strings in deze file zijn pragmatisch; DB-waarden winnen.
 */

/**
 * Bouwt de OnepagerBuilder-config voor Strategie-werkblad.
 *
 * @param {object} args
 * @param {object} args.strategyCore — { missie, visie, ambitie, kernwaarden[], samenvatting }
 * @param {Array}  args.themas       — strategic_themes met ksf_kpi[]
 * @param {Array}  args.analysisItems — analysis_items array
 * @param {function} args.appLabel   — config-resolver (k, fb) => string
 * @returns {object} config { vasteBlokken, modelLib, dataResolver }
 */
export function buildStrategieRapportageConfig({
  strategyCore = {},
  themas = [],
  analysisItems = [],
  appLabel,
}) {
  const lbl = (k, fb) => (appLabel ? appLabel(k, fb) : fb);

  const kernwaardenCount = Array.isArray(strategyCore?.kernwaarden) ? strategyCore.kernwaarden.length : 0;
  const themasCount      = Array.isArray(themas) ? themas.length : 0;
  const analysisCount    = Array.isArray(analysisItems) ? analysisItems.length : 0;

  // KPI-strip telt KPI's verdeeld over alle thema's (designer-spec: top 4
  // auto-pickt — Block 4 implementeert prioritering, Block 3 toont totaal).
  const kpiCount = (Array.isArray(themas) ? themas : []).reduce((sum, t) => {
    const ksfKpi = Array.isArray(t?.ksf_kpi) ? t.ksf_kpi : [];
    return sum + ksfKpi.filter(x => x.type === "kpi").length;
  }, 0);

  return {
    // ── Vaste blokken (RFC-008 §11 rij 12) ────────────────────────────────
    vasteBlokken: [
      {
        id: "identiteit",
        label: lbl("strategie.onepager.vast.identiteit.label", "Identiteits-band"),
        sub_label: lbl("strategie.onepager.vast.identiteit.sub", "Missie · Visie · Ambitie · Kernwaarden"),
      },
      {
        id: "kpi-strip",
        label: lbl("strategie.onepager.vast.kpi.label", "KPI-strip"),
        sub_label: lbl("strategie.onepager.vast.kpi.sub", "Top 4 KPI's auto-geselecteerd"),
      },
      {
        id: "themas",
        label: lbl("strategie.onepager.vast.themas.label", "Strategische thema's"),
        sub_label: `${themasCount} ${lbl("strategie.onepager.vast.themas.sub_suffix", "thema's")}`,
      },
    ],

    // ── Configureerbare modellen ──────────────────────────────────────────
    modelLib: [
      {
        id: "strategische-analyse",
        label: lbl("strategie.onepager.group.analyse.label", "Strategische analyse"),
        models: [
          {
            id: "swot",
            label: lbl("strategie.model.swot", "SWOT-analyse"),
            enabled: analysisCount > 0,
            disabled_reason: analysisCount === 0
              ? lbl("strategie.model.swot.disabled_reason", "Vul de SWOT-tabbladen in onder Strategie → Analyse.")
              : null,
          },
          {
            id: "porter-5-forces",
            label: lbl("strategie.model.porter", "Porter 5 Forces"),
            enabled: false,
            disabled_reason: lbl("strategie.model.porter.disabled_reason", "Geen sector-analyse-velden in werkblad — komt in fase 2"),
          },
          {
            id: "pestel",
            label: lbl("strategie.model.pestel", "PESTEL"),
            enabled: false,
            disabled_reason: lbl("strategie.model.pestel.disabled_reason", "Geen macro-analyse-velden in werkblad — komt in fase 2"),
          },
          {
            id: "mckinsey-7s",
            label: lbl("strategie.model.mckinsey7s", "McKinsey 7S"),
            enabled: false,
            disabled_reason: lbl("strategie.model.mckinsey7s.disabled_reason", "Geen interne-factoren-velden in werkblad — komt in fase 2"),
          },
        ],
      },
      {
        id: "positionering",
        label: lbl("strategie.onepager.group.positionering.label", "Positionering"),
        models: [
          {
            id: "ansoff",
            label: lbl("strategie.model.ansoff", "Ansoff-matrix"),
            enabled: false,
            disabled_reason: lbl("strategie.model.ansoff.disabled_reason", "Geen groeirichting-velden in werkblad — komt in fase 2"),
          },
          {
            id: "value-chain",
            label: lbl("strategie.model.valuechain", "Value Chain"),
            enabled: false,
            disabled_reason: lbl("strategie.model.valuechain.disabled_reason", "Geen waardeketen-velden in werkblad — komt in fase 2"),
          },
        ],
      },
      {
        id: "doelen-verschuiving",
        label: lbl("strategie.onepager.group.doelen.label", "Doelen & verschuiving"),
        models: [
          {
            id: "van-naar",
            label: lbl("strategie.model.vannaar", "Van → Naar tabel"),
            enabled: false,
            disabled_reason: lbl("strategie.model.vannaar.disabled_reason", "Geen verschuiving-velden in werkblad — komt in fase 2"),
          },
          {
            id: "kernwaarden",
            label: lbl("strategie.model.kernwaardenbord", "Kernwaarden-bord"),
            enabled: kernwaardenCount > 0,
            disabled_reason: kernwaardenCount === 0
              ? lbl("strategie.model.kernwaardenbord.disabled_reason", "Voeg eerst minstens één kernwaarde toe onder Identiteit.")
              : null,
          },
        ],
      },
    ],

    // ── Data-completeness fallback (designer rapportage-spec.md regel 112-119) ─
    // Returnt per blok-id { ready: bool, completeness_msg?: string, text?: ... }
    // Block 3: completeness-check; Block 4 vult `text`/`data`-payload per blok.
    dataResolver: (blokId) => {
      switch (blokId) {
        case "identiteit": {
          const ready = !!(strategyCore?.missie && strategyCore?.visie && strategyCore?.ambitie);
          return {
            ready,
            completeness_msg: ready ? null : lbl(
              "onepager.preview.fallback.identiteit",
              "Vul Missie, Visie en Ambitie eerst in onder Strategie-werkblad → Identiteit."
            ),
          };
        }
        case "kpi-strip": {
          const ready = kpiCount >= 4;
          return {
            ready,
            completeness_msg: ready ? null : lbl(
              "onepager.preview.fallback.kpi",
              "Voeg minstens 4 KPI's toe verdeeld over de thema's voor een complete strip."
            ),
          };
        }
        case "themas": {
          const ready = themasCount > 0;
          return {
            ready,
            completeness_msg: ready ? null : lbl(
              "onepager.preview.fallback.themas",
              "Geen strategische thema's gedefinieerd — voeg eerst minstens één thema toe."
            ),
          };
        }
        case "samenvatting": {
          const ready = !!strategyCore?.samenvatting;
          return {
            ready,
            text: ready ? strategyCore.samenvatting : null,
            completeness_msg: ready ? null : lbl(
              "onepager.preview.fallback.samenvatting",
              "Strategische samenvatting nog niet gegenereerd. → Genereer in werkblad."
            ),
          };
        }
        default:
          return { ready: true };
      }
    },
  };
}
