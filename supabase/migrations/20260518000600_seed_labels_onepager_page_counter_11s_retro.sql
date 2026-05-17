-- 11.S-retro — page-counter label voor A4Preview multi-page builder-preview.
-- Alleen zichtbaar in builder (print-CSS verbergt via .strategie-onepager-source-tag-class).
INSERT INTO app_config (key, category, description, value, tenant_id, tenant_overridable) VALUES
  ('label.onepager.page_counter', 'label', 'A4Page page-counter top-right (alleen builder, hidden in print). {N} = huidige pagina, {Total} = totaal aantal.', 'Pagina {N} / {Total}', NULL, false)
ON CONFLICT (tenant_id, key) DO NOTHING;
