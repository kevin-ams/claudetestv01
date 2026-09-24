"use client";

import { useEffect, useState } from "react";

export type PopupAd = { slot: number; title: string; link_url: string; version: string };

export function adImageUrl(ad: Pick<PopupAd, "slot" | "version">) {
  return `/api/anuncios/${ad.slot}?v=${ad.version}`;
}

/** Ventana con la imagen del anuncio. */
export function AnnouncementModal({ ad, onClose }: { ad: PopupAd; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- imagen servida desde la base, tamaño variable
    <img src={adImageUrl(ad)} alt={ad.title || "Anuncio"} className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain" />
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={ad.title || "Anuncio"}
    >
      <div className="relative flex max-w-3xl flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          aria-label="Cerrar anuncio"
          className="absolute -right-2 -top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-card text-lg font-bold shadow-lg"
        >
          ✕
        </button>
        {ad.link_url ? (
          <a href={ad.link_url} target="_blank" rel="noreferrer">
            {image}
          </a>
        ) : (
          image
        )}
        {ad.title && <p className="rounded-full bg-card px-4 py-1 text-sm font-semibold shadow">{ad.title}</p>}
      </div>
    </div>
  );
}

const read = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento local (modo privado): el conteo se reinicia al recargar.
  }
};

/**
 * Muestra un anuncio cada `intervalMinutes`, rotando entre los activos.
 * El último momento mostrado se guarda en el navegador, así que navegar
 * entre páginas no reinicia el conteo.
 */
export function AnnouncementPopup({
  teamId,
  ads,
  intervalMinutes,
}: {
  teamId: number;
  ads: PopupAd[];
  intervalMinutes: number;
}) {
  const [current, setCurrent] = useState<PopupAd | null>(null);
  const lastKey = `eos-ads-last-${teamId}`;
  const indexKey = `eos-ads-index-${teamId}`;

  useEffect(() => {
    if (ads.length === 0) return;
    if (!read(lastKey)) write(lastKey, String(Date.now()));

    const tick = () => {
      if (document.hidden) return;
      const last = Number(read(lastKey) ?? Date.now());
      if (Date.now() - last < intervalMinutes * 60_000) return;
      const index = Number(read(indexKey) ?? 0) % ads.length;
      write(indexKey, String(index + 1));
      write(lastKey, String(Date.now()));
      setCurrent(ads[index]);
    };
    const timer = setInterval(tick, 10_000);
    return () => clearInterval(timer);
  }, [ads, intervalMinutes, lastKey, indexKey]);

  if (!current) return null;
  return <AnnouncementModal ad={current} onClose={() => setCurrent(null)} />;
}
