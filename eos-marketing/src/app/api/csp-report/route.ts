/**
 * Recibe los reportes de la CSP (modo "solo reporte") y los deja en los logs de Netlify para afinar la política.
 * Es público (lo llama el navegador sin sesión), acepta poco texto y no guarda nada en la base.
 */
export async function POST(req: Request) {
  const text = (await req.text().catch(() => "")).slice(0, 4000);
  try {
    const body = JSON.parse(text) as { "csp-report"?: Record<string, unknown> } | Record<string, unknown>[];
    const reports = Array.isArray(body) ? body.map((r) => (r.body ?? r) as Record<string, unknown>) : [body["csp-report"] ?? {}];
    for (const r of reports.slice(0, 5)) {
      const directive = r["violated-directive"] ?? r["effectiveDirective"] ?? r["effective-directive"];
      const blocked = r["blocked-uri"] ?? r["blockedURL"];
      const page = String(r["document-uri"] ?? r["documentURL"] ?? "").replace(/\?.*$/, "");
      console.warn("[csp]", JSON.stringify({ directive, blocked, page }));
    }
  } catch {
    // Reporte con otro formato: se ignora.
  }
  return new Response(null, { status: 204 });
}
