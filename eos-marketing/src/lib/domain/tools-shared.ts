/** Caja de herramientas: tipos y utilidades que se usan en el servidor y en la pantalla. */

export type ToolKind = "link" | "embed";
export type ToolAccess = "all" | "restricted";

export type Tool = {
  id: number;
  team_id: number;
  name: string;
  description: string;
  category: string;
  kind: ToolKind;
  url: string;
  icon: string;
  access: ToolAccess;
  active: boolean;
  sort_order: number;
  role_ids: number[];
  user_ids: number[];
};

/** Íconos que se pueden elegir para una herramienta (nombre del ícono → etiqueta). */
export const TOOL_ICONS = {
  Link: "Enlace",
  Globe: "Sitio web",
  Palette: "Diseño",
  Picture: "Imágenes",
  Camera: "Fotos",
  Video: "Video",
  MusicNote: "Audio",
  Folder: "Carpeta",
  FileText: "Documento",
  Book: "Manual",
  BookOpen: "Guía",
  Calendar: "Calendario",
  Clock: "Horarios",
  ChartLine: "Tendencias",
  ChartColumn: "Reporte",
  ChartPie: "Dashboard",
  Database: "Base de datos",
  Envelope: "Correo",
  Comments: "Chat",
  Megaphone: "Anuncios",
  Bell: "Avisos",
  Persons: "Equipo",
  PersonWorker: "Recursos humanos",
  GraduationCap: "Académico",
  Briefcase: "Negocio",
  CreditCard: "Pagos",
  Ticket: "Eventos",
  Tag: "Promociones",
  Target: "Metas",
  Rocket: "Lanzamientos",
  Bulb: "Ideas",
  Sparkles: "IA",
  Star: "Favoritos",
  Heart: "Bienestar",
  MapPin: "Ubicaciones",
  Flag: "Campañas",
  Puzzle: "Integración",
  Cube: "Producto",
  Display: "Pantalla",
  Code: "Código",
  Cloud: "Nube",
  Shield: "Seguridad",
  Key: "Accesos",
  Wrench: "Herramienta",
  Gear: "Configuración",
} as const;

export type ToolIconName = keyof typeof TOOL_ICONS;

export function isToolIcon(v: unknown): v is ToolIconName {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(TOOL_ICONS, v);
}

/** Ícono por defecto según el tipo (también para herramientas guardadas con un emoji antiguo). */
export const defaultToolIcon = (kind: ToolKind): ToolIconName => (kind === "embed" ? "Puzzle" : "Link");

/** Categorías sugeridas (se pueden escribir otras). */
export const SUGGESTED_CATEGORIES = ["Análisis", "Marketing", "Documentos", "Diseño", "Comunicación", "Gestión"];

/** Agrupa por categoría respetando el orden de las herramientas; las que no tienen, al final como "Otras". */
export function groupByCategory<T extends { category: string }>(tools: T[]): { category: string; tools: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const t of tools) {
    const key = t.category.trim() || "Otras";
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.entries()]
    .map(([category, list]) => ({ category, tools: list }))
    .sort((a, b) => Number(a.category === "Otras") - Number(b.category === "Otras"));
}

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
