# BTC Tool — Architectuur & Werkwijze voor Claude

> Dit document wordt automatisch gelezen aan het begin van elke sessie.  
> Alle regels hier zijn **verplicht** — geen uitzonderingen.

---

## Scope van dit document

Deze CLAUDE.md beschrijft de HUIDIGE werkende codebase en de patronen
die daarin consistent worden toegepast. Claude Code gebruikt dit
document als leidraad voor wijzigingen aan bestaande code.

Voor architectonische richting en toekomstige features: zie
`docs/architecture-spec.md`. De spec beschrijft waar het platform
naartoe beweegt (multi-tenant SaaS met content packs, billing,
monorepo). Niet alles in de spec is nu geïmplementeerd.

Regel bij conflict:
- Wijzigingen aan bestaande code volgen CLAUDE.md-patronen
- Nieuwe features worden ontworpen volgens de spec, tenzij dit
  een grotere refactor zou vereisen dan de feature zelf
- Bij twijfel: vraag expliciet om richting, ga niet uit van aannames

Wijziging van CLAUDE.md-patronen gebeurt alleen met expliciete
opdracht (niet automatisch "om de spec te volgen").

---

## 1. DEPLOY — via het script, en verificatie

./deploy-prod.sh "feat: beschrijving van wijziging"

Dit script doet: git commit + push → vercel --prod → alias opnieuw pinnen 
naar `kingfisher-btcprod.vercel.app`.

**Naast het script** deploy Vercel ook automatisch bij elke push naar master 
(GitHub-integratie). Dit betekent dat docs-commits en triviale pushes óók 
een productie-deployment opleveren. Geen probleem, wel iets om te weten.

**Verificatie na elke belangrijke deploy:**
Check in Vercel Dashboard dat `kingfisher-btcprod.vercel.app` onder "Assigned 
Domains" staat van de nieuwste deployment. Zo niet: het script heeft de 
alias-her-assignment gemist, handmatig:

vercel alias set <deployment-url> kingfisher-btcprod.vercel.app

**Prod URL (leidend):** https://kingfisher-btcprod.vercel.app
**Demo-omgeving:** op dit moment geen actieve demo. Nieuwe demo-setup gepland 
— zie TECH_DEBT.md P3.

### 1.1 Deploy workflow — wanneer het script verplicht is

| Type wijziging | Actie |
|---|---|
| Code (React, services, hooks) | `./deploy-prod.sh "..."` — verplicht |
| Database migraties | Script + handmatig uitvoeren in Supabase SQL Editor |
| Docs-only (`docs/`, `CLAUDE.md`, `TECH_DEBT.md`) | `git commit + push` is voldoende — Vercel deployt automatisch, alias hoeft niet opnieuw gepind |
| Seed SQL (`docs/*.sql`) | Alleen `git commit + push` voor versiebeheer; SQL zelf uitvoeren in Supabase SQL Editor |

**Waarom het script verplicht is bij code:** Vercel's GitHub-webhook deployt 
automatisch maar pint de `btcprod`-alias **niet** naar de nieuwe deployment. 
Het script doet dat wel via `vercel alias set`. Zonder het script draait 
`kingfisher-btcprod.vercel.app` altijd op een verouderde build.

**Nooit `--no-verify` of force-push naar master.** Bij een falende pre-commit 
hook: probleem oplossen, opnieuw stagen, nieuwe commit aanmaken.

## 2. LABELS — Alle UI-tekst is dynamisch

**Elke** gebruikersgerichte string (titels, knoppen, veldnamen, secties) moet via `appLabel()`:

```jsx
// ✅ Correct
const { label: appLabel } = useAppConfig();
<h3>{appLabel("strat.section.identiteit", "Identiteit")}</h3>

// ❌ Fout — nooit hardcoded strings in JSX voor UI-tekst
<h3>Identiteit</h3>
```

### Bij elk nieuw label:
1. Gebruik in component: `appLabel("mijn.label.key", "Fallback tekst")`
2. Voeg toe aan `LABEL_FALLBACKS` in `src/shared/context/AppConfigContext.jsx`
3. Voeg toe aan DB via migratie: `INSERT INTO app_config (key, category, description, value)`

### Label-naamgeving conventie:
- `label.app.*` — applicatie-brede labels (titel, subtitel)
- `label.strat.*` — Strategie Werkblad
- `label.richtl.*` — Richtlijnen Werkblad
- `label.werkblad.*` — werkbladnamen in headers
- `label.canvas.*` — Canvas dashboard labels

---

## 3. DATABASE — Nooit data in de code

Alles wat per klant anders kan: **in de database**, niet hardcoded in React-componenten.

