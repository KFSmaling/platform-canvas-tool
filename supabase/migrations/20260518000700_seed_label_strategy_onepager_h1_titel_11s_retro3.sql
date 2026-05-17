-- 11.S-retro-3 Fix 1 — H1 wordt vaste-titel "Samenvatting Strategie" i.p.v.
-- samenvatting-tekst (Kees-keuze 18 mei: spaart ruimte; samenvatting blijft
-- in werkblad-Stip-op-de-Horizon).
-- tenant_overridable=true: consultancy-tenant kan eigen titel kiezen
-- (bv. "Strategisch overzicht" / "Bedrijfsstrategie" / etc).

INSERT INTO app_config (key, category, description, value, tenant_id, tenant_overridable) VALUES
  ('label.strategie.onepager.titel.h1', 'label', 'StrategyOnePager v2 TitelBlock H1 (vaste titel). 11.S-retro-3 vervangt samenvatting-tekst-render.', 'Samenvatting Strategie', NULL, true)
ON CONFLICT (tenant_id, key) DO NOTHING;
