const num = new Intl.NumberFormat("es-MX");
const money = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });

export const fmtNum = (n: number) => num.format(n);
export const fmtMoney = (n: number) => `$${money.format(n)}`;
export const fmtPct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);

export function fmtDays(n: number | null): string {
  if (n === null) return "—";
  if (n < 1) return "< 1 d";
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} d`;
}

export function fmtHours(n: number | null): string {
  if (n === null) return "—";
  if (n < 1) return `${Math.round(n * 60)} min`;
  if (n < 48) return `${n < 10 ? n.toFixed(1) : Math.round(n)} h`;
  return `${Math.round(n / 24)} d`;
}

const dateFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "2-digit" });
export const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "—");

export const RANGE_OPTIONS = [
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "90d", label: "Últimos 90 días" },
  { value: "mes", label: "Este mes" },
  { value: "mes_ant", label: "Mes anterior" },
  { value: "anio", label: "Este año" },
  { value: "todo", label: "Todo" },
  { value: "custom", label: "Personalizado" },
];
