import { startOfWeek, addWeeks, addDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export function weekStartISO(date: Date = new Date()): string {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return format(monday, "yyyy-MM-dd");
}

export function shiftWeek(weekStart: string, delta: number): string {
  const monday = startOfWeek(parseISO(weekStart), { weekStartsOn: 1 });
  return format(addWeeks(monday, delta), "yyyy-MM-dd");
}

export function lastNWeeks(n: number, from: string = weekStartISO()): string[] {
  const weeks: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    weeks.push(shiftWeek(from, -i));
  }
  return weeks;
}

export function formatWeekLabel(weekStart: string): string {
  const d = parseISO(weekStart);
  return format(d, "d MMM", { locale: es });
}

export function currentQuarter(date: Date = new Date()): { quarter: number; year: number } {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return { quarter, year: date.getFullYear() };
}

/** "14 – 20 sep 2026" para la semana que inicia el lunes indicado. */
export function formatWeekRange(weekStart: string): string {
  const start = parseISO(weekStart);
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  return sameMonth
    ? `${format(start, "d")} – ${format(end, "d MMM yyyy", { locale: es })}`
    : `${format(start, "d MMM", { locale: es })} – ${format(end, "d MMM yyyy", { locale: es })}`;
}

/** Última semana completa: la que se revisa en la reunión L10. */
export function lastClosedWeek(): string {
  return shiftWeek(weekStartISO(), -1);
}
