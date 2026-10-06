// Utilidades para enlaces de Google Drive. Los artes no se suben a esta app:
// se guarda solo el enlace y se previsualizan con los visores de Drive.
// El archivo (o carpeta) debe estar compartido como
// "Cualquier persona con el enlace puede ver".

export type DriveRef =
  | { type: "file"; id: string }
  | { type: "folder"; id: string };

const ID = "([a-zA-Z0-9_-]{10,})";

export function parseDriveUrl(raw: string): DriveRef | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)google\.com$/.test(url.hostname)) return null;

  const folder = url.pathname.match(new RegExp(`/folders/${ID}`));
  if (folder) return { type: "folder", id: folder[1] };

  // drive.google.com/file/d/ID, docs.google.com/<app>/d/ID
  const path = url.pathname.match(new RegExp(`/d/${ID}`));
  if (path) return { type: "file", id: path[1] };

  // drive.google.com/open?id=ID, drive.google.com/uc?id=ID
  const param = url.searchParams.get("id");
  if (param && new RegExp(`^${ID}$`).test(param)) {
    return url.pathname.includes("folder")
      ? { type: "folder", id: param }
      : { type: "file", id: param };
  }
  return null;
}

export function drivePreviewUrl(ref: DriveRef): string {
  return ref.type === "folder"
    ? `https://drive.google.com/embeddedfolderview?id=${ref.id}#grid`
    : `https://drive.google.com/file/d/${ref.id}/preview`;
}

export function driveThumbnailUrl(ref: DriveRef): string | null {
  return ref.type === "file"
    ? `https://drive.google.com/thumbnail?id=${ref.id}&sz=w640`
    : null;
}

export function driveOpenUrl(ref: DriveRef): string {
  return ref.type === "folder"
    ? `https://drive.google.com/drive/folders/${ref.id}`
    : `https://drive.google.com/file/d/${ref.id}/view`;
}
