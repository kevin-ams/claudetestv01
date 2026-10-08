/** Módulos de la app a los que se les puede dar acceso por rol. */
export const MODULES = [
  { key: "dashboard", label: "Dashboard", href: "/" },
  { key: "meeting", label: "Reunión L10", href: "/meeting" },
  { key: "todos", label: "To-Dos", href: "/todos" },
  { key: "issues", label: "Issues", href: "/issues" },
  { key: "vto", label: "V/TO", href: "/vto" },
  { key: "accountability", label: "Organigrama", href: "/accountability" },
  { key: "rocks", label: "Rocks", href: "/rocks" },
  { key: "scorecard", label: "Scorecard", href: "/scorecard" },
  { key: "indicadores", label: "Indicadores de carrera", href: "/indicadores" },
  { key: "metas", label: "Metas de carrera", href: "/metas" },
  { key: "control", label: "Control de carrera", href: "/control" },
  { key: "calendario", label: "Calendario editorial", href: "/calendario" },
  { key: "coberturas", label: "Control de coberturas", href: "/coberturas" },
  { key: "analisis_contenido", label: "Análisis de contenido", href: "/analisis-contenido" },
  { key: "analisis", label: "Análisis", href: "/analisis" },
  { key: "herramientas", label: "Otras herramientas", href: "/herramientas" },
  { key: "ajustes", label: "Ajustes (apariencia, hitos, anuncios, demo, exportar)", href: "/ajustes" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];
export type AccessLevel = "none" | "view" | "edit";
export type Permissions = Partial<Record<ModuleKey, AccessLevel>>;

export const LEVEL_LABEL: Record<AccessLevel, string> = {
  none: "Sin acceso",
  view: "Solo ver",
  edit: "Ver y editar",
};

const RANK: Record<AccessLevel, number> = { none: 0, view: 1, edit: 2 };

export function levelFor(permissions: Permissions, isAdmin: boolean, module: ModuleKey): AccessLevel {
  if (isAdmin) return "edit";
  return permissions[module] ?? "edit";
}

export function allows(level: AccessLevel, needed: AccessLevel) {
  return RANK[level] >= RANK[needed];
}

/** Módulo dueño de una ruta (p. ej. /rocks/x → rocks). */
export function moduleForPath(pathname: string): ModuleKey | null {
  if (pathname === "/") return "dashboard";
  const hit = MODULES.find((m) => m.href !== "/" && (pathname === m.href || pathname.startsWith(m.href + "/")));
  return hit?.key ?? null;
}

export function isAccessLevel(v: unknown): v is AccessLevel {
  return v === "none" || v === "view" || v === "edit";
}
