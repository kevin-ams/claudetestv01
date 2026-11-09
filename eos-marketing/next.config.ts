import type { NextConfig } from "next";

/**
 * Encabezados de seguridad (ISO 27001 8.26 / 8.28; OWASP ASVS 3.4 y 14.4).
 * La CSP va primero en modo "solo reporte": no bloquea nada y manda a /api/csp-report lo que bloquearía, para
 * afinarla con datos reales antes de aplicarla (ver docs/seguridad/aplicacion.md).
 */
const CSP = [
  "default-src 'self'",
  // Next.js y el tema usan scripts en línea; Clarity carga su script; el modelo de búsqueda por significado usa WASM.
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://www.clarity.ms https://*.clarity.ms https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.clarity.ms https://huggingface.co https://*.huggingface.co https://*.hf.co https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  // Otras herramientas (Ajustes › Otras herramientas) se muestran dentro de la app.
  "frame-src 'self' https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "report-uri /api/csp-report",
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Content-Security-Policy-Report-Only", value: CSP },
];

const nextConfig: NextConfig = {
  // Proyecto independiente dentro del repo: fija la raíz a esta carpeta.
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
  // PGlite carga su propio WASM; se ejecuta con el require nativo de Node.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    // Imágenes de anuncios (hasta 5 MB) se suben con Server Actions.
    serverActions: { bodySizeLimit: "6mb" },
  },
  // No anunciar la tecnología del servidor.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
