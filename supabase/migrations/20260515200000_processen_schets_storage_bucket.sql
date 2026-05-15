-- 11.M.1 D4 — Supabase Storage bucket voor processen-schets-uploads
-- Applied via Supabase-MCP apply_migration genaamd `processen_schets_storage_bucket`.
-- Bestand in repo voor git-history; SQL identiek aan applied versie.
-- RFC-005 §6.4 vo_schets_uploads + 11.M-diagnose stop-en-vraag #3 + 11.M.1-diagnose #3 akkoord.
-- Idempotent: ON CONFLICT (id) DO UPDATE + DROP POLICY IF EXISTS.

-- 1. Bucket aanmaken (private — alleen auth + RLS-toegang)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'processen-schets',
  'processen-schets',
  false,
  5242880,                                  -- 5MB max (matcht vo_schets_uploads.file_size_bytes CHECK)
  ARRAY['image/png', 'image/jpeg']          -- PNG/JPG only (matcht mime_type CHECK)
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg'];

-- 2. RLS-policies op storage.objects voor deze bucket
-- Path-pattern: {canvas_id}/{filename} — eerste path-segment = canvas_id voor RLS-isolatie

DROP POLICY IF EXISTS "processen_schets_select_eigenaar" ON storage.objects;
CREATE POLICY "processen_schets_select_eigenaar"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'processen-schets'
    AND (
      (storage.foldername(name))[1]::uuid IN (
        SELECT id::text::uuid FROM canvases WHERE user_id = auth.uid()
      )
      OR current_user_role() = 'tenant_admin'
    )
  );

DROP POLICY IF EXISTS "processen_schets_insert_eigenaar" ON storage.objects;
CREATE POLICY "processen_schets_insert_eigenaar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'processen-schets'
    AND (
      (storage.foldername(name))[1]::uuid IN (
        SELECT id::text::uuid FROM canvases WHERE user_id = auth.uid()
      )
      OR current_user_role() = 'tenant_admin'
    )
  );

DROP POLICY IF EXISTS "processen_schets_delete_eigenaar" ON storage.objects;
CREATE POLICY "processen_schets_delete_eigenaar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'processen-schets'
    AND (
      (storage.foldername(name))[1]::uuid IN (
        SELECT id::text::uuid FROM canvases WHERE user_id = auth.uid()
      )
      OR current_user_role() = 'tenant_admin'
    )
  );
-- Geen UPDATE-policy = files immutable na upload (DELETE+INSERT-vervang werkt wel)