- Segmentnamen, kleuren, volgorde → `app_config` tabel via `appLabel()`
- Gebruikersdata (guidelines, strategie, thema's) → eigen tabellen via services
- Prompts → `app_config` tabel via `appPrompt()`

**Services pattern**: alle Supabase-aanroepen gaan via `src/features/[feature]/services/[feature].service.js`. Nooit direct Supabase aanroepen in een component.

### Service contract (actueel)

Services retourneren `{ data, error }` objecten — ze gooien niet. De UI-laag checkt `error` expliciet en handelt af volgens sectie 4.2.

```js
// ✅ Correct — huidig contract
export async function upsertGuideline(canvasId, data) {
  if (!canvasId) return { data: null, error: new Error("canvasId is required") };
  const { data: result, error } = await supabase
    .from("guidelines")
    .upsert({ canvas_id: canvasId, ...data })
    .select()
    .single();
  return { data: result, error };
}

// Call-site
const { data, error } = await guidelinesService.upsertGuideline(canvasId, payload);
if (error) { /* zie sectie 4.2 */ }
```

---

## 3A. MULTI-TENANCY (geïmplementeerd 2026-04-24)

### Architectuur

De app is multi-tenant: elke gebruiker hoort bij één tenant, en alle data 
(canvases, strategy, guidelines) is geïsoleerd per tenant via RLS.

**Database-structuur:**
- `tenants` tabel — `id`, `name`, `slug`, `theme_config jsonb`
- `user_profiles` tabel — `id` (FK → `auth.users`), `tenant_id`, `role`
- RLS helper-functies: `current_tenant_id()` en `current_user_role()` — beide 
  `SECURITY DEFINER`, lezen `user_profiles` en cachen per transactie

**RLS-patroon op data-tabellen:**

```sql
-- Lees: eigen data of als admin
USING (tenant_id = current_tenant_id() AND (user_id = auth.uid() OR current_user_role() = 'tenant_admin'))
-- Insert/Update: altijd tenant_id meegeven
WITH CHECK (tenant_id = current_tenant_id())
```

### Theming

Elke tenant heeft een `theme_config jsonb` kolom met kleur- en logo-waarden. 
ThemeProvider leest deze bij login en injecteert CSS custom properties op `document.documentElement`.

**CSS variabelen (volledig overzicht):**

| CSS-variabele | `theme_config` key | Gebruik |
|---|---|---|
| `--color-primary` | `primary_color` | Achtergrond header, body tekst |
| `--color-accent` | `accent_color` | CTA-knoppen, highlights |
| `--color-accent-hover` | `accent_hover_color` | Hover-state van accent |
| `--color-success` | `success_color` | Voltooiings-indicatoren |
| `--color-analysis` | `analysis_color` | To-be / analyse-elementen |
| `--color-overlay` | `overlay_color` | Modal-overlays (donkerder dan primary) |
| `--color-accent-light` | `accent_light_color` | Zachte achtergrond bij accent |

**Tailwind-gebruik:** altijd `bg-[var(--color-primary)]`, nooit hardcoded hex in 
componenten. Fallbacks staan als `:root` defaults in `src/index.css`.

### Sleutel-bestanden

| Bestand | Rol |
|---|---|
| `src/shared/services/auth.service.js` | Fetcht `user_profiles` + `tenants(theme_config)`; levert `tenantId`, `tenantTheme`, `userRole` via context |
| `src/shared/context/ThemeProvider.jsx` | Injecteert CSS-variabelen zodra `tenantTheme` geladen is; guard op leeg `{}` object |
| `src/shared/hooks/useTheme.js` | Typed toegang tot alle theme-waarden met Kingfisher-defaults als fallback |
| `src/shared/components/LogoBrand.jsx` | Logo-component met `variant="light"\|"dark"`, `imageFailed`-state als fallback op `brandName`-tekst |
| `src/shared/hooks/useDocumentTitle.js` | Zet `document.title` op `"{brandName} — {productName}"` |
| `docs/theming-seed-v2.sql` | Idempotente seed voor beide tenants (opnieuw uitvoerbaar) |

### Regels bij nieuwe componenten

- **Nooit** hardcoded hex-kleuren in JSX — altijd `var(--color-*)` of `useTheme()`
- Logo's: altijd `<LogoBrand variant="light|dark" />`, nooit `<img src="/kf-logo*.png">`
- Tenant-afhankelijke tekst (merknaam, productnaam): via `useTheme().brandName` / `productName`
- Nieuwe CSS-variabelen: toevoegen aan `ThemeProvider.jsx`, `useTheme.js`, `src/index.css` (:root), en `theming-seed-v2.sql`

### Tenants in productie

| Tenant | Slug | `tenant_type` | `primary_color` | `accent_color` | Logo |
|---|---|---|---|---|---|
| Platform | `platform` | `internal` | `#0f172a` | `#f97316` | Beide null → toont brandName-tekst |
| Kingfisher | `kingfisher` | `consultancy` | `#1a365d` | `#8dc63f` | `kf-logo.png` (donker), wit: null → tekst |
| TLB | `tlb-test` | `enterprise` | `#281805` | `#A06B3C` | TLB-SVG voor beide variants |

---

## 3B. AI-AFFORDANCES — visueel patroon

Eén consistent visueel patroon voor alle AI-iconen en -knoppen, zodat
gebruikers AI-features herkennen en zien.

### Canonical componenten — `src/shared/components/`

| Component | Wanneer |
|---|---|
| `<AiIconButton>` | Stand-alone AI-knop (icon + optionele label, eigen state-machine) |
| `<AiIcon>` | Pure icon binnen een bestaande knop, kop of decoratieve loading-state |
| `<WandButton>` | Backwards-compat thin wrapper rond `<AiIconButton variant="improve">` |

### Variants

- `variant="improve"` → `Wand2` — verbeter op basis van bestaande context (Magic Staff, KSF/KPI generator, auto-tag, auto-link)
- `variant="generate"` → `Sparkles` — genereer nieuw / vrije AI-actie (analyse, advies, thema's, print-include)

### Visuele standaard (toegepast door `<AiIconButton>`, default in `<AiIcon>`)

| State | Tailwind |
|---|---|
| Default (clickable, idle) | `text-[var(--color-accent)]/70` |
| Hover | `text-[var(--color-accent)]` + `bg-[var(--color-accent)]/8` |
| Active/loading | `text-[var(--color-accent)]` (+ `animate-spin` spinner via `loading` prop) |
| Disabled | `text-slate-400 opacity-60 cursor-not-allowed` |

### Regels

- Nieuwe AI-feature → gebruik `<AiIconButton>`. Geen losse `<Wand2>` of `<Sparkles>` in feature-code.
- Inline binnen bestaand button-frame (om button-styling te behouden) → gebruik `<AiIcon>`. Default kleur is canonical accent; override via `colorClass` alleen bij donkere achtergrond of expliciet design-besluit.
- Loading-spinners (full-size pulserende `Wand2` size 28 in lege werkbladen) blijven als losse `<Wand2 animate-pulse>` — dat is een aparte feedback-rol, geen affordance.
- Iconen-formaat: 9–13 px in compacte knoppen, 28 px voor loading-states.

---

## 3C. TENANT-CONTENT & TEMPLATING (ADR-002 niveau 1, geïmplementeerd 2026-05-05)

Prompts en (toekomstig) labels zijn methode-/merk-/branche-vrij gemaakt en
worden per request gerenderd met tenant-specifieke waarden. Eén globale prompt-
of label-rij wordt door alle tenants gedeeld; tenant-specifieke variatie zit in
`tenants.tenant_content` jsonb. Per-tenant override van een hele rij is óók
mogelijk via `app_config(tenant_id, key)`, maar wordt pas gebruikt als een
tenant écht een eigen versie van een prompt of label nodig heeft.

### Database-structuur

| Tabel/kolom | Rol |
|---|---|
| `tenants.tenant_content jsonb` | Per-tenant token-waarden (brand_name, framework_name, brand_clause, framework_clause, industry_clause, example_segments_clause). Geseed in `20260504020000`. |
| `app_config.id uuid PK` | Synthetische PK (was: PK op `key`). |
| `app_config.tenant_id uuid NULL` | NULL = globale rij, ingevuld = tenant-override. |
| `app_config UNIQUE NULLS NOT DISTINCT (tenant_id, key)` | Eén rij per (tenant, key); NULL-tenant telt als één unieke waarde. |
| `block_definitions.tenant_id uuid NULL` | Idem patroon (zie `20260504010300`). |

### RPC-lookup-flow

Twee `SECURITY DEFINER` RPC's doen DISTINCT ON met NULLS LAST: tenant-override
wint, anders globale rij. Migratie: `20260504030000_fase6_tenant_lookup_rpc.sql`.

| RPC | Vervangt | Gebruikt door |
|---|---|---|
| `get_app_config_for_tenant()` | `from("app_config").select(...)` | `AppConfigContext.loadConfig()` |
| `get_block_definitions_for_tenant()` | `from("block_definitions").select(...)` | `canvas.service.fetchBlockDefinitions()` |

Frontend roept altijd via `supabase.rpc(...)` aan — directe `.from("app_config")`
selecties op deze tabellen zijn nu fout (zou tenant-overrides missen).

### Template-engine

`api/_template.js` (CommonJS, gebruikt door alle 5 endpoints):

| Export | Doel |
|---|---|
| `renderPrompt(template, vars)` | Substitueert `{{var}}`-tokens (Mustache-style, geen partials/conditionals). Onbekende tokens blijven letterlijk staan zodat ze opvallen in output. |
| `getTenantVars(supabaseClient)` | Leest `tenants.tenant_content` voor de huidige user-context (via `auth.uid()` → `user_profiles.tenant_id`). Levert `{}` voor anonymous/onbekende tenant; render valt dan terug op token-letterlijk. |
| `userScopedClient(req)` | Bouwt een Supabase-client met de user's JWT zodat RLS in serverless-functies werkt. |

**Endpoint-pattern** (alle 5: `magic.js`, `strategy.js`, `validate.js`, `improve.js`, `guidelines.js`):

```js
const { renderPrompt, getTenantVars, userScopedClient } = require("./_template");
const supabase = userScopedClient(req);
const tenantVars = await getTenantVars(supabase);
const systemPrompt = renderPrompt(rawPromptFromDb, tenantVars);
```

### Token-vocabulair

Twee vormen — gebruik consequent:

| Token | Vorm | Voorbeeld KF | Voorbeeld TLB |
|---|---|---|---|
| `{{brand_name}}` | naked | `Kingfisher & Partners` | `TLB` |
| `{{framework_name}}` | naked | `het Business Transformatie Canvas (BTC)` | `het strategische raamwerk` |
| `{{brand_clause}}` | leading-space, eindigt zonder punt | ` bij Kingfisher & Partners` | ` bij TLB` |
| `{{framework_clause}}` | leading-space, eindigt op punt; mag leeg | ` Je bent gespecialiseerd in het Business Transformatie Canvas.` | `""` |
| `{{industry_clause}}` | leading-space, geen punt | ` voor de financiële en verzekeringssector` | ` voor HNW financial services` |
| `{{example_segments_clause}}` | leading-space, voor opsommingen; mag leeg | `""` | `""` |

**Regel**: clause-vorm bevat zelf de leading-space en (waar nodig) de eindpunt
zodat de omringende prompt-tekst niet hoeft te kennen of de clause leeg is.
Lege clauses verdwijnen schoon uit de output.

### Wanneer schrijf je een nieuwe prompt of label?

1. Schrijf de globale rij (`tenant_id IS NULL`) met `{{token}}`-substituties voor brand/framework/industry — geen hardcoded merknamen.
2. Voeg waar nodig nieuwe tokens toe aan `tenants.tenant_content` voor alle 3 actieve tenants in dezelfde migratie.
3. Endpoints/UI roepen via de RPC-lookup; de template-engine doet de rest.
4. Per-tenant override van de hele rij alleen als één tenant écht een eigen prompt/label nodig heeft (zelden).

### Niet-doen

- Geen hardcoded merknaam, framework-naam, of branche-aanduiding in een nieuwe prompt of label — gebruik altijd een token.
- Geen direct `from("app_config").select(...)` voor labels of prompts; gebruik `supabase.rpc("get_app_config_for_tenant")`.
- Geen `app_config`-INSERT zonder `tenant_id` (NULL is expliciet — niet weglaten).
- Geen nieuwe template-engine of token-vocabulair introduceren — gebruik `renderPrompt`.

---

## 4. STATE MANAGEMENT & DATA INTEGRITEIT

State-problemen in deze app komen bijna altijd uit drie bronnen: ghost data bij canvas-wissel, silent save failures, en race conditions bij snel wisselen. Deze regels zijn **verplicht** — niet optioneel, niet "meestal".

### 4.1 Lifecycle — forceer remount bij canvas-wissel

Elk feature-component dat canvas-specifieke state bevat (strategy, guidelines, themes, canvas dashboard, overlays die op één canvas werken) krijgt `key={canvasId}` op de root van die feature. Dit dwingt React om de component-tree volledig te vernietigen en schoon op te bouwen — geen resten van het vorige canvas.

```jsx
// ✅ Correct — op feature-root / overlay-root
<StrategyWerkblad key={canvasId} canvasId={canvasId} />
<RichtlijnenWerkblad key={canvasId} canvasId={canvasId} />
<DeepDiveOverlay key={canvasId} canvasId={canvasId} />
<MasterImporterPanel key={canvasId} canvasId={canvasId} />

// ❌ Fout — op individuele input (breekt focus tijdens typen)
<input key={canvasId} value={value} />

// ❌ Fout — geen key (ghost data van vorig canvas blijft)
<StrategyWerkblad canvasId={canvasId} />
```

**Scope**: op feature-niveau of overlay-niveau, niet op pagina-niveau (te grof) en niet op input-niveau (te fijn).

### 4.2 Async integriteit — geen silent fails

Elke database-mutatie geeft een `Promise` terug met `{ data, error }`. De UI-laag gebruikt `await`, toont een loading state tot de server bevestigt, checkt `error` expliciet, en handelt elke error af met een duidelijke melding plus retry-optie.

```jsx
// ✅ Correct
const handleSave = async () => {
  setSaving(true);
  const { error } = await guidelinesService.upsert(canvasId, data);
  setSaving(false);
  if (error) {
    showError(
      appLabel("error.save.failed", "Opslaan mislukt"),
      { retry: handleSave }
    );
    return;
  }
};

// ❌ Fout — fire-and-forget, error gesmoord
upsertStrategyCore(canvasId, data).catch(() => {});

// ❌ Fout — await maar geen error-check, UI verwijdert item ook als DB-delete faalt
const removeItem = async (id) => {
  await deleteService(id);
  setItems(items.filter(i => i.id !== id));
};

// ❌ Fout — setTimeout om save "te verbergen", geen error-handling
setTimeout(() => upsertStrategicTheme(canvasId, theme), 0);

// ❌ Fout — optimistic update, UI wijzigt vóór server-bevestiging
setItems(newItems);
await saveItems(newItems); // als dit faalt: state en DB lopen uiteen
```

**Regels**:
- Loading/saving indicator verdwijnt pas na server-bevestiging.
- Elke error toont een duidelijke melding **mét** retry-optie.
- Nooit code schrijven die aanneemt dat een save "altijd wel lukt".
- Geen fire-and-forget. Geen ingeslikte catches. Geen `setTimeout` om saves te "verbergen".
- Geen optimistic updates. UI wacht op server-bevestiging voordat de nieuwe waarde zichtbaar wordt. De "saving..." indicator overbrugt de latency.

### 4.3 Data isolatie — reset en race-guards

Bij canvas-wissel: reset lokale state naar `null` of `initialState` **voordat** de nieuwe fetch begint, en bescherm tegen race conditions als de gebruiker snel wisselt.

```jsx
// ✅ Correct — canoniek patroon
useEffect(() => {
  const activeCanvasId = canvasId;
  let cancelled = false;
  setData(null); // reset eerst, voorkomt ghost data

  (async () => {
    const { data: result, error } = await service.load(activeCanvasId);
    if (cancelled) return;                       // race-guard 1: unmount / effect re-run
    if (activeCanvasId !== canvasId) return;     // race-guard 2: canvas veranderd tijdens fetch
    if (error) { setError(error); return; }
    setData(result);
  })();

  return () => { cancelled = true; };
}, [canvasId]);

// ❌ Fout — geen reset, geen guard, Promise.all().then() zonder bescherming
useEffect(() => {
  Promise.all([loadA(canvasId), loadB(canvasId)]).then(([a, b]) => {
    setA(a); setB(b); // kan verouderde data zijn als user inmiddels is gewisseld
  });
}, [canvasId]);
```

### 4.4 Stale closures in callbacks

Callbacks die async werk doen (save, delete, AI-generate, accept-draft) mogen niet leunen op een `canvasId` uit een oudere render. Gebruik een ref, of geef `canvasId` expliciet mee op het moment dat de callback wordt aangeroepen.

```jsx
// ✅ Correct — ref blijft actueel
const canvasIdRef = useRef(canvasId);
useEffect(() => { canvasIdRef.current = canvasId; }, [canvasId]);

const handleSave = async (data) => {
  const { error } = await service.upsert(canvasIdRef.current, data);
  if (error) { /* ... */ }
};

// ❌ Fout — stale closure, slaat op in vórig canvas als user snel wisselt
const handleSave = async (data) => {
  await service.upsert(canvasId, data); // canvasId uit render-moment, niet uit clickmoment
};
```

### 4.5 Checklist bij state-werk

- [ ] Heeft dit component canvas-specifieke state? → `key={canvasId}` op feature- of overlay-root
- [ ] Is er een save/update/delete? → `await`, `{ data, error }` check, loading state tot server bevestigt, retry bij error
- [ ] Is er een load bij `canvasId` change? → reset vooraf + captured `activeCanvasId` + `cancelled` flag + cleanup
- [ ] Gebruikt een callback `canvasId` asynchroon? → `canvasIdRef.current` of parameter, geen closure
- [ ] Retourneert de service `{ data, error }` en checkt de call-site `error`?

### 4.6 Compliance status (per 2026-04-26)

- **4.1** ✅ Compliant per 2026-04-22
- **4.2** ❌ Systematisch non-compliant; zie `TECH_DEBT.md`
- **4.3** ✅ Compliant per 2026-04-26 (`useCanvasState.handleSelectCanvas` race-guard toegevoegd)
- **4.4** ❌ Geen enkele callback gebruikt `canvasIdRef`; zie `TECH_DEBT.md`
- **4.5** ✅ Contract is `{ data, error }` — zie sectie 3

Werk deze regel bij na elke compliance-verbetering.

---

## 5. COMPONENTEN — Loosely coupled, één verantwoordelijkheid

- Elk werkblad = eigen directory: `src/features/[naam]/`
- Elk groot component = eigen bestand
- Geen mega-componenten (>300 regels is een signaal om te splitsen)
- Canvas-blokken die een werkblad representeren: `src/features/canvas/components/[Naam]StatusBlock.jsx`

**Patroon voor statusblokken op canvas** (zie `StrategyStatusBlock.jsx` en `PrinciplesStatusBlock.jsx`):
- `col-span-12`, `STATUS_COLORS[status]`, `STATUS_BADGE_KEYS`
- Statusvelden met `CheckCircle2` (groen vinkje) of grijs bolletje
- Data komt uit DB, geladen in `useCanvasState.js`

### 5.1 Werkbladen — geïmplementeerd

Werkbladen worden geactiveerd via `WERKBLAD_REGISTRY` in
`src/features/canvas/components/DeepDiveOverlay.jsx`. Eén regel toevoegen
voor een nieuw werkblad; geen `App.js`-wijziging nodig. Contract:
`{ canvasId, onClose, onManualSaved? }`. `key={canvasId}` zit op de
feature-root in DeepDiveOverlay (CLAUDE.md §4.1).

| Block-id | Folder | Status | Notities |
|---|---|---|---|
| `strategy`   | `src/features/strategie/` | ✅ live | StrategieWerkblad + StrategyOnePager (anker voor rapport-laag-styling) |
| `principles` | `src/features/richtlijnen/` | ✅ live | RichtlijnenWerkblad |
| `customers`  | `src/features/klanten/` | ✅ Fase 1+2+3 + UX-cyclus afgerond (stap 11.D/E/F/G/G.1-G.4, 2026-05-08 t/m 2026-05-10) | Zie blok onder de tabel voor volledige UX-cyclus-stand; buiten scope (volgende subs): fase 4 verbeterrichtingen + Roadmap-handover (11.H), klantreis-archetype (11.I), Type B visueel rapport (11.J post-MVP), dossier-driven AI-input (11.K na RFC-002), platform-pattern voor cross-werkblad-AI (F10) |
| `processes` / `people` / `technology` / `portfolio` | — | placeholder | DeepDiveOverlay valt terug op `GenericPlaceholder`-component |

**Klanten-werkblad-architectuur (stap 11.D-G + G.1-G.4):**
- Datamodel: 7 `cd_*`-tabellen (RFC-001 §2) + 1 audit-tabel; alle RLS-enabled met canvas-eigenaar + tenant-isolatie-pattern (anker `canvases`-policy); event-CHECK uitgebreid met `unrejected` (stap 11.G.3)
- API fase 1+2: `api/klanten/dimensions.js` + `items.js` + `pain_points.js` + `pain_point_couplings.js` via Path-2 `userScopedClient` uit `_template.js`; gedeelde archetype-schema-validatie in `_archetypes.js`
- API fase 3: `api/klanten/pattern_suggestions.js` (+ `unmark` / `restore`-actions stap 11.G.3) + `pattern_suggestions_generate.js` (Anthropic-call met cluster/paradox/positionering/overstijgend prompts, pure JSON-array parser, append-only events) + `pattern_suggestion_events.js` (audit-trail). 3 endpoints via Vercel rewrites geconsolideerd (Hobby 12-limiet)
- Frontend fase 1+2: `KlantenWerkblad` (root, hosting van `usePatternSuggestions` single source of truth) → `WerkruimteView` (fase-tabs, pass-through van suggestions-props) → `DimensieKolom` + `ItemModal` (fase 1) + `PijnpuntenView` + `PijnpuntCard` + `PijnpuntModal` (fase 2)
- Frontend fase 3: `AnalyseView` (4 AI-knoppen + counter + suggestion-list, `isInitialLoad`/`isReloading` distinctie + inline-spinner — stap 11.G.2) + `SuggestionCard` (TYPE_STYLES uit `patternTypeStyles.js`; Bewerk/Verwijder/Markeer als richting-rebrand — stap 11.G.3) + `SuggestionEditModal` + `RefineDeeperModal` + `EigenPatroonModal` + `CollapseSection` voor Gemarkeerd/Verwijderd-secties met restore-acties (stap 11.G.3)
- Frontend rapport-laag: `RapportView` (A4-landscape) krijgt suggestions via props van KlantenWerkblad (stap 11.G.4 — geen eigen hook-instance meer). AI-sectie: 3-koloms grid van **alle** accepted patterns (geen 6-limiet meer per stap 11.G.3), `includeInPrint`-toggle deblokkeerd + one-shot auto-enabled bij ≥1 accepted via `hasAutoEnabledRef`
- E2E-infra: Playwright + `playwright.config.js` + `global-setup.js` storageState + `helpers/test-canvas.js` Path-2-creds; test-account `keessmaling+test@gmail.com` (KF tenant_admin); `.env.test` gitignored; J1-blueprint PASS 13-step in 5.4s tegen productie (stap 11.G.1)
- 4 prompts (`prompt.klanten.{cluster,paradox,positionering,overstijgend}`) zijn `tenant_overridable=true` per ADR-002 niveau 1+3 — branche/methode-positionering kan legitiem per consultancy-tenant verschillen
- RLS-tests: `tests/rls/cd_klanten_werkblad.sql` (9 tests, RFC-001 §7); cd_pattern_suggestions cross-tenant geverifieerd in stap 11.G sprint-afsluit
- RTL: 24/24 PASS over KlantenWerkblad.flow + PijnpuntenView.flow + AnalyseView.flow (mocks op service-laag, refactor-veilig)
- Label-corpus: 140 totaal `label.klanten.*`-keys (incl. 6 nieuwe `klanten.analyse.helper.*` stap 11.G.2 + 6 nieuwe collapse-keys stap 11.G.3)

---

## 6. MIGRATIES — Veiligheidsregels

**Altijd** bij `app_config` INSERTs de `category` kolom meegeven (NOT NULL!):

```sql
-- ✅ Correct
INSERT INTO app_config (key, category, description, value) VALUES (...)

-- ❌ Fout — mist category → hele migratie rolt terug
INSERT INTO app_config (key, value) VALUES (...)
```

Gebruik altijd `IF NOT EXISTS` en `DROP POLICY IF EXISTS` voor idempotente migraties.

Controleer altijd voor commit: zijn alle NOT NULL kolommen aanwezig in elke INSERT?

---

## 7. CHECKLIST — Bij elke nieuwe feature

Doorloop dit vóór je code schrijft:

- [ ] Welke labels gebruik ik? → `appLabel()` + `LABEL_FALLBACKS` + migratie
- [ ] **Boy-scout:** hardcoded UI-strings in dezelfde JSX-blok als je wijziging meteen migreren naar `appLabel()` — niet vereist over het hele bestand, wel binnen de aangrenzende JSX
- [ ] Welke data laad ik? → service aanmaken of uitbreiden, nooit direct in component
- [ ] Past dit in een bestaand component of maak ik een nieuw bestand?
- [ ] Als ik data toevoeg aan `useCanvasState`: ook toevoegen aan de public API return
- [ ] Staat de feature-root met `key={canvasId}`? Is async state-handling volgens sectie 4?
- [ ] Kan ik deployen via `./deploy-prod.sh`?
- [ ] Worden bestaande docs (`CLAUDE.md` compliance status, `TECH_DEBT.md`) geraakt door deze change? → in dezelfde commit meenemen
- [ ] Is dit een Issue, Jam-opname, of TECH_DEBT-item volgens `WORKFLOW.md`?

---

## 8. TECHNISCHE STACK (referentie)

- **Frontend**: React CRA + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + RLS + Auth)
- **Deploy**: Vercel — prod via `./deploy-prod.sh`
- **Prod URL**: https://kingfisher-btcprod.vercel.app
- **DB tabellen (kern)**: `canvases`, `strategy_core`, `strategic_themes`, `guidelines`, `guideline_analysis`, `app_config`
- **AppConfig**: `label.*` → UI-labels, `prompt.*` → AI-prompts, `setting.*` → configuratie
- **Auth**: Supabase Auth, RLS op alle tabellen

---

## 9. DO-NOT-TOUCH zonder overleg

- Migraties die al gedeployed zijn (nooit editen, altijd nieuwe migratie)
- `deploy-prod.sh` zelf
- RLS policies op bestaande tabellen (breekt productie-data)
- Bestaande labels in `LABEL_FALLBACKS` verwijderen (alleen toevoegen)
- Het service-contract (`{ data, error }`) in één keer omgooien — incrementeel, bij features die je toch aanraakt

---

## 10. OPEN PUNTEN / TECHNISCHE SCHULD

Gedetailleerde lijst staat in `TECH_DEBT.md`. Korte versie:

- `strategyManual` wordt geladen uit `full.data?.strategy?.details?.manual` (oud JSONB-systeem) — nog niet gemigreerd naar `strategy_core` tabel. Verklaart waarom canvas strategy preview soms leeg is bij herstart. Bij migratie: ook sectie 4 toepassen (race-guards + reset).
- AI-gegenereerde samenvatting ("Stip op de Horizon") — ✅ opgelost per 2026-04-23. `samenvatting` wordt geladen uit `strategy_core` en getoond in `StrategyStatusBlock`.
- Compliance-gaps uit sectie 4.6 (prioriteit 4.2 en 4.4).
- Demo-omgeving niet beschikbaar per 2026-04-22. Eerdere demo-alias 
  (`kingfisher-btcdemo.vercel.app`) verwijderd omdat hij naar oude 
  deployment wees. Nieuwe demo-architectuur gepland — zie TECH_DEBT.md P5.
- Inzichten-patroon vastgelegd in `INZICHTEN_DESIGN.md` — generiek analyse-
  component voor alle werkbladen. Vervangt huidige "Strategisch Advies" /
  "Richtlijnen Advies" overlays. Zie TECH_DEBT.md P4.
- Tenant-content-laag (ADR-002 niveau 1) — ✅ live per 2026-05-05 (master
  `92ccb24`). Sectie 3C beschrijft de huidige werking. Open subitems: 
  `prompt.improve.system` ontbreekt nog als DB-key (fallback in
  `api/improve.js` werkt wél met tokens), i18n-mismatch op werkbladen 
  (`appLabel` is monolinguaal-by-design — F-18, P11), en TLB-branding-
  finetune (P12). Zie `TECH_DEBT.md`.
- Klanten & Dienstverlening werkblad — ✅ Fase 1+2+3 + UX-cyclus afgerond
  per 2026-05-10. Master-merge-keten: `30b16ae` (11.G fase 3 AI-analyse) +
  `a89be72` (Vercel Hobby 12-limit deploy-blocker fix via 3 rewrites) +
  `ea94327` (11.G.1 E2E-Playwright-infra) + `777b9e8` (11.G.2 F4 reload-
  flicker + F5 helper-tekst + B3 ItemModal a11y) + `8567545` (11.G.3 F7
  rapport-volledigheid + F8 collapse marked/deleted + F9 rebrand
  Bewerk/Verwijder/Markeer als richting) + `ded1959` (11.G.4 F11 RapportView-
  sync via single source of truth). Laatste deploy: `dpl_DCu3c9H7shR5ZHe4FxKe1ND9jBRR`
  op `kingfisher-btcprod.vercel.app`. Sectie 5.1 + 7 `cd_*`-tabellen + 9
  RLS-tests + cross-tenant cd_pattern_suggestions groen + RTL 24/24 PASS.
  Open subitems (3 P3 uit 11.G, blijven open): twee-traps-summarisation
  voor grote canvas (>8K chars context-payload — fallback nu één-traps-
  call), parse-fout-pad bij malformed AI-output (logged server-side, geen
  audit-trail-suggestion rij), `PROMPT_VERSION="11G-v1"` als string-
  literal i.p.v. DB-veld voor versie-tracking. 2 P3 uit 11.G.1:
  wachtwoord-rotatie + test-tenant-isolatie zodra eerste echte klant
  onboardt. Zie `tech_debt.md`.
- Klanten-werkblad **fase 4 (stap 11.H)** — instructie volgt zodra
  reviewer 'm schrijft. Scope: verbeterrichtingen + Roadmap-handover stub.
  `cd_improvement_intents`-tabel staat klaar uit RFC-001.
- **Stap 11.G.5 J2+J3 Playwright-specs** — dedicated mini-sprint. Drie
  keer boy-scout overgeslagen (G.1, G.2, G.3) — patroon is duidelijk,
  eigen sessie nodig. Niet acuut.
- **RFC-002 dossier-driven AI-input** — architect-opdracht ligt in
  `platform/handoff/to-architect/`. Niet bouwer-werk tot RFC akkoord-
  bevonden + 11.K-instructie geschreven.
- Vervolg-sprints (vooruitkijk, niet acuut): klantreis-archetype (11.I),
  Type B visueel rapport (11.J post-MVP), platform-pattern voor cross-
  werkblad-AI (F10), P13 rapport-architectuur als platform-laag.

---

## 11. VERSE-SESSIE-STARTROUTINE

Bij een verse Claude Code-sessie (nieuwe instance, geen context):

1. Lees **CLAUDE.md** (deze file) — actuele werkblad-status in §5.1, open
   punten in §10
2. Lees **WORKFLOW.md** — sprint-rituelen, instruction/result-handoff-
   pattern, Type 1-9 review-disciplines
3. Lees **tech_debt.md** — open P3/P4-items + done-log (recente sprint-
   afsluitingen)
4. Check **`handoff/to-builder/`** — pending instructies (oudste eerst);
   `archive/` is afgehandeld
5. Bij twijfel over scope: question-file naar reviewer in
   `handoff/to-reviewer/` (niet meteen code schrijven)

### Huidige hoofd-state (per einde 2026-05-10)

| Aspect | Waarde |
|---|---|
| Laatste deploy | `dpl_DCu3c9H7shR5ZHe4FxKe1ND9jBRR` (10 mei) op `kingfisher-btcprod.vercel.app` |
| Master HEAD | `ded1959` — Stap 11.G.4 F11 RapportView-sync |
| Test-credentials | `keessmaling+test@gmail.com` / staat in `.env.test` (gitignored) — KF tenant_admin |
| E2E-suite | `npm run test:e2e` — J1-blueprint live, J2/J3 nog niet (mini-sprint 11.G.5) |
| RTL | 24/24 PASS over 3 klanten-suites |
| Endpoint-budget Vercel | 12/12 (Hobby), 3 endpoints geconsolideerd via rewrites |

### Verwachte volgende stappen

- **Stap 11.H** — Klanten-fase 4 verbeterrichtingen + Roadmap-handover
  (instructie volgt van reviewer)
- **Stap 11.G.5** — J2+J3 Playwright-specs als mini-sprint (niet acuut)
- **Stap 11.K** — Dossier-driven AI-input, wacht op RFC-002 akkoord
  (architect-werk parallel)