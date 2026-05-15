/**
 * api/documents.js — Geconsolideerde document-pipeline dispatcher
 *
 * Vervangt voorheen 3 aparte endpoints (extract.js + embed.js + parse.js)
 * om endpoint-budget vrij te maken voor 11.M Processen & Organisatie-werkblad
 * (en RFC-006 Org/Mensen + RFC-008 IT in de toekomst). Hobby 12-limit.
 *
 * Sub-routes (via ?_subpath=...):
 *   - extract → Anthropic-call met documentText (claude-sonnet-4)
 *   - embed   → OpenAI text-embedding-3-small (batch, max 100 teksten)
 *   - parse   → server-side PDF-parse via pdf-parse
 *
 * Auth: alle sub-routes vereisen requireAuth.
 *
 * Body-parser sizeLimit 10MB voor `parse` (PDF-uploads).
 */

const { requireAuth } = require("./_auth");

const handler = async function (req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const user = await requireAuth(req, res);
  if (!user) return;

  const subpath = req.query?._subpath;
  if (!subpath) {
    return res.status(400).json({ error: "Missing _subpath query parameter (extract|embed|parse)" });
  }

  try {
    if (subpath === "extract") return await handleExtract(req, res);
    if (subpath === "embed")   return await handleEmbed(req, res);
    if (subpath === "parse")   return await handleParse(req, res);
    return res.status(400).json({ error: `Onbekende subpath: ${subpath}` });
  } catch (err) {
    console.error("[api/documents] onverwachte fout:", err.message);
    return res.status(500).json({ error: err.message || "interne fout" });
  }
};

// ── Sub-route 1: extract (Anthropic-call) ───────────────────────────────────
async function handleExtract(req, res) {
  const { blockKey, documentText } = req.body || {};
  if (!blockKey || !documentText) {
    return res.status(400).json({ error: "Missing blockKey or documentText" });
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: documentText }],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return res.status(response.status).json({ error: data.error?.message || "API error" });
  }
  const text = (data.content || []).map(c => c.text || "").join("");
  return res.status(200).json({ text });
}

// ── Sub-route 2: embed (OpenAI embeddings) ──────────────────────────────────
async function handleEmbed(req, res) {
  const { texts } = req.body || {};
  if (!Array.isArray(texts) || texts.length === 0) {
    return res.status(400).json({ error: "Missing or empty texts array" });
  }
  if (texts.length > 100) {
    return res.status(400).json({ error: "Max 100 teksten per request" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY niet geconfigureerd" });

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texts,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("[api/documents:embed] OpenAI fout:", data.error?.message);
    return res.status(response.status).json({ error: data.error?.message || "OpenAI API fout" });
  }

  // Sorteer op index (OpenAI geeft altijd gesorteerd terug, maar voor zekerheid)
  const embeddings = data.data
    .sort((a, b) => a.index - b.index)
    .map(d => d.embedding);

  return res.status(200).json({ embeddings, model: data.model, usage: data.usage });
}

// ── Sub-route 3: parse (PDF server-side) ────────────────────────────────────
async function handleParse(req, res) {
  const { base64, filename } = req.body || {};
  if (!base64 || !filename) {
    return res.status(400).json({ error: "Missing base64 or filename" });
  }
  const ext = filename.split(".").pop().toLowerCase();
  if (ext !== "pdf") {
    return res.status(400).json({ error: `Bestandstype .${ext} wordt niet ondersteund via de server.` });
  }

  const pdfParse = require("pdf-parse/lib/pdf-parse.js");
  const buf = Buffer.from(base64, "base64");
  const data = await pdfParse(buf);
  const text = (data.text || "").trim();

  if (text.length < 30) {
    return res.status(422).json({ error: "PDF bevat geen leesbare tekst (mogelijk gescand of afbeelding-gebaseerd)." });
  }
  return res.status(200).json({ text });
}

// Body-parser sizeLimit 10MB voor PDF-uploads (parse sub-route)
handler.config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};

module.exports = handler;
