"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnnouncementModal, adImageUrl, type PopupAd } from "@/components/announcement-popup";
import type { AnnouncementSettings, AnnouncementSlot } from "@/lib/domain/announcements";
import {
  clearAdSlotAction,
  saveAdDetailsAction,
  saveAdSettingsAction,
  uploadAdImageAction,
  type AdResult,
} from "./actions";

function SlotCard({
  slot,
  canEdit,
  onPreview,
}: {
  slot: AnnouncementSlot;
  canEdit: boolean;
  onPreview: (ad: PopupAd) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(slot.title);
  const [link, setLink] = useState(slot.link_url);
  const [active, setActive] = useState(slot.active);
  const [result, setResult] = useState<AdResult | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = title !== slot.title || link !== slot.link_url || active !== slot.active;

  const run = (fn: () => Promise<AdResult | void>) =>
    startTransition(async () => {
      const res = await fn();
      if (res) setResult(res);
      router.refresh();
    });

  return (
    <div className={`card flex flex-col gap-3 p-4 ${pending ? "opacity-70" : ""}`}>
      <div className="flex items-center justify-between">
        <p className="font-semibold">Espacio {slot.slot}</p>
        {slot.has_image && (
          <span className={`badge ${slot.active ? "bg-green-bg text-green" : "bg-background text-muted"}`}>
            {slot.active ? "Activo" : "Pausado"}
          </span>
        )}
      </div>

      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-background">
        {slot.has_image ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagen servida desde la base
          <img src={adImageUrl(slot)} alt={slot.title || `Anuncio ${slot.slot}`} className="h-full w-full object-contain" />
        ) : (
          <span className="text-sm text-muted">Sin imagen</span>
        )}
      </div>

      {canEdit && (
        <label className="btn btn-secondary cursor-pointer text-xs">
          {slot.has_image ? "Reemplazar imagen" : "Subir imagen"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            aria-label={`Imagen del espacio ${slot.slot}`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const fd = new FormData();
              fd.set("image", file);
              run(() => uploadAdImageAction(slot.slot, fd));
              e.target.value = "";
            }}
          />
        </label>
      )}

      {slot.has_image && (
        <>
          <input
            className="input text-sm"
            placeholder="Título (opcional)"
            value={title}
            disabled={!canEdit}
            onChange={(e) => setTitle(e.target.value)}
            aria-label={`Título del espacio ${slot.slot}`}
          />
          <input
            className="input text-sm"
            placeholder="Enlace al hacer clic (opcional)"
            value={link}
            disabled={!canEdit}
            onChange={(e) => setLink(e.target.value)}
            aria-label={`Enlace del espacio ${slot.slot}`}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} disabled={!canEdit} onChange={(e) => setActive(e.target.checked)} />
            Mostrar este anuncio
          </label>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <button
                className="btn btn-primary text-xs"
                disabled={!dirty}
                onClick={() => run(() => saveAdDetailsAction(slot.slot, { title, linkUrl: link, active }))}
              >
                Guardar
              </button>
            )}
            <button
              className="btn btn-secondary text-xs"
              onClick={() => onPreview({ slot: slot.slot, title, link_url: link, version: slot.version })}
            >
              Vista previa
            </button>
            {canEdit && (
              <button
                className="btn btn-danger ml-auto text-xs"
                onClick={() => {
                  if (confirm(`¿Quitar el anuncio del espacio ${slot.slot}?`)) run(() => clearAdSlotAction(slot.slot));
                }}
              >
                Quitar
              </button>
            )}
          </div>
        </>
      )}
      {result && <p className={`text-xs ${result.ok ? "text-green" : "text-red"}`}>{result.message}</p>}
    </div>
  );
}

export function AdSettings({
  settings,
  slots,
  canEdit,
}: {
  settings: AnnouncementSettings;
  slots: AnnouncementSlot[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [minutes, setMinutes] = useState(String(settings.interval_minutes));
  const [result, setResult] = useState<AdResult | null>(null);
  const [preview, setPreview] = useState<PopupAd | null>(null);
  const [pending, startTransition] = useTransition();
  const showing = slots.filter((s) => s.has_image && s.active).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-wrap items-center gap-4 p-4">
        <label className="flex items-center gap-2 font-semibold">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={enabled}
            disabled={!canEdit}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Anuncios activados
        </label>
        <label className="flex items-center gap-2 text-sm">
          Mostrar uno cada
          <input
            type="number"
            min={1}
            max={240}
            className="input !w-20"
            value={minutes}
            disabled={!canEdit}
            onChange={(e) => setMinutes(e.target.value)}
            aria-label="Minutos entre anuncios"
          />
          minutos
        </label>
        {canEdit && (
          <button
            className="btn btn-primary text-xs"
            disabled={pending || (enabled === settings.enabled && minutes === String(settings.interval_minutes))}
            onClick={() =>
              startTransition(async () => {
                setResult(await saveAdSettingsAction(enabled, Number(minutes)));
                router.refresh();
              })
            }
          >
            Guardar
          </button>
        )}
        <span className="text-sm text-muted">
          {settings.enabled ? `${showing} anuncio(s) en rotación` : "Nadie ve anuncios mientras estén desactivados."}
        </span>
        {result && <span className={`text-sm ${result.ok ? "text-green" : "text-red"}`}>{result.message}</span>}
      </div>

      {!canEdit && (
        <p className="rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow">
          Solo un administrador puede cambiar los anuncios.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((s) => (
          <SlotCard key={`${s.slot}-${s.version}`} slot={s} canEdit={canEdit} onPreview={setPreview} />
        ))}
      </div>
      <p className="text-xs text-muted">
        PNG, JPG, WEBP o GIF de hasta 5 MB. Los anuncios aparecen a todo el equipo en cualquier
        pantalla, uno a la vez y en orden (espacio 1, 2, 3…). Cada persona los cierra con ✕ o Esc.
      </p>

      {preview && <AnnouncementModal ad={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
