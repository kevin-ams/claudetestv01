import {
  ChartColumn,
  ChartLine,
  CircleExclamation,
  Clock,
  Compass,
  Cube,
  Gear,
  GraduationCap,
  House,
  ListCheck,
  Persons,
  Route,
  Target,
} from "@gravity-ui/icons";

export type NavBadge = "todos" | "issues";

export type NavItem = {
  href: string;
  label: string;
  Icon: typeof House;
  badge?: NavBadge;
};

export const NAV_GROUPS: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      { href: "/", label: "Dashboard", Icon: House },
      { href: "/meeting", label: "Reunión L10", Icon: Clock },
      { href: "/todos", label: "To-Dos", Icon: ListCheck, badge: "todos" },
      { href: "/issues", label: "Issues", Icon: CircleExclamation, badge: "issues" },
    ],
  },
  {
    label: "EOS",
    items: [
      { href: "/vto", label: "V/TO", Icon: Compass },
      { href: "/accountability", label: "Organigrama", Icon: Persons },
      { href: "/rocks", label: "Rocks", Icon: Cube },
      { href: "/scorecard", label: "Scorecard", Icon: ChartColumn },
    ],
  },
  {
    label: "Carreras",
    items: [
      { href: "/indicadores", label: "Indicadores de carrera", Icon: GraduationCap },
      { href: "/metas", label: "Metas de carrera", Icon: Target },
      { href: "/control", label: "Control de carrera", Icon: Route },
    ],
  },
  {
    label: "Reportes",
    items: [{ href: "/analisis", label: "Análisis", Icon: ChartLine }],
  },
];

export const SETTINGS_ITEM: NavItem = { href: "/ajustes", label: "Ajustes", Icon: Gear };

export const ALL_NAV_ITEMS = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function currentSection(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find((i) => i.href !== "/" && isActive(pathname, i.href)) ??
    (pathname === "/" ? ALL_NAV_ITEMS[0] : undefined);
}
