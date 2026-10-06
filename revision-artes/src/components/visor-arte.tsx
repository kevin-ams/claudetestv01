"use client";

import { useState } from "react";
import { Tabs } from "@heroui/react";
import { driveImageUrl, driveOpenUrl, drivePreviewUrl, parseDriveUrl } from "@/lib/drive";

export type PuntoVisor = {
  key: string;
  numero: number;
  x: number;
  y: number;
  /** guardado: ya enviado · atendido: resuelto en una versión nueva · borrador: aún sin enviar */
  tipo: "guardado" | "atendido" | "borrador";
};

const PIN: Record<PuntoVisor["tipo"], string> = {
  guardado: "bg-danger text-danger-foreground",
  atendido: "bg-success text-success-foreground",
  borrador: "bg-accent text-accent-foreground",
};

/**
 * Muestra el arte de Drive. En la pestaña "Imagen" se dibujan los puntos
 * numerados; si se pasa `onAddPoint`, un clic sobre la imagen agrega uno.
 * Las coordenadas se guardan en porcentaje para que no dependan del tamaño
 * de pantalla.
 */
export function VisorArte({
  driveUrl,
  title,
  puntos,
  onAddPoint,
  activo,
  onActivo,
  editando,
  renderEditor,
}: {
  driveUrl: string;
  title: string;
  puntos: PuntoVisor[];
  onAddPoint?: (x: number, y: number) => void;
  activo?: string | null;
  onActivo?: (key: string | null) => void;
  /** Punto cuyo editor flotante se muestra junto al pin. */
  editando?: string | null;
  renderEditor?: (key: string) => React.ReactNode;
}) {
  const ref = parseDriveUrl(driveUrl);
  const esImagen = ref?.type === "file";
  const [fallo, setFallo] = useState(false);
  const [tab, setTab] = useState<string>(esImagen ? "imagen" : "drive");

  if (!ref) {
    return <p className="text-sm text-danger">El enlace de Google Drive no es válido.</p>;
  }

  function agregar(e: React.MouseEvent<HTMLDivElement>) {
    if (!onAddPoint) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onAddPoint(Math.min(100, Math.max(0, x)), Math.min(100, Math.max(0, y)));
  }

  return (
    <div className="flex flex-col gap-2">
      <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Vista del arte">
            <Tabs.Tab id="imagen" isDisabled={!esImagen}>
              {onAddPoint ? "Marcar puntos" : "Imagen con puntos"}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="drive">
              Visor de Drive
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="imagen" className="pt-3">
          {fallo ? (
            <div className="rounded-xl bg-surface-secondary p-6 text-center text-sm text-muted">
              No se pudo cargar la imagen para marcar puntos. Revisa que el archivo esté compartido como
              “Cualquier persona con el enlace” o usa el visor de Drive.
            </div>
          ) : (
            <div className="flex justify-center overflow-hidden rounded-xl bg-surface-secondary">
              <div
                className={`relative inline-block select-none ${onAddPoint ? "cursor-crosshair" : ""}`}
                onClick={agregar}
                data-testid="lienzo-arte"
                data-guia="lienzo"
              >
                {/* Imagen servida por Google Drive: no pasa por el optimizador de Next. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={driveImageUrl(ref)}
                  alt={title}
                  referrerPolicy="no-referrer"
                  draggable={false}
                  onError={() => setFallo(true)}
                  className="block max-h-[75vh] w-auto max-w-full"
                />
                {puntos.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    aria-label={`Punto ${p.numero}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onActivo?.(activo === p.key ? null : p.key);
                    }}
                    onMouseEnter={() => onActivo?.(p.key)}
                    onMouseLeave={() => onActivo?.(null)}
                    style={{ left: `${p.x}%`, top: `${p.y}%` }}
                    className={`absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold shadow-md transition-transform ${PIN[p.tipo]} ${activo === p.key ? "z-10 scale-125" : ""}`}
                  >
                    {p.tipo === "atendido" ? "✓" : p.numero}
                  </button>
                ))}
                {editando &&
                  renderEditor &&
                  (() => {
                    const p = puntos.find((x) => x.key === editando);
                    if (!p) return null;
                    // Se abre hacia el lado con más espacio para no salirse de la imagen.
                    const style: React.CSSProperties = {
                      ...(p.x > 55 ? { right: `calc(${100 - p.x}% + 20px)` } : { left: `calc(${p.x}% + 20px)` }),
                      ...(p.y > 65 ? { bottom: `${100 - p.y}%` } : { top: `${p.y}%` }),
                    };
                    return (
                      <div
                        className="absolute z-20 w-64 max-w-[70%] cursor-auto"
                        style={style}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {renderEditor(p.key)}
                      </div>
                    );
                  })()}
              </div>
            </div>
          )}
          {onAddPoint && !fallo && (
            <p className="mt-2 text-xs text-muted">
              Haz clic sobre la imagen en el lugar exacto del cambio para agregar un punto numerado.
            </p>
          )}
        </Tabs.Panel>

        <Tabs.Panel id="drive" className="pt-3">
          <div className="overflow-hidden rounded-xl bg-surface-secondary">
            <iframe src={drivePreviewUrl(ref)} title={title} className="aspect-[4/3] w-full" allow="autoplay" />
          </div>
          {!esImagen && (
            <p className="mt-2 text-xs text-muted">Los puntos sobre la imagen solo están disponibles para archivos, no para carpetas.</p>
          )}
        </Tabs.Panel>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>¿No se ve? Debe estar compartido como “Cualquier persona con el enlace”.</span>
        <a href={driveOpenUrl(ref)} target="_blank" rel="noreferrer" className="font-medium text-accent underline">
          Abrir en Google Drive ↗
        </a>
      </div>
    </div>
  );
}
