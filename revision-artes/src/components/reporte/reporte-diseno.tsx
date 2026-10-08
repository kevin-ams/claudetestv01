import { ESTADOS } from "@/lib/domain/types";
import type { ArteReporte, Reporte } from "@/lib/domain/reporte";
import { driveImageUrl, driveOpenUrl, parseDriveUrl } from "@/lib/drive";
import { fechaHora, formatFecha } from "@/lib/format";
import { Logo } from "@/components/logo";
import { CasillaCambio } from "./casilla-cambio";

/**
 * Reporte de cambios para Diseño (imprimible). Se usa en el admin y en el
 * enlace de solo lectura que se comparte con Diseño.
 */
export function ReporteDiseno({
  reporte,
  soloCambios,
  token,
}: {
  reporte: Reporte;
  soloCambios: boolean;
  /** Enlace de Diseño: con token el checklist se puede marcar. */
  token?: string;
}) {
  const { campana, facultad, artes, totales } = reporte;
  return (
    <article className="reporte mx-auto flex w-full max-w-5xl flex-col gap-6 bg-white p-6 text-[var(--ges-charcoal)] shadow-sm sm:rounded-3xl sm:p-10 print:max-w-none print:p-0 print:shadow-none">
      <header className="flex flex-col gap-4 border-b-4 border-[var(--ges-royal)] pb-5">
        <div className="flex items-center gap-3">
          <Logo size={44} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ges-royal)]">
              GES · Marketing Digital
            </p>
            <h1 className="text-2xl font-bold leading-tight">Reporte de cambios para diseño</h1>
          </div>
        </div>
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
          <Dato titulo="Campaña" valor={campana.nombre} />
          <Dato titulo="Facultad" valor={facultad.nombre} />
          <Dato titulo="Generado" valor={fechaHora.format(new Date())} />
        </dl>
        {campana.descripcion && <p className="text-sm text-muted">{campana.descripcion}</p>}
        <div className="flex flex-wrap gap-3 text-sm">
          <Resumen numero={totales.conCambios} texto={totales.conCambios === 1 ? "arte con cambios" : "artes con cambios"} fuerte />
          <Resumen numero={totales.puntos} texto={totales.puntos === 1 ? "punto por corregir" : "puntos por corregir"} />
          <Resumen numero={totales.artes} texto={totales.artes === 1 ? "arte en la campaña" : "artes en la campaña"} />
          {totales.requeridos > 0 && (
            <Resumen numero={totales.hechos} texto={`de ${totales.requeridos} cambios listos`} listo={totales.hechos === totales.requeridos} />
          )}
        </div>
      </header>

      {artes.length === 0 ? (
        <p className="rounded-2xl bg-[var(--ges-lavender)] p-8 text-center text-sm">
          {soloCambios
            ? "🎉 No hay artes con cambios solicitados en esta campaña."
            : "Esta campaña aún no tiene artes."}
        </p>
      ) : (
        artes.map((a, i) => <ArteBloque key={a.id} arte={a} indice={i + 1} token={token} />)
      )}

      <footer className="border-t border-[var(--ges-periwinkle)] pt-4 text-xs text-muted">
        Los números de la imagen corresponden a la lista de cambios. Marca cada cambio al terminarlo en el enlace
        del reporte; al completar un arte, sube el archivo corregido a Drive para que Marketing Digital publique
        la nueva versión.
      </footer>
    </article>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{titulo}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}

function Resumen({ numero, texto, fuerte, listo }: { numero: number; texto: string; fuerte?: boolean; listo?: boolean }) {
  const color = listo ? "bg-[#dcfce7] text-[#15803d]" : fuerte ? "bg-[var(--ges-royal)] text-white" : "bg-[var(--ges-lavender)]";
  return (
    <span className={`rounded-full px-3 py-1 ${color} print:border print:border-[var(--ges-periwinkle)]`}>
      {listo && "✓ "}
      <strong>{numero}</strong> {texto}
    </span>
  );
}

function Hecho({ marca }: { marca?: { por: string; en: string } }) {
  if (!marca) return null;
  return (
    <span className="ml-1 inline-block rounded-full bg-[#dcfce7] px-2 text-[11px] font-semibold text-[#15803d] no-underline">
      ✓ {marca.por ? marca.por : "Hecho"}
    </span>
  );
}

