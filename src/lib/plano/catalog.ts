import type { CatalogItem, Category } from "./types";

export const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: "luces", label: "Iluminación", icon: "💡" },
  { id: "modificadores", label: "Modificadores", icon: "🔆" },
  { id: "personas", label: "Personas", icon: "🧍" },
  { id: "camaras", label: "Cámaras", icon: "🎥" },
  { id: "instrumentos", label: "Instrumentos y audio", icon: "🎸" },
  { id: "escenografia", label: "Escenografía y fondos", icon: "🛋️" },
  { id: "electrico", label: "Eléctrico", icon: "🔌" },
  { id: "anotaciones", label: "Anotaciones", icon: "✏️" },
];

const G = "#9ca3af";

export const CATALOG: CatalogItem[] = [
  // ─── Iluminación ────────────────────────────────────────────
  { type: "fresnel", name: "Fresnel", category: "luces", w: 0.35, h: 0.45, color: G, watts: 650, beam: 40, throw: 4, kelvin: 3200, cable: 5, keywords: "tungsteno spot" },
  { type: "fresnel-led", name: "Fresnel LED", category: "luces", w: 0.35, h: 0.45, color: G, watts: 200, beam: 35, throw: 4, kelvin: 5600, cable: 5 },
  { type: "cob", name: "LED COB (monolight)", category: "luces", w: 0.3, h: 0.5, color: G, watts: 300, beam: 55, throw: 3.5, kelvin: 5600, cable: 5, keywords: "aputure godox" },
  { type: "panel-led", name: "Panel LED", category: "luces", w: 0.6, h: 0.18, color: G, watts: 100, beam: 70, throw: 3, kelvin: 5600, cable: 3, keywords: "bicolor" },
  { type: "softbox", name: "Softbox", category: "luces", w: 0.9, h: 0.6, color: G, watts: 300, beam: 90, throw: 3, kelvin: 5600, cable: 5 },
  { type: "octabox", name: "Octabox", category: "luces", w: 0.9, h: 0.9, color: G, watts: 300, beam: 100, throw: 3, kelvin: 5600, cable: 5 },
  { type: "stripbox", name: "Stripbox", category: "luces", w: 1.2, h: 0.35, color: G, watts: 300, beam: 80, throw: 3, kelvin: 5600, cable: 5 },
  { type: "beauty-dish", name: "Beauty dish", category: "luces", w: 0.55, h: 0.55, color: G, watts: 300, beam: 60, throw: 3, kelvin: 5600, cable: 5 },
  { type: "par", name: "PAR LED", category: "luces", w: 0.3, h: 0.3, color: G, watts: 180, beam: 25, throw: 5, kelvin: 5600, cable: 3, keywords: "rgb wash" },
  { type: "elipsoidal", name: "Elipsoidal / Leko", category: "luces", w: 0.3, h: 0.8, color: G, watts: 750, beam: 26, throw: 7, kelvin: 3200, cable: 5, keywords: "source four recorte" },
  { type: "cabeza-movil", name: "Cabeza móvil", category: "luces", w: 0.45, h: 0.45, color: G, watts: 400, beam: 18, throw: 8, kelvin: 7000, cable: 3, keywords: "moving head beam" },
  { type: "tubo-led", name: "Tubo LED", category: "luces", w: 1.2, h: 0.08, color: G, watts: 40, beam: 120, throw: 2, kelvin: 5600, cable: 3, keywords: "astera nanlite pavotube" },
  { type: "ring-light", name: "Aro de luz", category: "luces", w: 0.5, h: 0.5, color: G, watts: 60, beam: 70, throw: 2, kelvin: 5600, cable: 2 },
  { type: "backlight", name: "Contraluz (backlight)", category: "luces", w: 0.35, h: 0.45, color: G, watts: 300, beam: 35, throw: 3.5, kelvin: 5600, cable: 5, rotation: 180, keywords: "contra" },
  { type: "fondo-luz", name: "Luz de fondo / cyc", category: "luces", w: 0.8, h: 0.3, color: G, watts: 400, beam: 100, throw: 2.5, kelvin: 5600, cable: 5, keywords: "ciclorama wash" },
  { type: "practica", name: "Foco práctico", category: "luces", w: 0.2, h: 0.2, color: "#f5f5f4", watts: 60, beam: 360, throw: 1.5, kelvin: 2700, cable: 2, keywords: "bombilla lampara" },
  { type: "lampara-pie", name: "Lámpara de pie", category: "luces", w: 0.4, h: 0.4, color: "#e7e5e4", watts: 60, beam: 360, throw: 1.5, kelvin: 2700, cable: 2 },
  { type: "navidad", name: "Luces navideñas", category: "luces", w: 3, h: 0.12, color: "#16a34a", watts: 25, beam: 360, throw: 0.5, kelvin: 2700, cable: 1.5, keywords: "guirnalda serie string fairy" },
  { type: "vela", name: "Vela", category: "luces", w: 0.1, h: 0.1, color: "#fef3c7", beam: 360, throw: 0.6, kelvin: 1900, keywords: "candle" },
  { type: "vela-led", name: "Vela LED", category: "luces", w: 0.1, h: 0.1, color: "#fef3c7", watts: 1, beam: 360, throw: 0.6, kelvin: 2000, cable: 1.5 },
  { type: "neon", name: "Letrero neón", category: "luces", w: 1, h: 0.08, color: "#ec4899", watts: 30, beam: 360, throw: 0.8, kelvin: 6500, cable: 2 },
  { type: "humo", name: "Máquina de humo", category: "luces", w: 0.5, h: 0.3, color: "#4b5563", watts: 1000, cable: 3, keywords: "haze niebla" },

  // ─── Modificadores ──────────────────────────────────────────
  { type: "rebotador-oro", name: "Rebotador dorado", category: "modificadores", w: 1, h: 0.08, color: "#d4b64a", keywords: "reflector" },
  { type: "rebotador-plata", name: "Rebotador plateado", category: "modificadores", w: 1, h: 0.08, color: "#cbd5e1", keywords: "reflector" },
  { type: "rebotador-blanco", name: "Rebotador blanco / poliestireno", category: "modificadores", w: 1.2, h: 0.08, color: "#f8fafc", keywords: "reflector foamboard" },
  { type: "reflector-5en1", name: "Reflector 5 en 1", category: "modificadores", w: 0.8, h: 0.08, color: "#d4b64a" },
  { type: "bandera", name: "Bandera negra", category: "modificadores", w: 0.6, h: 0.06, color: "#111827", keywords: "flag negative fill" },
  { type: "difusor", name: "Difusor / butterfly", category: "modificadores", w: 1.2, h: 0.08, color: "#f1f5f9", keywords: "scrim seda" },
  { type: "cortador", name: "Tela negra (negativo)", category: "modificadores", w: 1.5, h: 0.06, color: "#1f2937" },

  // ─── Personas ───────────────────────────────────────────────
  { type: "persona", name: "Persona", category: "personas", w: 0.55, h: 0.3, color: "#9ca3af", rotation: 180 },
  { type: "persona-pelo-largo", name: "Persona (pelo largo)", category: "personas", w: 0.55, h: 0.32, color: "#9ca3af", rotation: 180 },
  { type: "persona-sentada", name: "Persona sentada", category: "personas", w: 0.55, h: 0.55, color: "#9ca3af", rotation: 180 },
  { type: "musico", name: "Músico", category: "personas", w: 0.55, h: 0.3, color: "#9ca3af", rotation: 180 },
  { type: "camarografo", name: "Camarógrafo", category: "personas", w: 0.55, h: 0.3, color: "#6b7280" },

  // ─── Cámaras ────────────────────────────────────────────────
  { type: "camara", name: "Cámara", category: "camaras", w: 0.3, h: 0.35, color: "#1f2937", watts: 20, cable: 3 },
  { type: "camara-tripode", name: "Cámara en trípode", category: "camaras", w: 0.8, h: 0.8, color: "#1f2937", watts: 20, cable: 3 },
  { type: "camara-cine", name: "Cámara de cine", category: "camaras", w: 0.35, h: 0.6, color: "#111827", watts: 60, cable: 3 },
  { type: "ptz", name: "Cámara PTZ", category: "camaras", w: 0.25, h: 0.25, color: "#e5e7eb", watts: 25, cable: 3 },
  { type: "jib", name: "Grúa / jib", category: "camaras", w: 0.5, h: 3, color: "#374151", watts: 30, cable: 3 },
  { type: "dolly", name: "Dolly / slider", category: "camaras", w: 0.5, h: 2, color: "#6b7280" },
  { type: "monitor-cam", name: "Monitor / prompter", category: "camaras", w: 0.5, h: 0.15, color: "#111827", watts: 40, cable: 2 },

  // ─── Instrumentos y audio ───────────────────────────────────
  { type: "bateria", name: "Batería", category: "instrumentos", w: 1.8, h: 1.5, color: "#9ca3af", rotation: 180 },
  { type: "guitarra", name: "Guitarra", category: "instrumentos", w: 0.35, h: 1, color: "#b45309" },
  { type: "bajo", name: "Bajo", category: "instrumentos", w: 0.35, h: 1.15, color: "#78350f" },
  { type: "teclado", name: "Teclado", category: "instrumentos", w: 1.3, h: 0.35, color: "#1f2937", watts: 50, cable: 2, rotation: 180 },
  { type: "piano", name: "Piano de cola", category: "instrumentos", w: 1.5, h: 1.9, color: "#111827" },
  { type: "amplificador", name: "Amplificador", category: "instrumentos", w: 0.6, h: 0.3, color: "#374151", watts: 100, cable: 2, rotation: 180 },
  { type: "monitor-piso", name: "Monitor de piso", category: "instrumentos", w: 0.55, h: 0.4, color: "#374151", watts: 300, cable: 2 },
  { type: "bocina", name: "Bocina / PA", category: "instrumentos", w: 0.5, h: 0.4, color: "#1f2937", watts: 500, cable: 3, rotation: 180 },
  { type: "microfono", name: "Micrófono en pie", category: "instrumentos", w: 0.35, h: 0.35, color: "#374151" },
  { type: "microfono-boom", name: "Boom / caña", category: "instrumentos", w: 0.1, h: 2, color: "#374151" },
  { type: "consola", name: "Consola / mezcladora", category: "instrumentos", w: 0.8, h: 0.5, color: "#1f2937", watts: 150, cable: 2 },
  { type: "atril", name: "Atril", category: "instrumentos", w: 0.5, h: 0.3, color: "#6b7280" },

  // ─── Escenografía ───────────────────────────────────────────
  { type: "fondo", name: "Fondo de papel / ciclorama", category: "escenografia", w: 3, h: 0.25, color: "#e5e7eb", keywords: "backdrop" },
  { type: "chroma", name: "Chroma key", category: "escenografia", w: 3, h: 0.25, color: "#22c55e", keywords: "verde green screen" },
  { type: "cortina", name: "Cortina / telón", category: "escenografia", w: 3, h: 0.2, color: "#7f1d1d" },
  { type: "pared", name: "Pared / panel", category: "escenografia", w: 2, h: 0.1, color: "#d6d3d1", keywords: "flat muro" },
  { type: "sofa", name: "Sofá", category: "escenografia", w: 2, h: 0.9, color: "#78716c", rotation: 180 },
  { type: "silla", name: "Silla", category: "escenografia", w: 0.5, h: 0.5, color: "#a8a29e", rotation: 180 },
  { type: "banco", name: "Banco / taburete", category: "escenografia", w: 0.4, h: 0.4, color: "#a8a29e" },
  { type: "mesa", name: "Mesa", category: "escenografia", w: 1.4, h: 0.8, color: "#d6d3d1" },
  { type: "mesa-redonda", name: "Mesa redonda", category: "escenografia", w: 1, h: 1, color: "#d6d3d1" },
  { type: "caja", name: "Caja / cubo", category: "escenografia", w: 0.5, h: 0.5, color: "#e7e5e4", keywords: "apple box" },
  { type: "planta", name: "Planta", category: "escenografia", w: 0.6, h: 0.6, color: "#15803d" },
  { type: "arbol-navidad", name: "Árbol de navidad", category: "escenografia", w: 1.1, h: 1.1, color: "#166534", keywords: "pino" },
  { type: "alfombra", name: "Alfombra", category: "escenografia", w: 2.4, h: 1.6, color: "#b45309" },
  { type: "tarima", name: "Tarima / riser", category: "escenografia", w: 2.4, h: 1.2, color: "#a8a29e", keywords: "escenario practicable" },
  { type: "tv", name: "Pantalla / TV", category: "escenografia", w: 1.4, h: 0.12, color: "#111827", watts: 150, cable: 2 },
  { type: "estante", name: "Estante / librero", category: "escenografia", w: 1.2, h: 0.35, color: "#92400e" },
  { type: "puerta", name: "Puerta", category: "escenografia", w: 0.9, h: 0.9, color: "#6b7280" },

  // ─── Eléctrico ──────────────────────────────────────────────
  { type: "toma", name: "Toma de corriente (pared)", category: "electrico", w: 0.2, h: 0.12, color: "#f59e0b", source: { kind: "toma", amps: 15, sockets: 2 }, keywords: "contacto enchufe outlet" },
  { type: "regleta", name: "Regleta / multicontacto", category: "electrico", w: 0.45, h: 0.1, color: "#f97316", source: { kind: "regleta", amps: 15, sockets: 6 }, cable: 1.8, keywords: "power strip" },
  { type: "extension", name: "Extensión (carrete)", category: "electrico", w: 0.3, h: 0.3, color: "#ea580c", source: { kind: "extension", amps: 13, sockets: 3 }, cable: 10, keywords: "alargue" },
  { type: "distribuidor", name: "Distribuidor / caja", category: "electrico", w: 0.5, h: 0.35, color: "#dc2626", source: { kind: "distribuidor", amps: 30, sockets: 8 }, cable: 5, keywords: "power distro" },
  { type: "generador", name: "Generador", category: "electrico", w: 1.2, h: 0.7, color: "#b91c1c", source: { kind: "generador", amps: 50, sockets: 4 }, keywords: "planta" },
  { type: "dimmer", name: "Dimmer / consola DMX", category: "electrico", w: 0.5, h: 0.35, color: "#4b5563", watts: 20, cable: 2 },
  { type: "ups", name: "UPS / no-break", category: "electrico", w: 0.4, h: 0.3, color: "#4b5563", watts: 50, cable: 2 },

  // ─── Anotaciones ────────────────────────────────────────────
  { type: "texto", name: "Texto", category: "anotaciones", w: 1.5, h: 0.3, color: "#111827" },
  { type: "zona", name: "Zona / área", category: "anotaciones", w: 2, h: 1.5, color: "#3b82f6" },
  { type: "flecha", name: "Flecha", category: "anotaciones", w: 0.25, h: 1.2, color: "#ef4444" },
  { type: "marca", name: "Marca de actor", category: "anotaciones", w: 0.3, h: 0.3, color: "#ef4444", keywords: "mark cinta" },
];

const BY_TYPE = new Map(CATALOG.map((c) => [c.type, c]));

export function getCatalogItem(type: string): CatalogItem | undefined {
  return BY_TYPE.get(type);
}

export function isLight(type: string) {
  return getCatalogItem(type)?.category === "luces";
}

/** Items whose footprint is edited freely (walls, rugs, strings of lights…). */
export const STRETCHY = new Set([
  "fondo", "chroma", "cortina", "pared", "alfombra", "tarima", "zona", "texto",
  "navidad", "neon", "tubo-led", "mesa", "rebotador-oro", "rebotador-plata",
  "rebotador-blanco", "difusor", "cortador", "bandera", "flecha", "estante",
  "sofa", "jib", "dolly", "tv",
]);
