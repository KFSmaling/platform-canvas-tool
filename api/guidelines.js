/**
 * Guidelines AI — Leidende Principes generatie & analyse
 *
 * mode = "generate"     → genereert principes voor één segment (3-5 stuks)
 * mode = "advies"       → analyseert alle principes op coherentie & dekking
 * mode = "implications" → genereert Stop/Start/Continue voor één principe
 */

const { requireAuth } = require("./_auth");
const { renderPrompt, getTenantVars, userScopedClient } = require("./_template");

const MODEL   = "claude-sonnet-4-5";
const HEADERS = (key) => ({
  "Content-Type": "application/json",
  "x-api-key": key,
  "anthropic-version": "2023-06-01",
});

function safeParseJSON(raw, context) {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`Onverwacht AI-formaat — geen JSON gevonden (${context})`);
  try {
    return JSON.parse(m[0]);
  } catch (e) {
    console.error(`[guidelines/${context}] JSON parse failed:`, e.message, "raw length:", raw.length);
    throw new Error(`AI-antwoord was onvolledig of ongeldig (${context}). Probeer opnieuw.`);
  }
}

// T3: 5-segmenten-architectuur (was 4: organisatie gesplitst in processen + mensen)
const SEGMENT_CONTEXT = {
  generiek:    "Strategie & Governance — principes die strategische kaders, besluitvorming en organisatierichtlijnen bepalen",
  klanten:     "Klanten & Markt — principes die dienstverlening, klantrelaties en marktbenadering sturen",
  processen:   "Processen & Organisatie — principes die werkstromen, governance, samenwerking en operationele inrichting sturen",
  mensen:      "Mensen & Competenties — principes die leiderschap, cultuur, vaardigheden en medewerkersbeleving bepalen",
  it:          "Technologie & Data — principes die architectuurkeuzes, data-governance en digitale transformatie sturen",
};

function buildStrategyContext(core, items, themas) {
  const tag = (t) => items.filter(i => i.tag === t).map(i => `- ${i.content}`).join("\n") || "(geen)";
  const themasCtx = themas.length > 0
    ? themas.map((t, i) => `${i + 1}. ${t.title}`).join("\n")
    : "(geen thema's aangemaakt)";

  return `IDENTITEIT
Missie:      ${core.missie      || "(niet ingevuld)"}
Visie:       ${core.visie       || "(niet ingevuld)"}
Ambitie:     ${core.ambitie     || "(niet ingevuld)"}
Kernwaarden: ${(core.kernwaarden || []).join(", ") || "(niet ingevuld)"}

SWOT ANALYSE
Kansen:       ${tag("kans")}
Bedreigingen: ${tag("bedreiging")}
Sterktes:     ${tag("sterkte")}
Zwaktes:      ${tag("zwakte")}

STRATEGISCHE THEMA'S
${themasCtx}`;
}

