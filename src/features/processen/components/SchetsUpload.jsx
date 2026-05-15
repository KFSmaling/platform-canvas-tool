/**
 * SchetsUpload — direct-browser Supabase Storage upload voor vo_schets_uploads
 * (11.M.1 block-4 D4).
 *
 * RFC-005 §6.4: PNG/JPG only, max 5MB. Direct-upload vermijdt Vercel serverless
 * payload-limiet (10MB). Bucket `processen-schets` met RLS-policies werd
 * aangemaakt via Supabase-MCP migratie 20260515200000.
 *
 * Path-pattern: {canvas_id}/{timestamp}-{random}.{ext}
 * Na succesvolle upload → INSERT vo_schets_uploads metadata via
 * existing server-endpoint `schets_upload_metadata`.
 *
 * Props:
 *  - canvasId: voor path-prefix + RLS-tenant-resolutie
 *  - existingUploads: array van metadata-rijen → preview-thumbnails + delete
 *  - onUploaded(): callback na succesvolle metadata-INSERT (parent reload)
 *  - onDeleted(): callback na delete
 */

import React, { useState, useRef } from "react";
import { Upload, Loader2, Trash2, ImageIcon, AlertCircle } from "lucide-react";
import { supabase } from "../../../shared/services/supabase.client";
import * as svc from "../services/processen.service";

const ACCEPTED_MIME = "image/png,image/jpeg";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export default function SchetsUpload({ canvasId, existingUploads = [], onUploaded, onDeleted }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    // Client-side validatie (server-CHECK + RLS valideren ook)
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Alleen PNG of JPG toegestaan");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`Bestand groter dan 5MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return;
    }
    if (!canvasId) {
      setError("Geen canvasId beschikbaar");
      return;
    }
    if (!supabase) {
      setError("Supabase niet geconfigureerd");
      return;
    }

    setUploading(true);
    setProgress(20);

    // Path: {canvas_id}/{timestamp}-{random}.{ext}
    const ext = file.name.split(".").pop()?.toLowerCase() || (file.type === "image/png" ? "png" : "jpg");
    const safeBase = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const storagePath = `${canvasId}/${safeBase}`;

    // Direct upload via Supabase Storage SDK
    const { error: upErr } = await supabase
      .storage
      .from("processen-schets")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
    setProgress(60);

    if (upErr) {
      setUploading(false);
      setError(upErr.message || "Upload mislukt");
      return;
    }

    // Metadata-INSERT via server-endpoint (Path-2 RLS bevestigt canvas_eigenaar)
    const { error: metaErr } = await svc.createSchetsUploadMetadata({
      canvas_id: canvasId,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      file_size_bytes: file.size,
    });
    setProgress(100);
    setUploading(false);

    if (metaErr) {
      // Rollback: storage-object verwijderen om weeshouden te voorkomen
      await supabase.storage.from("processen-schets").remove([storagePath]).catch(() => {});
      setError(metaErr.message || "Metadata opslaan mislukt");
      return;
    }

    if (inputRef.current) inputRef.current.value = "";
    onUploaded?.();
  }

  async function handleDelete(upload) {
    if (!confirm("Schets verwijderen?")) return;
    // Eerst storage-object verwijderen, dan metadata-rij (rollback bij faal)
    const { error: storErr } = await supabase.storage
      .from("processen-schets")
      .remove([upload.storage_path]);
    if (storErr) {
      setError(`Storage delete faalde: ${storErr.message}`);
      return;
    }
    // Metadata-rij verwijderen via standaard delete-endpoint (geen schets_upload_delete; gebruik direct table)
    const { error: metaErr } = await supabase.from("vo_schets_uploads").delete().eq("id", upload.id);
    if (metaErr) {
      setError(`Metadata delete faalde: ${metaErr.message}`);
      return;
    }
    onDeleted?.();
  }

  function getPublicUrl(storagePath) {
    // Bucket is private — gebruik signed URL voor preview
    const { data } = supabase.storage.from("processen-schets").getPublicUrl(storagePath);
    return data?.publicUrl;
  }

  return (
    <div data-testid="schets-upload-wrap" className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME}
          onChange={handleFileChange}
          disabled={uploading}
          data-testid="schets-upload-input"
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || !canvasId}
          data-testid="schets-upload-button"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest transition-colors ${
            uploading
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-[var(--color-accent)] text-[var(--color-primary)] hover:bg-[var(--color-accent-hover)]"
          }`}
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          {uploading ? `Uploaden… ${progress}%` : "Schets uploaden"}
        </button>
        <span className="text-[10px] text-slate-400">PNG/JPG, max 5MB</span>
      </div>

      {error && (
        <div data-testid="schets-upload-error" className="flex items-start gap-2 px-3 py-2 text-xs rounded border bg-red-50 border-red-200 text-red-700">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {existingUploads.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {existingUploads.map((u) => {
            const url = getPublicUrl(u.storage_path);
            return (
              <div
                key={u.id}
                data-testid={`schets-thumb-${u.id}`}
                className="relative border border-slate-200 rounded overflow-hidden bg-slate-50 group"
              >
                {url ? (
                  <img
                    src={url}
                    alt={u.file_name}
                    className="w-full aspect-video object-cover"
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                ) : (
                  <div className="w-full aspect-video flex items-center justify-center text-slate-400">
                    <ImageIcon size={32} />
                  </div>
                )}
                <div className="px-2 py-1 bg-white border-t border-slate-200">
                  <p className="text-[10px] text-slate-700 truncate" title={u.file_name}>{u.file_name}</p>
                  <p className="text-[9px] text-slate-400">{(u.file_size_bytes / 1024).toFixed(0)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(u)}
                  data-testid={`schets-delete-${u.id}`}
                  aria-label="Verwijder schets"
                  className="absolute top-1 right-1 p-1 rounded bg-white/80 text-red-600 opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-opacity"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
