import { driveOpenUrl, drivePreviewUrl, driveThumbnailUrl, parseDriveUrl } from "@/lib/drive";

export function DrivePreview({ url, title }: { url: string; title: string }) {
  const ref = parseDriveUrl(url);
  if (!ref) {
    return <p className="text-sm text-red">El enlace de Google Drive no es válido.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-lg border border-border bg-[#eef0f3]">
        <iframe
          src={drivePreviewUrl(ref)}
          title={title}
          className="aspect-[4/3] w-full"
          allow="autoplay"
          loading="lazy"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>
          ¿No se ve? El {ref.type === "folder" ? "folder" : "archivo"} debe estar compartido como
          “Cualquier persona con el enlace”.
        </span>
        <a href={driveOpenUrl(ref)} target="_blank" rel="noreferrer" className="font-medium text-primary underline">
          Abrir en Google Drive ↗
        </a>
      </div>
    </div>
  );
}

export function DriveThumbnail({ url, title }: { url: string; title: string }) {
  const ref = parseDriveUrl(url);
  const thumb = ref ? driveThumbnailUrl(ref) : null;
  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-t-xl bg-[#eef0f3] text-xs text-muted">
      {thumb ? (
        // Miniatura servida por Google Drive: no pasa por el optimizador de imágenes.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt={title} className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <span>📁 Carpeta de Drive</span>
      )}
    </div>
  );
}
