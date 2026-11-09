"use client";

import { Modal } from "@heroui/react";
import { useEffect, useState } from "react";

export type PopupAd = { slot: number; title: string; link_url: string; version: string };

export function adImageUrl(ad: Pick<PopupAd, "slot" | "version">) {
  return `/api/anuncios/${ad.slot}?v=${ad.version}`;
}

/** Ventana con la imagen del anuncio. */
export function AnnouncementModal({ ad, onClose }: { ad: PopupAd; onClose: () => void }) {
  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- imagen servida desde la base, tamaño variable
    <img src={adImageUrl(ad)} alt={ad.title || "Anuncio"} className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain" />
  );

  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()} className="z-[60]">
      <Modal.Container size="lg">
        <Modal.Dialog
          aria-label={ad.title || "Anuncio"}
          className="relative flex max-w-3xl flex-col items-center gap-3 overflow-visible bg-transparent p-0 shadow-none"
        >
        <Modal.CloseTrigger aria-label="Cerrar anuncio" className="absolute -right-3 -top-3 z-10 bg-surface shadow-lg" />
        {ad.link_url ? (
          <a href={ad.link_url} target="_blank" rel="noreferrer">
            {image}
          </a>
        ) : (
          image
        )}
        {ad.title && <p className="rounded-full bg-card px-4 py-1 text-sm font-semibold shadow">{ad.title}</p>}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
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
