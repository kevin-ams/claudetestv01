/**
 * Tema de la app: modo claro/oscuro (por persona, en una cookie) y color del
 * template (por equipo, en la base). Sin dependencias de servidor: lo usan
 * tanto el layout como los componentes cliente.
 */

export type ThemeMode = "light" | "dark" | "system";

export const THEME_COOKIE = "eos-theme";
/** Menú lateral colapsado (solo íconos) en escritorio. */
export const SIDEBAR_COOKIE = "eos-sidebar";
export const DEFAULT_MODE: ThemeMode = "light";
export const DEFAULT_THEME_COLOR = "#234c6a";

export const THEME_PRESETS = [
  { name: "Azul marino", color: "#234c6a" },
  { name: "Azul", color: "#2563eb" },
  { name: "Índigo", color: "#4f46e5" },
  { name: "Morado", color: "#7c3aed" },
  { name: "Rosa", color: "#be185d" },
  { name: "Rojo", color: "#b91c1c" },
  { name: "Naranja", color: "#c2410c" },
  { name: "Verde", color: "#15803d" },
  { name: "Turquesa", color: "#0f766e" },
  { name: "Grafito", color: "#374151" },
] as const;

export function parseMode(value: string | undefined | null): ThemeMode {
  return value === "light" || value === "dark" || value === "system" ? value : DEFAULT_MODE;
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: Rgb): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

/** Luminancia relativa (WCAG). */
function luminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Texto blanco o casi negro, el que contraste mejor con el fondo. */
function readableOn(rgb: Rgb): string {
  const l = luminance(rgb);
  return (1.05) / (l + 0.05) >= (l + 0.05) / 0.05 ? "#ffffff" : "#111318";
}

/** Mezcla con blanco hasta que el color se lea bien sobre fondo oscuro. */
function lightenForDark(rgb: Rgb): Rgb {
  let out = rgb;
  for (let t = 0; t <= 1 && luminance(out) < 0.28; t += 0.05) {
    out = rgb.map((v) => v + (255 - v) * t) as Rgb;
  }
  return out;
}

/** Variables CSS del color del equipo para claro y oscuro. */
export function brandVariables(color: string): Record<string, string> {
  const hex = isHexColor(color) ? color.toLowerCase() : DEFAULT_THEME_COLOR;
  const rgb = hexToRgb(hex);
  const dark = lightenForDark(rgb);
  return {
    "--brand": hex,
    "--brand-foreground": readableOn(rgb),
    "--brand-dark": rgbToHex(dark),
    "--brand-dark-foreground": readableOn(dark),
  };
}

export function brandStyleSheet(color: string): string {
  const vars = brandVariables(color);
  return `:root{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")}}`;
}

/**
 * Script que corre antes de pintar la página: resuelve "sistema" con la
 * preferencia del equipo y aplica la clase `dark`, así no hay destello claro.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(\\w+)/);var t=m?m[1]:"${DEFAULT_MODE}";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.classList.toggle("dark",d);e.classList.toggle("light",!d);e.dataset.theme=d?"dark":"light"}catch(_){}})()`;
