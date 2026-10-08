/** Caja de herramientas: tipos y utilidades que se usan en el servidor y en la pantalla. */

export type ToolKind = "link" | "embed";
export type ToolAccess = "all" | "restricted";

export type Tool = {
  id: number;
  team_id: number;
  name: string;
  description: string;
  kind: ToolKind;
  url: string;
  icon: string;
  access: ToolAccess;
  active: boolean;
  sort_order: number;
  role_ids: number[];
  user_ids: number[];
};

export const KIND_LABEL: Record<ToolKind, string> = {
  link: "Enlace (pestaña nueva)",
  embed: "Dentro de la app (iframe)",
};

/** Solo enlaces web; un sitio insertado debe ser https (la app es https y el navegador bloquea http dentro). */
export function validToolUrl(url: string, kind: ToolKind): boolean {
  try {
    const u = new URL(url);
    return kind === "embed" ? u.protocol === "https:" : u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Para insertar, algunos sitios necesitan su versión "embebible":
 * YouTube → /embed, Google Docs/Sheets/Slides/Drive → /preview (o /embed en presentaciones).
 */
export function embedUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" && u.pathname === "/watch" && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    }
    if (host === "youtu.be" && u.pathname.length > 1) return `https://www.youtube.com/embed${u.pathname}`;
    if (host === "docs.google.com" || host === "drive.google.com") {
      const m = u.pathname.match(/^(.*\/d\/[\w-]+)\/(edit|view)/);
      if (m) return `https://${u.hostname}${m[1]}/${u.pathname.startsWith("/presentation/") ? "embed" : "preview"}`;
    }
  } catch {}
  return url;
}
