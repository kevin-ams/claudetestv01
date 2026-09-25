export type Category =
  | "personas"
  | "camaras"
  | "luces"
  | "modificadores"
  | "instrumentos"
  | "escenografia"
  | "electrico"
  | "anotaciones";

/** Kind of power source. Wall outlets and generators are circuit roots. */
export type SourceKind = "toma" | "regleta" | "extension" | "generador" | "distribuidor";

export interface SourceSpec {
  kind: SourceKind;
  /** Rated current of the source (A). */
  amps: number;
  /** Number of sockets available for plugging devices / other sources. */
  sockets: number;
}

export interface CatalogItem {
  type: string;
  name: string;
  category: Category;
  /** Footprint in meters (width along x, depth along y at rotation 0). */
  w: number;
  h: number;
  color?: string;
  /** Rotation applied when the item is added. 0 = facing the back of the stage. */
  rotation?: number;
  /** Power draw in watts. Items without it don't need power. */
  watts?: number;
  /** Light beam: angle in degrees (360 = omnidirectional glow) and throw in meters. */
  beam?: number;
  throw?: number;
  kelvin?: number;
  source?: SourceSpec;
  /** Length of the item's own power cable (m). */
  cable?: number;
  keywords?: string;
}

export interface PlanItem {
  id: string;
  type: string;
  x: number;
  y: number;
  rotation: number;
  w: number;
  h: number;
  label: string;
  color: string;
  notes: string;
  locked?: boolean;
  hidden?: boolean;
  watts?: number;
  beam?: number;
  throw?: number;
  kelvin?: number;
  /** 0–100 */
  intensity?: number;
  /** Show the light beam cone for this item. */
  showBeam?: boolean;
  /** Custom beam color (e.g. RGB fixtures); overrides the kelvin color. */
  beamColor?: string;
  cable?: number;
  source?: SourceSpec;
  /** Id of the power source this item is plugged into. */
  powerFrom?: string;
  /** Free-form DMX / dimmer channel. */
  channel?: string;
  /** Text size for annotations. */
  fontSize?: number;
}

export interface StageSettings {
  /** Width (x) and depth (y) in meters. */
  width: number;
  depth: number;
  grid: number;
  snap: boolean;
  showGrid: boolean;
  floorColor: string;
}

export interface ElectricalSettings {
  voltage: number;
  /** Amps of a standard wall circuit, used to estimate required outlets. */
  circuitAmps: number;
  /** Max continuous load as a fraction of the rating (NEC 80% rule). */
  safety: number;
  /** Default number of sockets per wall outlet. */
  socketsPerOutlet: number;
}

export interface Plan {
  id: string;
  name: string;
  stage: StageSettings;
  electrical: ElectricalSettings;
  items: PlanItem[];
  updatedAt: number;
}

export interface ViewSettings {
  mode: "iluminacion" | "electrico";
  showBeams: boolean;
  showLabels: boolean;
  showCables: boolean;
  showDimensions: boolean;
}
