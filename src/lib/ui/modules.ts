import {
  ChartColumnBig,
  CircleAlert,
  Compass,
  LayoutDashboard,
  ListChecks,
  Mountain,
  Network,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ModuleKey =
  | "dashboard"
  | "vto"
  | "accountability"
  | "rocks"
  | "scorecard"
  | "issues"
  | "todos"
  | "meeting"
  | "team";

export type ModuleInfo = {
  key: ModuleKey;
  href: string;
  label: string;
  blurb: string;
  icon: LucideIcon;
};

/** Cada módulo tiene un color propio (ver `.tone-*` en globals.css). */
export const MODULES: Record<ModuleKey, ModuleInfo> = {
  dashboard: {
    key: "dashboard",
    href: "/",
    label: "Dashboard",
    blurb: "Así está tu negocio esta semana.",
    icon: LayoutDashboard,
  },
  vto: {
    key: "vto",
    href: "/vto",
    label: "V/TO",
    blurb: "Tu visión y plan de tracción de una página.",
    icon: Compass,
  },
  accountability: {
    key: "accountability",
    href: "/accountability",
    label: "Organigrama",
    blurb: "Quién es dueño de qué en tu organización.",
    icon: Network,
  },
  rocks: {
    key: "rocks",
    href: "/rocks",
    label: "Rocks",
    blurb: "Prioridades de 90 días.",
    icon: Mountain,
  },
  scorecard: {
    key: "scorecard",
    href: "/scorecard",
    label: "Scorecard",
    blurb: "Los números que predicen tu negocio.",
    icon: ChartColumnBig,
  },
  issues: {
    key: "issues",
    href: "/issues",
    label: "Issues",
    blurb: "Identifica, Discute y Resuelve.",
    icon: CircleAlert,
  },
  todos: {
    key: "todos",
    href: "/todos",
    label: "To-Dos",
    blurb: "Compromisos de 7 días.",
    icon: ListChecks,
  },
  meeting: {
    key: "meeting",
    href: "/meeting",
    label: "Reunión L10",
    blurb: "Corre tu reunión semanal de 90 minutos.",
    icon: Timer,
  },
  team: {
    key: "team",
    href: "/settings/team",
    label: "Equipo",
    blurb: "Quién tiene acceso.",
    icon: Users,
  },
};

export const NAV_ORDER: ModuleKey[] = [
  "dashboard",
  "vto",
  "accountability",
  "rocks",
  "scorecard",
  "issues",
  "todos",
  "meeting",
  "team",
];

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
