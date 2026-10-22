export type NavItem = { href: string; label: string; phase?: number };

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "General",
    items: [{ href: "/", label: "Dashboard" }],
  },
  {
    title: "Relaciones",
    items: [
      { href: "/contactos", label: "Contactos", phase: 1 },
      { href: "/empresas", label: "Empresas", phase: 1 },
      { href: "/negocios", label: "Negocios", phase: 1 },
      { href: "/tareas", label: "Tareas", phase: 1 },
    ],
  },
  {
    title: "Ventas",
    items: [
      { href: "/productos", label: "Productos", phase: 3 },
      { href: "/cotizaciones", label: "Cotizaciones", phase: 3 },
      { href: "/facturas", label: "Facturas", phase: 4 },
    ],
  },
  {
    title: "Marketing",
    items: [{ href: "/campanas", label: "Campañas", phase: 6 }],
  },
  {
    title: "Ajustes",
    items: [{ href: "/configuracion", label: "Configuración" }],
  },
];

export function findNavItem(href: string) {
  return NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.href === href);
}