// ── MODE: GENERATE ────────────────────────────────────────────────────────────
async function generateForSegment(segment, core, items, themas, apiKey, systemOverride, languageInstruction, tenantVars = {}) {
  const segCtx  = SEGMENT_CONTEXT[segment] || segment;
  const context = buildStrategyContext(core, items, themas);

  const rawSystemRaw = systemOverride || `Je bent een Senior Organisatieadviseur gespecialiseerd in bedrijfstransformaties. Je genereert Leidende Principes die de strategie vertalen naar concreet gedrag.

SEGMENT: ${segCtx}

REGELS:
- Titel: kort, actief, richtinggevend (max 8 woorden)
- Toelichting: strategische motivatie (2-3 zinnen)
- Stop/Start/Continue: concrete, specifieke gedragsveranderingen (1-2 zinnen elk)
- Vertaal SWOT-zwaktes naar beschermende principes
- Vertaal kansen en sterktes naar activerende principes
- {taal_instructie}

OUTPUT FORMAT: Exact JSON, geen uitleg erbuiten:
{
  "guidelines": [
    {
      "title": "Korte activerende zin",
      "description": "Toelichting en motivatie...",
      "implications": {
        "stop": "Concreet te stoppen gedrag",
        "start": "Nieuw te starten gedrag",
        "continue": "Te versterken gedrag"
      }
    }
  ]
}

Genereer 3-5 principes voor het segment ${segment.toUpperCase()}.`;

  const rawSystem = renderPrompt(rawSystemRaw, tenantVars);
  const system = rawSystem.replace(/\{taal_instructie\}/g, languageInstruction);
  const user   = `Genereer Leidende Principes voor segment "${segment.toUpperCase()}".\n\n${context}`;

  const res  = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: HEADERS(apiKey),
    body: JSON.stringify({ model: MODEL, max_tokens: 3000, system, messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "AI fout (generate)");
  const raw  = (data.content || []).map(c => c.text || "").join("").trim();
  const parsed = safeParseJSON(raw, "generate");
  return parsed.guidelines || [];
}

// ── MODE: ADVIES ──────────────────────────────────────────────────────────────
async function generateAdvies(guidelines, themas, core, apiKey, systemOverride, languageInstruction, tenantVars = {}) {
  // T3: 5-segmenten-architectuur
  const segments = ["generiek", "klanten", "processen", "mensen", "it"];
  const guidelinesCtx = segments.map(seg => {
    const gs = guidelines.filter(g => g.segment === seg);
    if (gs.length === 0) return `${seg.toUpperCase()}: (geen principes)`;
    return `${seg.toUpperCase()}:\n${gs.map(g => `  - ${g.title}${g.description ? ` — ${g.description.slice(0, 80)}…` : ""}`).join("\n")}`;
  }).join("\n\n");

  const themasCtx = themas.length > 0
    ? themas.map((t, i) => `${i + 1}. ${t.title}`).join("\n")
    : "(geen strategische thema's)";

  const rawSystem = systemOverride || `Je bent een kritische Senior Adviseur. Je analyseert Leidende Principes op coherentie, volledigheid en interne consistentie.

FOCUS:
- Segment-balans: zijn alle 5 segmenten (Generiek / Klanten / Processen / Mensen / IT) voldoende en gelijkwaardig gedekt?
- Interne consistentie: botsen principes met elkaar (bijv. "Autonomie" vs "Strikte Compliance")?
- Thema-dekking: zijn alle strategische thema's verankerd in de richtlijnen?
- Concreetheid: zijn Stop/Start/Continue acties specifiek en actionabel?
- Volledigheid: welke kritische gebieden ontbreken?
- {taal_instructie}

OUTPUT FORMAT: Exact JSON, 4-6 aanbevelingen:
{
  "recommendations": [
    { "type": "warning", "title": "Korte titel (max 6 woorden)", "text": "Concrete observatie in 1-2 zinnen." },
    { "type": "info",    "title": "...", "text": "..." },
    { "type": "success", "title": "...", "text": "..." }
  ]
}

type waarden: warning = urgent verbeterpunt, info = aandachtspunt/kans, success = sterkte`;

  const system = renderPrompt(rawSystem, tenantVars).replace(/\{taal_instructie\}/g, languageInstruction);
  const user   = `Analyseer de Leidende Principes en geef 4-6 prioritaire aanbevelingen.

AMBITIE: ${core.ambitie || "(niet ingevuld)"}

STRATEGISCHE THEMA'S:
${themasCtx}

LEIDENDE PRINCIPES PER SEGMENT:
${guidelinesCtx}`;

  const res  = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: HEADERS(apiKey),
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, system, messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "AI fout (advies)");
  const raw  = (data.content || []).map(c => c.text || "").join("").trim();
  return safeParseJSON(raw, "advies");
}

