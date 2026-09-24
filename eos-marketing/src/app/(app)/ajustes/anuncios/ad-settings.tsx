"use client";

import { AppCheckbox } from "@/components/ui/checkbox";
import { Button, Card, Chip, Input } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnnouncementModal, adImageUrl, type PopupAd } from "@/components/announcement-popup";
import { ProgressBar } from "@/components/progress-bar";
import type { AnnouncementSettings, AnnouncementSlot } from "@/lib/domain/announcements";
import {
  clearAdSlotAction,
  saveAdDetailsAction,
  saveAdSettingsAction,
  uploadAdImageAction,
  type AdResult,
} from "./actions";

const MAX_SIDE = 1920;
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Prepara la imagen en el navegador: las fotos grandes se reducen a 1920 px
 * y se recomprimen, así suben rápido y se ven bien en el popup. Los GIF se
 * suben tal cual para no perder la animación.
 */
async function prepareImage(file: File): Promise<File | string> {
  if (/\.hei[cf]$/i.test(file.name) || /hei[cf]/i.test(file.type)) {
    return "Las fotos HEIC de iPhone no se pueden mostrar en el navegador. Guárdala como JPG o PNG.";
  }
  const isGif = file.type === "image/gif" || /\.gif$/i.test(file.name);
  if (isGif) return file.size > MAX_BYTES ? "El GIF pesa más de 5 MB." : file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return "No se pudo leer la imagen. Usa PNG, JPG o WEBP.";
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= 1.5 * 1024 * 1024) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
  if (!blob) return "No se pudo procesar la imagen.";
  if (blob.size > MAX_BYTES) return "La imagen sigue pesando más de 5 MB después de reducirla.";
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: blob.type || "image/webp" });
}

