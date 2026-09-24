import { type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { fileResponse, parseFormat, workbookFile } from "@/lib/export/excel";
import { careerWorkbook } from "@/lib/export/workbooks";
import { lastClosedWeek, shiftWeek } from "@/lib/utils/dates";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/exportar/indicadores?desde=yyyy-mm-dd&hasta=yyyy-mm-dd&formato=xlsm|xlsx */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("No autenticado", { status: 401 });
  const q = request.nextUrl.searchParams;
  const to = DATE.test(q.get("hasta") ?? "") ? shiftWeek(q.get("hasta")!, 0) : lastClosedWeek();
  const from = DATE.test(q.get("desde") ?? "") ? shiftWeek(q.get("desde")!, 0) : shiftWeek(to, -11);
  if (from > to) return new Response("El rango de fechas no es válido", { status: 400 });
  const format = parseFormat(q.get("formato"));
  const wb = await careerWorkbook(session.teamId, from, to);
  return fileResponse(await workbookFile(wb, format), `indicadores_carrera_${from}_${to}`, format);
}
