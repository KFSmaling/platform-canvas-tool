import { useAuth } from "../services/auth.service";

/**
 * useTheme — ontmantelt tenantTheme uit AuthContext.
 *
 * Geeft logo-URL's, merknaam en kleuren terug met generieke defaults
 * als fallback. Veilig aan te roepen vóór ThemeProvider de CSS-variabelen
 * heeft gezet (bijv. op het login-scherm of tijdens profileLoading).
 *
 * Gebruik:
 *   const { logoUrl, logoWhiteUrl, brandName } = useTheme();
 *   <img src={logoWhiteUrl} alt={brandName} />
 */
export function useTheme() {
  const { tenantTheme } = useAuth();

  // T1 OBS-14: fallbacks zijn nu PLATFORM-NEUTRAAL (was: KF-hardcoded).
  // - logoUrl/logoWhiteUrl: null bij ontbrekende tenant-config zodat LogoBrand
  //   text-fallback rendert (geen 404-ghost-image meer).
  // - primary/accent: charcoal + platform-amber als generieke defaults.
  return {
    logoUrl:          tenantTheme?.logo_url            ?? null,
    logoWhiteUrl:     tenantTheme?.logo_white_url      ?? null,
    brandName:        tenantTheme?.brand_name          ?? "Platform",
    productName:      tenantTheme?.product_name        ?? "Business Transformation Workbench",
    primaryColor:     tenantTheme?.primary_color       ?? "#0f172a",
    accentColor:      tenantTheme?.accent_color        ?? "#EF9F27",
    accentHoverColor: tenantTheme?.accent_hover_color  ?? "#d88c1e",
    successColor:     tenantTheme?.success_color       ?? "#2c7a4b",
    analysisColor:    tenantTheme?.analysis_color      ?? "#00AEEF",
    overlayColor:     tenantTheme?.overlay_color       ?? "#001f33",
    accentLightColor: tenantTheme?.accent_light_color  ?? "#fef3e2",
  };
}