function ArteBloque({ arte, indice, token }: { arte: ArteReporte; indice: number; token?: string }) {
  const ref = parseDriveUrl(arte.drive_url);
  const estado = ESTADOS[arte.estado];
  const color = { warning: "#a15c07", success: "#15803d", danger: "#b91c1c" }[estado.color];
  const hayCambios = arte.puntos.length > 0 || arte.comentarios.length > 0;
  const requeridos = arte.puntos.length + arte.comentarios.length;
  const hechos =
    arte.puntos.filter((p) => arte.marcas[`p:${p.id}`]).length +
    arte.comentarios.filter((c) => arte.marcas[`c:${c.id}`]).length;
  const completo = requeridos > 0 && hechos === requeridos;

  return (
    <section
      className={`break-inside-avoid rounded-2xl border p-5 ${completo ? "border-[#86efac]" : "border-[var(--ges-periwinkle)]"}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold leading-snug">
            {indice}. {arte.titulo}
          </h2>
          <p className="text-sm text-muted">
            Versión actual v{arte.version}
            {arte.carrera && ` · ${arte.carrera}`}
            {arte.formato && ` · ${arte.formato}`}
            {arte.fecha_publicacion && ` · Publicación: ${formatFecha(arte.fecha_publicacion)}`}
          </p>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs font-bold" style={{ color, borderColor: color }}>
          {estado.label}
        </span>
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,320px)_1fr] print:grid-cols-[260px_1fr]">
        <div className="flex flex-col gap-2">
          {ref?.type === "file" ? (
            <div className="relative self-start overflow-hidden rounded-xl bg-[var(--ges-lavender)]">
              {/* Imagen servida por Google Drive; los puntos van en porcentaje. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={driveImageUrl(ref)}
                alt={arte.titulo}
                referrerPolicy="no-referrer"
                className="block h-auto max-h-[420px] w-auto max-w-full"
              />
              {arte.puntos.map((p) => (
                <span
                  key={p.id}
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[var(--ges-royal)] text-[11px] font-bold text-white shadow print:shadow-none"
                >
                  {p.numero}
                </span>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-[var(--ges-lavender)] p-6 text-center text-xs text-muted">Carpeta de Drive</div>
          )}
          {ref && (
            <a href={driveOpenUrl(ref)} target="_blank" rel="noreferrer" className="break-all text-xs text-[var(--ges-royal)] underline">
              Abrir archivo actual en Drive ↗
            </a>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {hayCambios ? (
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--ges-royal)]">Cambios a realizar</h3>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${completo ? "bg-[#dcfce7] text-[#15803d]" : "bg-[var(--ges-lavender)]"}`}
                >
                  {completo ? "✓ Todos listos" : `${hechos} de ${requeridos} listos`}
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {arte.puntos.map((p) => (
                  <li key={p.id} className="flex gap-3 text-sm">
                    <CasillaCambio token={token} arteId={arte.id} item={`p:${p.id}`} marca={arte.marcas[`p:${p.id}`]} etiqueta={`Punto ${p.numero}: ${p.comentario}`} />
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ges-royal)] text-[11px] font-bold text-white">
                      {p.numero}
                    </span>
                    <span className={arte.marcas[`p:${p.id}`] ? "text-muted line-through" : ""}>
                      {p.comentario} <span className="text-xs text-muted">— {p.autor}</span>
                      <Hecho marca={arte.marcas[`p:${p.id}`]} />
                    </span>
                  </li>
                ))}
                {arte.comentarios.map((c) => (
                  <li key={c.id} className="flex gap-3 text-sm">
                    <CasillaCambio token={token} arteId={arte.id} item={`c:${c.id}`} marca={arte.marcas[`c:${c.id}`]} etiqueta={`Comentario general: ${c.comentario}`} />
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ges-periwinkle)] text-[11px] font-bold text-white">
                      G
                    </span>
                    <span className={arte.marcas[`c:${c.id}`] ? "text-muted line-through" : ""}>
                      <span className="whitespace-pre-wrap">{c.comentario}</span>{" "}
                      <span className="text-xs text-muted">— {c.autor} (comentario general)</span>
                      <Hecho marca={arte.marcas[`c:${c.id}`]} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted">
              {arte.estado === "aprobado" ? "Aprobado: sin cambios pendientes." : "Sin cambios solicitados en esta versión."}
            </p>
          )}

          {arte.descripcion && (
            <div>
              <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">Copy / indicaciones</h3>
              <p className="whitespace-pre-wrap rounded-xl bg-[var(--ges-lavender)] p-3 text-sm">{arte.descripcion}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
