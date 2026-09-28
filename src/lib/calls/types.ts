export type CallOutcome = "efectiva" | "no_contesto" | "numero_equivocado" | "otro" | "pendiente";

export type PriorContact = "si" | "no" | "no_recuerda";

export type InterestLevel = "interesado" | "solo_info" | "inscrito" | "no_interesa";

/** Un lead de la hoja, normalizado. Si todavía no se le llamó, `outcome` es "pendiente". */
export type CallRecord = {
  id: string;
  sheet: string;
  faculty: string;
  level: "Pregrado" | "Postgrado" | "Otro";
  program: string;
  name: string;
  phone: string;
  email: string;
  /** Fecha de creación del lead, YYYY-MM-DD. */
  leadDate: string | null;
  outcome: CallOutcome;
  /** Texto original de "ESTADO LLAMADA" cuando no coincide con una opción conocida. */
  outcomeRaw: string;
  priorContact: PriorContact | null;
  interests: InterestLevel[];
  notes: string;
  agent: string | null;
  /** Fecha de la llamada, YYYY-MM-DD. */
  callDate: string | null;
  /** Hora de la llamada, 0-23. */
  callHour: number | null;
  callTime: string | null;
};

export type CallsDataset = {
  records: CallRecord[];
  sheetTitle: string;
  syncedAt: string;
  source: "google" | "fixture";
  warnings: string[];
};