// ── MODE: IMPLICATIONS ────────────────────────────────────────────────────────
async function generateImplications(title, description, context, apiKey, systemOverride, languageInstruction, tenantVars = {}) {
  const rawSystem = systemOverride || `Je genereert Stop/Start/Continue acties voor een Leidend Principe.

STOP: Concreet gedrag dat gestopt moet worden om dit principe te leven (1-2 zinnen).
START: Nieuw gedrag dat ingevoerd moet worden als gevolg van dit principe (1-2 zinnen).
CONTINUE: Bestaand gedrag dat aansluit bij dit principe en versterkt moet worden (1-2 zinnen).

{taal_instructie}

OUTPUT FORMAT: Exact JSON:
{ "stop": "...", "start": "...", "continue": "..." }`;

  const system = renderPrompt(rawSystem, tenantVars).replace(/\{taal_instructie\}/g, languageInstruction);
  const user   = `Principe: "${title}"${description ? `\nToelichting: ${description}` : ""}${context ? `\nStrategische context: ${context}` : ""}`;

  const res  = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: HEADERS(apiKey),
    body: JSON.stringify({ model: MODEL, max_tokens: 400, system, messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "AI fout (implications)");
  const raw  = (data.content || []).map(c => c.text || "").join("").trim();
  return safeParseJSON(raw, "implications");
}

// ── MODE: LINK_THEMES ─────────────────────────────────────────────────────────
// Stuurt alle principes + thema's naar Claude; vraagt welke thema-indices
// duidelijk bij welk principe horen. Twijfelgevallen → lege array.
// Gebruikt indices (niet UUIDs) om hallucination te voorkomen.
async function linkThemes(guidelines, themas, apiKey, systemOverride, languageInstruction, tenantVars = {}) {
  if (!themas.length || !guidelines.length) return {};

  const themasCtx     = themas.map((t, i) => `${i}. "${t.title}"`).join("\n");
  const guidelinesCtx = guidelines.map((g, i) =>
    `${i}. [${(g.segment || "").toUpperCase()}] "${g.title}"${g.description ? ` — ${g.description.slice(0, 120)}` : ""}`
  ).join("\n");

  const rawSystem = systemOverride || `Je koppelt Leidende Principes aan Strategische Thema's op basis van inhoudelijke relevantie.

REGELS:
- Koppel ALLEEN bij een duidelijke, directe inhoudelijke relatie
- Bij twijfel of een zwakke relatie: geen koppeling — lege array
- Een principe kan aan meerdere thema's gekoppeld worden (max 3)
- Niet elk principe hoeft een koppeling te krijgen
- Gebruik uitsluitend de index-nummers uit de lijsten

OUTPUT: Exact JSON — één entry per principe (ook als de array leeg is):
{"links":{"<principe-index>":[<thema-index>, ...]}}`;

  const system = renderPrompt(rawSystem, tenantVars).replace(/\{taal_instructie\}/g, languageInstruction || "");

  const userMsg = `STRATEGISCHE THEMA'S:\n${themasCtx}\n\nLEIDENDE PRINCIPES:\n${guidelinesCtx}\n\nKoppel de principes aan de meest passende thema's.`;

  const res  = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: HEADERS(apiKey),
    body: JSON.stringify({ model: MODEL, max_tokens: 800, system, messages: [{ role: "user", content: userMsg }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "AI fout (link_themes)");
  const raw  = (data.content || []).map(c => c.text || "").join("").trim();
  const parsed = safeParseJSON(raw, "link_themes");

  // Vertaal indices → IDs
  const result = {};
  Object.entries(parsed.links || {}).forEach(([gIdxStr, tIdxs]) => {
    const g = guidelines[parseInt(gIdxStr)];
    if (!g) return;
    result[g.id] = (Array.isArray(tIdxs) ? tIdxs : [])
      .map(ti => themas[parseInt(ti)]?.id)
      .filter(Boolean);
  });
  return result;
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const user = await requireAuth(req, res);
  if (!user) return;

  const {
    mode,
    segment,
    core        = {},
    items       = [],
    themas      = [],
    guidelines  = [],
    title,
    description,
    context,
    systemPromptGenerate,
    systemPromptAdvies,
    systemPromptImplications,
    systemPromptLinkThemes,
    languageInstruction = "Schrijf ALTIJD in het Nederlands.",
  } = req.body || {};

  if (!mode) return res.status(400).json({ error: "Missing mode" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY niet geconfigureerd" });

  // Stap-7 fase-4: tenant-vars ophalen één keer per request
  const tenantVars = await getTenantVars(userScopedClient(req));

  try {
    if (mode === "generate") {
      if (!segment) return res.status(400).json({ error: "Missing segment" });
      const result = await generateForSegment(segment, core, items, themas, apiKey, systemPromptGenerate, languageInstruction, tenantVars);
      return res.status(200).json({ guidelines: result });
    }

    if (mode === "advies") {
      const result = await generateAdvies(guidelines, themas, core, apiKey, systemPromptAdvies, languageInstruction, tenantVars);
      return res.status(200).json(result);
    }

    if (mode === "implications") {
      if (!title) return res.status(400).json({ error: "Missing title" });
      const result = await generateImplications(title, description, context, apiKey, systemPromptImplications, languageInstruction, tenantVars);
      return res.status(200).json(result);
    }

    if (mode === "link_themes") {
      const result = await linkThemes(guidelines, themas, apiKey, systemPromptLinkThemes, languageInstruction, tenantVars);
      return res.status(200).json({ links: result });
    }

    return res.status(400).json({ error: `Onbekende mode: ${mode}` });
  } catch (err) {
    console.error("[guidelines]", err.message);
    return res.status(500).json({ error: err.message });
  }
};