function SlotCard({
  slot,
  canEdit,
  onPreview,
  message,
  setMessage,
}: {
  slot: AnnouncementSlot;
  canEdit: boolean;
  onPreview: (ad: PopupAd) => void;
  message: AdResult | "uploading" | undefined;
  setMessage: (slot: number, message: AdResult | "uploading" | undefined) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(slot.title);
  const [link, setLink] = useState(slot.link_url);
  const [active, setActive] = useState(slot.active);
  const [pending, startTransition] = useTransition();
  const dirty = title !== slot.title || link !== slot.link_url || active !== slot.active;
  const uploading = message === "uploading";
  const result = message && message !== "uploading" ? message : null;

  const run = (fn: () => Promise<AdResult | void>) =>
    startTransition(async () => {
      try {
        const res = await fn();
        setMessage(slot.slot, res ?? undefined);
      } catch (e) {
        setMessage(slot.slot, { ok: false, message: e instanceof Error ? e.message : "No se pudo guardar." });
      }
      router.refresh();
    });

  async function upload(file: File) {
    setMessage(slot.slot, "uploading");
    const prepared = await prepareImage(file);
    if (typeof prepared === "string") {
      setMessage(slot.slot, { ok: false, message: prepared });
      return;
    }
    const fd = new FormData();
    fd.set("image", prepared);
    try {
      const res = await uploadAdImageAction(slot.slot, fd);
      setMessage(slot.slot, res);
    } catch (e) {
      setMessage(slot.slot, {
        ok: false,
        message: `No se pudo subir la imagen: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
    router.refresh();
  }

  return (
    <Card className={`flex flex-col gap-3 p-4 ${pending || uploading ? "opacity-70" : ""}`}>
      <div className="flex items-center justify-between">
        <p className="font-semibold">Espacio {slot.slot}</p>
        {slot.has_image && (
          <Chip size="sm" variant="soft" color={slot.active ? "success" : "default"}>
            {slot.active ? "Activo" : "Pausado"}
          </Chip>
        )}
      </div>

      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-background">
        {uploading || (pending && !slot.has_image) ? (
          <span className="text-sm font-semibold text-primary">Subiendo imagen…</span>
        ) : slot.has_image ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagen servida desde la base
          <img src={adImageUrl(slot)} alt={slot.title || `Anuncio ${slot.slot}`} className="h-full w-full object-contain" />
        ) : (
          <span className="text-sm text-muted">Sin imagen</span>
        )}
      </div>

      {canEdit && (
        <label className={`${buttonVariants({ variant: "outline", size: "sm" })} cursor-pointer`}>
          {slot.has_image ? "Reemplazar imagen" : "Subir imagen"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            aria-label={`Imagen del espacio ${slot.slot}`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
      )}

      {slot.has_image && (
        <>
          <Input fullWidth
            className="text-sm"
            placeholder="Título (opcional)"
            value={title}
            disabled={!canEdit}
            onChange={(e) => setTitle(e.target.value)}
            aria-label={`Título del espacio ${slot.slot}`}
          />
          <Input fullWidth
            className="text-sm"
            placeholder="Enlace al hacer clic (opcional)"
            value={link}
            disabled={!canEdit}
            onChange={(e) => setLink(e.target.value)}
            aria-label={`Enlace del espacio ${slot.slot}`}
          />
          <AppCheckbox checked={active} disabled={!canEdit} onChange={(e) => setActive(e.target.checked)} className="flex items-center gap-2 text-sm">
            Mostrar este anuncio
          </AppCheckbox>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button variant="primary" size="sm"
                isDisabled={!dirty}
                onPress={() => run(() => saveAdDetailsAction(slot.slot, { title, linkUrl: link, active }))}
              >
                Guardar
              </Button>
            )}
            <Button variant="outline" size="sm"
              onPress={() => onPreview({ slot: slot.slot, title, link_url: link, version: slot.version })}
            >
              Vista previa
            </Button>
            {canEdit && (
              <Button variant="danger-soft" size="sm"
                className="ml-auto"
                onPress={() => {
                  if (confirm(`¿Quitar el anuncio del espacio ${slot.slot}?`)) run(() => clearAdSlotAction(slot.slot));
                }}
              >
                Quitar
              </Button>
            )}
          </div>
        </>
      )}
      {(uploading || pending) && <ProgressBar label={uploading ? "Preparando y subiendo la imagen…" : "Guardando…"} />}
      {result && !uploading && !pending && (
        <p
          role="status"
          className={`rounded-md px-2 py-1 text-sm ${result.ok ? "bg-green-bg text-green" : "bg-red-bg text-red"}`}
        >
          {result.ok ? "✓ " : "✕ "}
          {result.message}
        </p>
      )}
    </Card>
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
  // Mensajes por espacio: viven aquí para no perderse cuando la tarjeta se actualiza.
  const [messages, setMessages] = useState<Record<number, AdResult | "uploading" | undefined>>({});
  const setMessage = (slot: number, message: AdResult | "uploading" | undefined) =>
    setMessages((m) => ({ ...m, [slot]: message }));
  const [pending, startTransition] = useTransition();
  const showing = slots.filter((s) => s.has_image && s.active).length;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-row flex-wrap items-center gap-4 p-4">
        <AppCheckbox
          checked={enabled}
          disabled={!canEdit}
          onChange={(e) => setEnabled(e.target.checked)}
          className="flex items-center gap-2 font-semibold"
        >
          Anuncios activados
        </AppCheckbox>
        <label className="flex items-center gap-2 text-sm">
          Mostrar uno cada
          <Input
            type="number"
            min={1}
            max={240}
            className="w-20"
            value={minutes}
            disabled={!canEdit}
            onChange={(e) => setMinutes(e.target.value)}
            aria-label="Minutos entre anuncios"
          />
          minutos
        </label>
        {canEdit && (
          <Button variant="primary" size="sm"
            isDisabled={pending || (enabled === settings.enabled && minutes === String(settings.interval_minutes))}
            onPress={() =>
              startTransition(async () => {
                setResult(await saveAdSettingsAction(enabled, Number(minutes)));
                router.refresh();
              })
            }
          >
            Guardar
          </Button>
        )}
        <span className="text-sm text-muted">
          {settings.enabled ? `${showing} anuncio(s) en rotación` : "Nadie ve anuncios mientras estén desactivados."}
        </span>
        {result && <span className={`text-sm ${result.ok ? "text-green" : "text-red"}`}>{result.message}</span>}
      </Card>

      {!canEdit && (
        <p className="rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow">
          Solo un administrador puede cambiar los anuncios.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((s) => (
          <SlotCard
            key={`${s.slot}-${s.version}`}
            slot={s}
            canEdit={canEdit}
            onPreview={setPreview}
            message={messages[s.slot]}
            setMessage={setMessage}
          />
        ))}
      </div>
      <p className="text-xs text-muted">
        PNG, JPG, WEBP o GIF. Las fotos grandes se reducen automáticamente a 1920 px al subirlas. Los anuncios aparecen a todo el equipo en cualquier
        pantalla, uno a la vez y en orden (espacio 1, 2, 3…). Cada persona los cierra con ✕ o Esc.
      </p>

      {preview && <AnnouncementModal ad={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
