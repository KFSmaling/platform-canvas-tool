-- ============================================================
-- Stap 11.I.2 — Verzekerings-9-stage seed in KF-test-canvas.
--
-- Strategy: statisch seed in KF-canvas `d22e6ac0-2648-4da8-8c51-4d47b879d300`
-- (Canvas 09 mei 2026 — recent en zonder bestaande klantreis-dim). Voegt één
-- nieuwe klantreis-dimensie + 9 items met volledig gevuld archetype_data
-- conform Kees-input §8.2 (strategie-adviseur-input van 11 mei 2026).
--
-- DO-blok-pattern omdat tenant_id + dimension_id dynamisch zijn afgeleid.
-- Idempotent via guard op bestaande klantreis-dim.
--
-- Tenant-overridable lijkt onnodig hier — dit is concrete data voor één
-- specifieke canvas, geen template. SQL-functie + UI-knop voor template-
-- aanmaak komt in latere boy-scout.
-- ============================================================

DO $$
DECLARE
  kf_canvas_id uuid := 'd22e6ac0-2648-4da8-8c51-4d47b879d300';
  kf_tenant_id uuid;
  dim_id       uuid;
  existing     int;
BEGIN
  -- Tenant uit canvas-rij ophalen (geen aannames)
  SELECT tenant_id INTO kf_tenant_id FROM canvases WHERE id = kf_canvas_id;
  IF kf_tenant_id IS NULL THEN
    RAISE NOTICE 'KF-canvas % niet gevonden — seed geskipt', kf_canvas_id;
    RETURN;
  END IF;

  -- Idempotentie: alleen seeden als geen klantreis-dim bestaat in dit canvas
  SELECT count(*) INTO existing FROM cd_dimensions
    WHERE canvas_id = kf_canvas_id AND archetype = 'klantreis';
  IF existing > 0 THEN
    RAISE NOTICE 'Klantreis-dim bestaat al in KF-canvas % — seed geskipt', kf_canvas_id;
    RETURN;
  END IF;

  -- Stap A: dimensie aanmaken
  INSERT INTO cd_dimensions (canvas_id, tenant_id, archetype, name, description, sort_order, is_ordered)
  VALUES (
    kf_canvas_id, kf_tenant_id, 'klantreis',
    'Verzekerings-klantreis',
    '9-stage customer journey voor verzekerings-domein. 80/20-denkdwang via MoT/Silent Period flags + asymmetrische weging (claim 3x).',
    100,  -- na bestaande klantsegment/propositie/kanaal-dims
    true  -- volgorde is betekenisvol (is_ordered-UI komt in latere sprint, sort_order tot dan)
  )
  RETURNING id INTO dim_id;

  -- Stap B: 9 items in correcte sort_order
  INSERT INTO cd_items (dimension_id, canvas_id, tenant_id, name, description, archetype_data, sort_order) VALUES
    -- Stage 1
    (dim_id, kf_canvas_id, kf_tenant_id,
     '1. Life Event Trigger',
     'Klant lost een levensprobleem op (huis kopen, kind, baan, ziekte, overlijden, scheiding, pensioen)',
     '{
       "stap_type": "trigger_life_event",
       "customer_goal": "Begrijpen wat er moet gebeuren",
       "emotions": ["onzeker", "soms gestrest"],
       "touchpoints": ["hypotheekadviseur", "werkgever", "makelaar", "dealer", "ziekenhuis", "notaris"],
       "kpis": ["trigger-to-quote tijd", "% triggers gedetecteerd"],
       "dmu": ["klant", "adviseur"],
       "is_moment_of_truth": false,
       "is_silent_period": true,
       "weight_multiplier": 1.0,
       "silent_period_risk": "Klant zoekt zelden actief — verzekeraar mist trigger-detectie",
       "regulatoire_context": "",
       "insight": "Klant zoekt zelden actief een verzekering — hij lost een levensprobleem op"
     }'::jsonb,
     10),
    -- Stage 2
    (dim_id, kf_canvas_id, kf_tenant_id,
     '2. Awareness & Oriëntatie',
     'Klant verkent opties. Vergelijkers commoditiseren het product.',
     '{
       "stap_type": "orientatie",
       "customer_goal": "Opties leren kennen",
       "emotions": ["zoekend", "vergelijkend"],
       "touchpoints": ["Google", "Independer", "Pricewise", "adviseur", "bank", "social", "mond-tot-mond"],
       "kpis": ["share of search", "qualified leads", "vergelijkingen per lead"],
       "dmu": ["klant", "adviseur"],
       "is_moment_of_truth": false,
       "is_silent_period": false,
       "weight_multiplier": 1.0,
       "regulatoire_context": "",
       "insight": "Vergelijkers commoditiseren je product → prijs wordt enige criterium"
     }'::jsonb,
     20),
    -- Stage 3 — MoT
    (dim_id, kf_canvas_id, kf_tenant_id,
     '3. Quote & Aanvraag',
     'Eerste echte ervaring met je bedrijf — UX bepaalt of klant doorgaat of afhaakt.',
     '{
       "stap_type": "quote_aanvraag",
       "customer_goal": "Snel duidelijkheid over premie/dekking",
       "emotions": ["ongeduldig"],
       "touchpoints": ["website", "app", "adviseur", "callcenter"],
       "kpis": ["quote-to-aanvraag conversie", "drop-off in formulier", "time-to-quote"],
       "dmu": ["klant", "adviseur", "verzekeraar"],
       "is_moment_of_truth": true,
       "is_silent_period": false,
       "weight_multiplier": 2.0,
       "regulatoire_context": "Wft transparantie premie/dekking; IDD pre-contractuele info",
       "insight": "Eerste echte ervaring met je bedrijf — UX van aanvraagflow bepaalt of klant doorgaat of afhaakt"
     }'::jsonb,
     30),
    -- Stage 4 — MoT
    (dim_id, kf_canvas_id, kf_tenant_id,
     '4. Underwriting & Acceptatie',
     'Acceptatie-proces, bij leven/AOV emotioneel beladen.',
     '{
       "stap_type": "underwriting",
       "customer_goal": "Geaccepteerd worden zonder gedoe",
       "emotions": ["gespannen (vooral leven/AOV)"],
       "touchpoints": ["medische keuring (leven/AOV)", "data-checks", "acceptant"],
       "kpis": ["acceptance rate", "doorlooptijd", "% straight-through-processing"],
       "dmu": ["klant", "acceptant", "medisch adviseur"],
       "is_moment_of_truth": true,
       "is_silent_period": false,
       "weight_multiplier": 2.0,
       "regulatoire_context": "Solvency II underwriting-criteria; AVG medische gegevens; gelijkebehandelingswetgeving",
       "insight": "Bij leven/AOV vaak emotioneel beladen (medische vragen, afwijzing) — onderschat moment of truth"
     }'::jsonb,
     40),
    -- Stage 5
    (dim_id, kf_canvas_id, kf_tenant_id,
     '5. Closing & Polis',
     'Transactionele afhandeling — gemiste kans voor emotionele verankering.',
     '{
       "stap_type": "closing_polis",
       "customer_goal": "Bevestiging dat het geregeld is",
       "emotions": ["opgelucht"],
       "touchpoints": ["polisblad (mail/post)", "eerste premie-incasso", "app-activatie"],
       "kpis": ["polis-issuance tijd", "fouten in polis", "eerste incasso-success"],
       "dmu": ["klant", "verzekeraar"],
       "is_moment_of_truth": false,
       "is_silent_period": false,
       "weight_multiplier": 1.0,
       "regulatoire_context": "IDD polisdocumentatie; SEPA-mandaat",
       "insight": "Vaak puur transactioneel afgehandeld — gemiste kans voor emotionele verankering"
     }'::jsonb,
     50),
    -- Stage 6 — MoT
    (dim_id, kf_canvas_id, kf_tenant_id,
     '6. Onboarding',
     'In NL-markt structureel onderbelicht — verzekeraars sturen polis en zwijgen.',
     '{
       "stap_type": "onboarding",
       "customer_goal": "Begrijpen wat ik heb en hoe het werkt",
       "emotions": ["verwachtingsvol", "soms verward"],
       "touchpoints": ["welkomstmail", "app-walkthrough", "uitlegvideo", "adviseurgesprek"],
       "kpis": ["activation rate (app-login binnen 30 dagen)", "uitlegmateriaal-gebruik", "vroege churn"],
       "dmu": ["klant", "verzekeraar", "adviseur"],
       "is_moment_of_truth": true,
       "is_silent_period": false,
       "weight_multiplier": 2.0,
       "regulatoire_context": "",
       "insight": "In NL-markt structureel onderbelicht — verzekeraars sturen polis en zwijgen"
     }'::jsonb,
     60),
    -- Stage 7 — Silent
    (dim_id, kf_canvas_id, kf_tenant_id,
     '7. Servicing & In-life',
     'Hier wint of verliest een verzekeraar. Klant ''vergeet'' je → vatbaar voor vergelijkers.',
     '{
       "stap_type": "servicing_in_life",
       "customer_goal": "Probleemloos doorlopen, mutaties makkelijk",
       "emotions": ["neutraal", "vergeet de verzekeraar"],
       "touchpoints": ["mutaties (verhuizing, gezin)", "jaaroverzicht", "app-notificaties", "premie-incasso", "cross-sell campagnes"],
       "kpis": ["NPS", "mutatie-doorlooptijd", "app-engagement", "ticket-volume"],
       "dmu": ["klant", "verzekeraar"],
       "is_moment_of_truth": false,
       "is_silent_period": true,
       "weight_multiplier": 1.0,
       "silent_period_risk": "Klant ''vergeet'' je → vatbaar voor vergelijkers bij renewal",
       "regulatoire_context": "Zorgplicht doorlopend (Wft); IDD post-contractuele zorg",
       "insight": "Hier wint of verliest een verzekeraar — engagement zonder lastig te zijn"
     }'::jsonb,
     70),
    -- Stage 8 — MoT 3x
    (dim_id, kf_canvas_id, kf_tenant_id,
     '8. Claim / Schade',
     'Bepalend moment — bepaalt loyaliteit + advocacy meer dan alle andere fases samen.',
     '{
       "stap_type": "claim_schade",
       "customer_goal": "Geholpen worden wanneer het er écht toe doet",
       "emotions": ["gestrest", "kwetsbaar", "veeleisend"],
       "touchpoints": ["schademelding (app/web/telefoon)", "expert", "schadebehandelaar", "uitkering", "herstelnetwerk"],
       "kpis": ["first contact resolution", "doorlooptijd", "post-claim NPS", "complaint rate"],
       "dmu": ["klant", "schadebehandelaar", "expert", "herstelnetwerk"],
       "is_moment_of_truth": true,
       "is_silent_period": false,
       "weight_multiplier": 3.0,
       "regulatoire_context": "Zorgplicht claim-afhandeling (Wft); Kifid-klachtroute; uitkering binnen redelijke termijn",
       "insight": "Klant verwacht hier dat je waarmaakt waarvoor hij jaren betaalde. Empathie weegt zwaarder dan snelheid (maar beide zijn nodig)."
     }'::jsonb,
     80),
    -- Stage 9 — MoT
    (dim_id, kf_canvas_id, kf_tenant_id,
     '9. Renewal / Churn / Advocacy',
     'Beslissing wordt vooral bepaald door cumulatieve ervaring stage 7+8.',
     '{
       "stap_type": "renewal_churn_advocacy",
       "customer_goal": "Bevestigen dat dit nog steeds klopt",
       "emotions": ["evaluerend", "prijsbewust"],
       "touchpoints": ["verlengingsbrief", "premie-aanpassing", "retentie-team", "opzegproces", "NPS-survey"],
       "kpis": ["retention rate", "churn rate", "expansion revenue", "referral rate", "CLV"],
       "dmu": ["klant", "verzekeraar", "vergelijker"],
       "is_moment_of_truth": true,
       "is_silent_period": false,
       "weight_multiplier": 2.0,
       "regulatoire_context": "IDD jaarlijkse opzegmogelijkheid; transparante premie-aanpassingen",
       "insight": "Beslissing wordt vooral bepaald door de cumulatieve ervaring van stage 7 + 8, niet door de renewal-communicatie zelf"
     }'::jsonb,
     90);

  RAISE NOTICE 'Klantreis-dim % aangemaakt in KF-canvas % met 9 verzekerings-stages', dim_id, kf_canvas_id;
END $$;
