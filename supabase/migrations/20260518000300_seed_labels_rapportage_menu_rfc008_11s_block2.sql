-- RFC-008 §6 — labels voor RapportageMenu + PPT-info-dialog
-- 11.S Block 2. tenant_overridable=false (generieke UI, analoog Block 1).
-- 15 nieuwe keys. `label.werkblad.action.rapportage` (Rapportage-knop-label
-- in WerkbladActieknoppen) bestaat al — niet hergeseed.

INSERT INTO app_config (key, category, description, value, tenant_id, tenant_overridable) VALUES
  ('label.rapportage.menu.header',         'label', 'RapportageMenu — dialog header', 'Wat wil je delen met de klant?', NULL, false),
  ('label.rapportage.menu.subtekst',       'label', 'RapportageMenu — sub-tekst onder header', 'Kies een export-vorm. Elke vorm gebruikt de huisstijl van het canvas of de klant en pakt de actuele data van dit werkblad.', NULL, false),
  ('label.rapportage.tile.onepager.titel', 'label', 'RapportageMenu — tile 1 titel', 'One-pager · A4 landschap', NULL, false),
  ('label.rapportage.tile.onepager.body',  'label', 'RapportageMenu — tile 1 body', 'Kies welke modellen op de pagina komen. Toggle voor met/zonder AI-inzichten. Print of PDF.', NULL, false),
  ('label.rapportage.tile.onepager.badge', 'label', 'RapportageMenu — tile 1 badge', 'Populair', NULL, false),
  ('label.rapportage.tile.ppt.titel',      'label', 'RapportageMenu — tile 2 titel', 'PowerPoint-export · 8–12 slides', NULL, false),
  ('label.rapportage.tile.ppt.body',       'label', 'RapportageMenu — tile 2 body', 'Genereert een volledig deck met titel, executive summary, één slide per model, en aandachtspunten als appendix. Bewerkbaar in PowerPoint.', NULL, false),
  ('label.rapportage.tile.ppt.badge',      'label', 'RapportageMenu — tile 2 badge', 'Beschikbaar fase 2', NULL, false),
  ('label.rapportage.ppt.info.titel',      'label', 'PPT info-dialog — titel', 'PowerPoint-export', NULL, false),
  ('label.rapportage.ppt.info.body',       'label', 'PPT info-dialog — multi-line body (gebruikt \n)', 'Beschikbaar in fase 2.

Genereert een volledig deck:
- Titel-slide + executive samenvatting
- Eén slide per strategisch thema (KSF/KPI)
- Eén slide per model (SWOT, etc.)
- Appendix met aandachtspunten

Wil je nu al een one-pager?', NULL, false),
  ('label.rapportage.ppt.info.cta',        'label', 'PPT info-dialog — CTA-knop', 'Open one-pager', NULL, false),
  ('label.rapportage.tip',                 'label', 'RapportageMenu — tip-strip onderaan', 'Tip: open Inzichten eerst — daar krijg je AI-advies dat je kan opnemen in deze exports.', NULL, false),
  ('label.rapportage.footer.label',        'label', 'RapportageMenu — footer-strip label', 'Binnenkort', NULL, false),
  ('label.rapportage.footer.chips',        'label', 'RapportageMenu — footer-strip chip-namen (· gescheiden)', 'Gamma · Word-rapport · PDF compleet · E-mail-samenvatting', NULL, false),
  ('label.rapportage.action.close',        'label', 'RapportageMenu — close X aria-label', 'Sluit', NULL, false)
ON CONFLICT (tenant_id, key) DO NOTHING;
