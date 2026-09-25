import { getCatalogItem } from "./catalog";
import type { Plan, PlanItem } from "./types";

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function createItem(type: string, x: number, y: number, existing: PlanItem[] = []): PlanItem {
  const c = getCatalogItem(type);
  if (!c) throw new Error(`Tipo desconocido: ${type}`);
  const n = existing.filter((i) => i.type === type).length + 1;
  const item: PlanItem = {
    id: newId(),
    type,
    x,
    y,
    rotation: c.rotation ?? 0,
    w: c.w,
    h: c.h,
    label: type === "texto" ? "Texto" : `${c.name} ${n}`,
    color: c.color ?? "#9ca3af",
    notes: "",
  };
  if (c.watts !== undefined) item.watts = c.watts;
  if (c.cable !== undefined) item.cable = c.cable;
  if (c.source) item.source = { ...c.source };
  if (c.beam !== undefined) {
    item.beam = c.beam;
    item.throw = c.throw;
    item.kelvin = c.kelvin;
    item.intensity = 100;
    item.showBeam = true;
  }
  if (type === "texto") item.fontSize = 0.25;
  return item;
}

/** Approximate RGB of a black-body source (Tanner Helland's fit). */
export function kelvinToHex(kelvin: number) {
  const t = Math.max(1000, Math.min(40000, kelvin)) / 100;
  let r: number, g: number, b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function emptyPlan(name = "Nuevo plano"): Plan {
  return {
    id: newId(),
    name,
    stage: { width: 8, depth: 6, grid: 0.5, snap: true, showGrid: true, floorColor: "#f4f5f4" },
    electrical: { voltage: 120, circuitAmps: 15, safety: 0.8, socketsPerOutlet: 2 },
    items: [],
    updatedAt: Date.now(),
  };
}

type Seed = [type: string, x: number, y: number, extra?: Partial<PlanItem>];

function build(name: string, width: number, depth: number, seeds: Seed[]): Plan {
  const plan = emptyPlan(name);
  plan.stage.width = width;
  plan.stage.depth = depth;
  for (const [type, x, y, extra] of seeds) {
    plan.items.push({ ...createItem(type, x, y, plan.items), ...extra });
  }
  return plan;
}

export const TEMPLATES: { id: string; name: string; description: string; make: () => Plan }[] = [
  {
    id: "vacio",
    name: "En blanco",
    description: "Escenario de 8 × 6 m sin elementos.",
    make: () => emptyPlan(),
  },
  {
    id: "sesion-acustica",
    name: "Sesión acústica (ejemplo)",
    description: "3 músicos, 2 voces, foco práctico, rebotador dorado, 3 cámaras y 2 luces.",
    make: () =>
      build("Sesión acústica", 8, 5.5, [
        ["fondo", 4, 0.2, { w: 7.6, label: "Fondo blanco" }],
        ["musico", 2.2, 1.3, { label: "Guitarra 1" }],
        ["practica", 2.6, 1.8, { label: "Foco práctico" }],
        ["persona", 4.1, 0.8, { label: "Voz principal" }],
        ["octabox", 4.1, 1.55, { rotation: 0, label: "Key cenital", showBeam: false }],
        ["musico", 6.1, 1.3, { label: "Guitarra 2" }],
        ["softbox", 6.1, 1.9, { rotation: 0, w: 0.75, label: "Fill músico 2", showBeam: false }],
        ["persona", 3.4, 2.7, { label: "Voz 2" }],
        ["practica", 4.1, 2.8, { label: "Foco práctico central" }],
        ["persona-pelo-largo", 5.1, 2.7, { label: "Voz 3" }],
        ["rebotador-oro", 0.9, 4.1, { rotation: 45, w: 1.6, label: "Rebotador dorado" }],
        ["camara", 4.1, 5.0, { label: "Cámara A (central)" }],
        ["cob", 5.9, 4.7, { rotation: -40, label: "Key izquierda" }],
        ["camara", 7.2, 4.4, { rotation: -45, label: "Cámara B" }],
        ["camara", 0.9, 3.2, { rotation: 40, label: "Cámara C" }],
        ["toma", 0.15, 5.3, { rotation: 270, label: "Toma pared 1" }],
        ["toma", 7.85, 5.3, { rotation: 90, label: "Toma pared 2" }],
      ]),
  },
  {
    id: "podcast",
    name: "Podcast 2 personas",
    description: "Mesa, 2 invitados, key + contraluces, 3 cámaras y fondo con luces navideñas.",
    make: () =>
      build("Podcast", 6, 5, [
        ["pared", 3, 0.2, { w: 5, label: "Pared de fondo" }],
        ["navidad", 3, 0.45, { w: 4, label: "Luces navideñas" }],
        ["planta", 0.8, 0.8, {}],
        ["estante", 5, 0.6, {}],
        ["mesa", 3, 2.4, { w: 1.6 }],
        ["persona-sentada", 2, 2.4, { rotation: 90, label: "Host" }],
        ["persona-sentada", 4, 2.4, { rotation: 270, label: "Invitado" }],
        ["vela", 2.85, 2.25, {}],
        ["vela", 3.15, 2.5, {}],
        ["softbox", 1.1, 3.6, { rotation: 45, label: "Key host" }],
        ["softbox", 4.9, 3.6, { rotation: -45, label: "Key invitado" }],
        ["backlight", 1.2, 1.2, { rotation: 135, label: "Contra host" }],
        ["backlight", 4.8, 1.2, { rotation: -135, label: "Contra invitado" }],
        ["camara-tripode", 3, 4.3, { label: "Cam A — plano abierto" }],
        ["camara", 1.4, 4.4, { rotation: 30, label: "Cam B — invitado" }],
        ["camara", 4.6, 4.4, { rotation: -30, label: "Cam C — host" }],
      ]),
  },
  {
    id: "banda",
    name: "Banda en vivo",
    description: "Batería en tarima, bajo, guitarra, teclado, monitores, PARs y cabezas móviles.",
    make: () =>
      build("Banda en vivo", 10, 7, [
        ["cortina", 5, 0.15, { w: 9.6 }],
        ["tarima", 5, 1.4, { w: 3, h: 2 }],
        ["bateria", 5, 1.4, {}],
        ["amplificador", 2, 0.8, {}],
        ["amplificador", 8, 0.8, {}],
        ["musico", 2.2, 2.4, { label: "Bajo" }],
        ["musico", 7.8, 2.4, { label: "Guitarra" }],
        ["persona", 5, 3.6, { label: "Voz" }],
        ["microfono", 5, 4.0, {}],
        ["teclado", 3.5, 3.4, { rotation: 160 }],
        ["monitor-piso", 5, 4.6, {}],
        ["monitor-piso", 2.2, 3.3, {}],
        ["monitor-piso", 7.8, 3.3, {}],
        ["par", 1, 6.2, { rotation: 20, beamColor: "#a855f7" }],
        ["par", 3.5, 6.2, { beamColor: "#3b82f6" }],
        ["par", 6.5, 6.2, { beamColor: "#3b82f6" }],
        ["par", 9, 6.2, { rotation: -20, beamColor: "#a855f7" }],
        ["cabeza-movil", 2.5, 0.4, { rotation: 180 }],
        ["cabeza-movil", 7.5, 0.4, { rotation: 180 }],
        ["humo", 9.3, 0.8, {}],
        ["camara-tripode", 5, 6.3, { label: "Cam A" }],
        ["jib", 8.8, 5.2, { rotation: -50, label: "Grúa" }],
        ["camara", 0.8, 3.8, { rotation: 70, label: "Cam lateral" }],
      ]),
  },
];

export function clonePlan(plan: Plan): Plan {
  return JSON.parse(JSON.stringify(plan));
}
