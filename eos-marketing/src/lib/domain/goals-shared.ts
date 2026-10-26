/** Histórico de metas de una carrera en un año (lo que ya se tenía antes de `from_month`). */
export type GoalHistory = {
  career_id: number;
  year: number;
  from_month: string; // yyyy-mm-01
  leads: number | null;
  budget: number | null;
  cycle_leads: number | null;
  cycle_budget: number | null;
};

export type GoalImportPart = {
  /** Meta (o presupuesto) del ciclo según la hoja. */
  cycle: number;
  /** Lo que ya se tenía antes del primer mes: ciclo − lo que faltaba al inicio del mes. */
  hist: number;
  /** Distribución por mes (yyyy-mm-01 → valor). */
  months: Record<string, number>;
  /** Histórico + meses. */
  total: number;
};

export type GoalImportRow = {
  code: string;
  name: string;
  careerId: number | null;
  match: "code" | "alias" | "name" | "manual" | null;
  leads: GoalImportPart | null;
  budget: GoalImportPart | null;
  warnings: string[];
};

export type GoalImportPreview = {
  year: number;
  months: string[];
  fromMonth: string;
  dataDate: string | null;
  hasLeads: boolean;
  hasBudget: boolean;
  rows: GoalImportRow[];
  /** Carreras (con match) que ya tienen metas en meses del año anteriores a `fromMonth`: se sumarían al histórico. */
  earlierGoals: { careerId: number; label: string; months: string[] }[];
};
