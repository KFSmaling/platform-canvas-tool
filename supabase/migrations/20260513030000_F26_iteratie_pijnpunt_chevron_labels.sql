-- ============================================================
-- F26-iteratie — Pijnpunt-chevron-card-labels voor volle-breedte-strip.
--
-- 4 nieuwe label-keys (designer-spec uit 13 mei result regel 213-251):
-- - stage-koppeling-pill-prefix
-- - multi-relationele-chip-prefix met {N}-token
-- - flow-titel-header met {N}-token
-- - andere-dims-titel-header met {N}-token
--
-- Tokens {N} via frontend-string-replace (consistent met andere parametric
-- labels in dit werkblad — bv. F21 cascade-dialog {N}/{M}).
--
-- Idempotent via ON CONFLICT (tenant_id, key) DO UPDATE.
-- tenant_id=NULL + tenant_overridable=true (consultancy-tenants kunnen
-- branche-specifieke terminologie overschrijven — bv. proces-werkblad).
-- ============================================================

INSERT INTO app_config (key, category, description, value, tenant_id, tenant_overridable) VALUES
  ('label.klanten.pijnpunt.stage_koppeling.prefix',
   'label',
   'Pill-prefix op pijnpunt-chevron-card: "stap N · {stage-naam}"',
   'stap',
   NULL, true),
  ('label.klanten.pijnpunt.multi_relationeel.prefix',
   'label',
   'Chip-tekst voor pijnpunt aan ≥2 dimensies — {N}-token via frontend',
   '+ {N} dimensies',
   NULL, true),
  ('label.klanten.pijnpunten.klantreis.flow.titel',
   'label',
   'Header boven doorlopende horizontale pijnpunt-flow — {N}-token via frontend',
   'Pijnpunten op klantreis · {N} stuks',
   NULL, true),
  ('label.klanten.pijnpunten.andere_dims.titel',
   'label',
   'Header boven grid van andere-dimensies-pijnpunten — {N}-token via frontend',
   'Pijnpunten andere dimensies · {N} stuks',
   NULL, true)
ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value;
