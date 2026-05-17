-- RFC-008 §A — Documenteert jsonb-uitbreiding van strategy_core.insights[] met
-- 3 nieuwe optionele velden (in_rapport, edited_observation, edited_recommendation)
-- + 2 audit-velden (last_edited_at, last_edited_by). Geen DDL nodig — service-laag
-- defaults handelen impliciete invulling af bij bestaande insights.

COMMENT ON COLUMN strategy_core.insights IS
  'jsonb-array van insight-objects. Sinds RFC-008 (17 mei 2026): elk object kan optioneel bevatten: '
  'in_rapport (bool, default false), edited_observation (text, override van AI), edited_recommendation (text, override), '
  'last_edited_at (timestamptz), last_edited_by (uuid auth.users). Zie RFC-008 §A voor volledige shape.';
