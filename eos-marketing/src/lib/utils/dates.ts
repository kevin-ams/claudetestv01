import { startOfWeek, addWeeks, format, parseISO } from "date-fns";

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
  return format(d, "d MMM");
}

export function currentQuarter(date: Date = new Date()): { quarter: number; year: number } {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return { quarter, year: date.getFullYear() };
}
