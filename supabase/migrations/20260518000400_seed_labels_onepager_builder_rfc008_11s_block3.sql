-- RFC-008 §9 — labels voor OnepagerBuilder + ModelLibrary + A4Preview
-- + strategieRapportageConfig (Strategie-specifieke model-namen + disabled-reasons)
-- 11.S Block 3. tenant_overridable=false (generieke UI, analoog Block 1+2).
-- 47 nieuwe keys totaal.

INSERT INTO app_config (key, category, description, value, tenant_id, tenant_overridable) VALUES
  -- OnepagerBuilder header
  ('label.onepager.builder.header.back',       'label', 'OnepagerBuilder header — terug-knop', '← terug naar Rapportage', NULL, false),
  ('label.onepager.builder.header.titel',      'label', 'OnepagerBuilder header — titel midden', 'One-pager builder', NULL, false),
  ('label.onepager.builder.action.print',      'label', 'OnepagerBuilder Print/PDF-knop', 'Print / PDF', NULL, false),
  ('label.onepager.builder.action.print.tooltip', 'label', 'OnepagerBuilder Print-knop tooltip', 'Print of opslaan als PDF (komt in Block 4)', NULL, false),
  -- AI-toggle
  ('label.onepager.ai_toggle.titel',           'label', 'OnepagerBuilder AI-toggle titel', 'Met AI-inzichten', NULL, false),
  ('label.onepager.ai_toggle.body.aan',        'label', 'OnepagerBuilder AI-toggle body (aan) — {N} replacer', 'De one-pager bevat de {N} bevindingen die je in Inzichten markeerde voor het rapport.', NULL, false),
  ('label.onepager.ai_toggle.body.uit',        'label', 'OnepagerBuilder AI-toggle body (uit)', 'One-pager toont alleen jouw eigen inhoud — zonder AI-bevindingen.', NULL, false),
  -- ModelLibrary
  ('label.onepager.modellib.vaste_blokken.titel', 'label', 'ModelLibrary sectie-titel vaste blokken', 'Altijd zichtbaar', NULL, false),
  ('label.onepager.modellib.groups.titel',     'label', 'ModelLibrary sectie-titel configureerbare modellen', 'Kies modellen', NULL, false),
  ('label.onepager.modellib.selectie.titel',   'label', 'ModelLibrary selectie-overzicht titel — {N} replacer', 'Volgorde op A4 · {N} gekozen', NULL, false),
  ('label.onepager.modellib.selectie.empty',   'label', 'ModelLibrary selectie-overzicht lege staat', 'Nog geen modellen gekozen — vink hierboven aan.', NULL, false),
  ('label.onepager.modellib.action.up',        'label', 'ModelLibrary selectie-item omhoog', 'Omhoog', NULL, false),
  ('label.onepager.modellib.action.down',      'label', 'ModelLibrary selectie-item omlaag', 'Omlaag', NULL, false),
  ('label.onepager.modellib.action.remove',    'label', 'ModelLibrary selectie-item verwijder', 'Verwijder', NULL, false),
  ('label.onepager.modellib.disabled.reason.prefix', 'label', 'ModelLibrary screen-reader prefix bij disabled-icon', 'Disabled: ', NULL, false),
  -- A4Preview skelet + fallbacks
  ('label.onepager.preview.kicker',            'label', 'A4Preview kicker boven H1', 'One-pager · A4 landschap', NULL, false),
  ('label.onepager.preview.h1.placeholder',    'label', 'A4Preview H1 placeholder wanneer samenvatting wel ready maar geen tekst', 'Strategische samenvatting', NULL, false),
  ('label.onepager.preview.selectie.titel',    'label', 'A4Preview selectie-sectie-label', 'Modellen', NULL, false),
  ('label.onepager.preview.model.placeholder', 'label', 'A4Preview model-skelet placeholder tekst', 'Block 4 vult dit blok met inhoud uit de werkblad-data.', NULL, false),
  ('label.onepager.preview.insights.titel',    'label', 'A4Preview AI-aandachtspunten-blok titel', 'Aandachtspunten uit Inzichten', NULL, false),
  ('label.onepager.preview.insights.suffix',   'label', 'A4Preview AI-aandachtspunten-blok suffix bij count', 'bevindingen opgenomen — Block 4 vult de tekst in', NULL, false),
  -- Data-completeness fallbacks
  ('label.onepager.preview.fallback.samenvatting', 'label', 'Fallback wanneer samenvatting leeg', 'Strategische samenvatting nog niet gegenereerd. → Genereer in werkblad.', NULL, false),
  ('label.onepager.preview.fallback.identiteit',   'label', 'Fallback wanneer Missie/Visie/Ambitie incompleet', 'Vul Missie, Visie en Ambitie eerst in onder Strategie-werkblad → Identiteit.', NULL, false),
  ('label.onepager.preview.fallback.kpi',          'label', 'Fallback wanneer <4 KPIs', 'Voeg minstens 4 KPI''s toe verdeeld over de thema''s voor een complete strip.', NULL, false),
  ('label.onepager.preview.fallback.themas',       'label', 'Fallback wanneer 0 strategic_themes', 'Geen strategische thema''s gedefinieerd — voeg eerst minstens één thema toe.', NULL, false),
  ('label.onepager.preview.fallback.insights',     'label', 'Fallback wanneer geen in_rapport=true insights bij AI-toggle aan', 'Geen bevindingen geselecteerd in Inzichten.', NULL, false),
  -- Strategie-specifieke vaste-blokken + model-namen + disabled-reasons
  ('label.strategie.onepager.vast.identiteit.label', 'label', 'Strategie vast-blok Identiteits-band label', 'Identiteits-band', NULL, false),
  ('label.strategie.onepager.vast.identiteit.sub',   'label', 'Strategie vast-blok Identiteits-band sub-label', 'Missie · Visie · Ambitie · Kernwaarden', NULL, false),
  ('label.strategie.onepager.vast.kpi.label',        'label', 'Strategie vast-blok KPI-strip label', 'KPI-strip', NULL, false),
  ('label.strategie.onepager.vast.kpi.sub',          'label', 'Strategie vast-blok KPI-strip sub-label', 'Top 4 KPI''s auto-geselecteerd', NULL, false),
  ('label.strategie.onepager.vast.themas.label',     'label', 'Strategie vast-blok Strategische thema''s label', 'Strategische thema''s', NULL, false),
  ('label.strategie.onepager.vast.themas.sub_suffix','label', 'Strategie vast-blok thema''s sub-label suffix na count', 'thema''s', NULL, false),
  ('label.strategie.onepager.group.analyse.label',       'label', 'Strategie modellen-groep Strategische analyse label', 'Strategische analyse', NULL, false),
  ('label.strategie.onepager.group.positionering.label', 'label', 'Strategie modellen-groep Positionering label', 'Positionering', NULL, false),
  ('label.strategie.onepager.group.doelen.label',        'label', 'Strategie modellen-groep Doelen & verschuiving label', 'Doelen & verschuiving', NULL, false),
  ('label.strategie.model.swot',                 'label', 'Strategie model — SWOT-analyse', 'SWOT-analyse', NULL, false),
  ('label.strategie.model.swot.disabled_reason', 'label', 'Strategie SWOT disabled-reason wanneer 0 analysis_items', 'Vul de SWOT-tabbladen in onder Strategie → Analyse.', NULL, false),
  ('label.strategie.model.porter',                'label', 'Strategie model — Porter 5 Forces', 'Porter 5 Forces', NULL, false),
  ('label.strategie.model.porter.disabled_reason','label', 'Strategie Porter disabled-reason', 'Geen sector-analyse-velden in werkblad — komt in fase 2', NULL, false),
  ('label.strategie.model.pestel',                'label', 'Strategie model — PESTEL', 'PESTEL', NULL, false),
  ('label.strategie.model.pestel.disabled_reason','label', 'Strategie PESTEL disabled-reason', 'Geen macro-analyse-velden in werkblad — komt in fase 2', NULL, false),
  ('label.strategie.model.mckinsey7s',                'label', 'Strategie model — McKinsey 7S', 'McKinsey 7S', NULL, false),
  ('label.strategie.model.mckinsey7s.disabled_reason','label', 'Strategie McKinsey7S disabled-reason', 'Geen interne-factoren-velden in werkblad — komt in fase 2', NULL, false),
  ('label.strategie.model.ansoff',                'label', 'Strategie model — Ansoff-matrix', 'Ansoff-matrix', NULL, false),
  ('label.strategie.model.ansoff.disabled_reason','label', 'Strategie Ansoff disabled-reason', 'Geen groeirichting-velden in werkblad — komt in fase 2', NULL, false),
  ('label.strategie.model.valuechain',                'label', 'Strategie model — Value Chain', 'Value Chain', NULL, false),
  ('label.strategie.model.valuechain.disabled_reason','label', 'Strategie Value Chain disabled-reason', 'Geen waardeketen-velden in werkblad — komt in fase 2', NULL, false),
  ('label.strategie.model.vannaar',                'label', 'Strategie model — Van → Naar tabel', 'Van → Naar tabel', NULL, false),
  ('label.strategie.model.vannaar.disabled_reason','label', 'Strategie Van→Naar disabled-reason', 'Geen verschuiving-velden in werkblad — komt in fase 2', NULL, false),
  ('label.strategie.model.kernwaardenbord',                'label', 'Strategie model — Kernwaarden-bord', 'Kernwaarden-bord', NULL, false),
  ('label.strategie.model.kernwaardenbord.disabled_reason','label', 'Strategie Kernwaarden disabled-reason wanneer 0 kernwaarden', 'Voeg eerst minstens één kernwaarde toe onder Identiteit.', NULL, false)
ON CONFLICT (tenant_id, key) DO NOTHING;
