import { type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { weeksBetween } from "@/lib/domain/careers";
import { fileResponse, parseFormat, workbookFile } from "@/lib/export/excel";
import { scorecardWorkbook } from "@/lib/export/workbooks";
import { lastNWeeks } from "@/lib/utils/dates";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/exportar/scorecard?desde=yyyy-mm-dd&hasta=yyyy-mm-dd&formato=xlsm|xlsx */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("No autenticado", { status: 401 });
  const q = request.nextUrl.searchParams;
  const from = q.get("desde") ?? "";
  const to = q.get("hasta") ?? "";
  const weeks = DATE.test(from) && DATE.test(to) ? weeksBetween(from, to) : lastNWeeks(12);
  const format = parseFormat(q.get("formato"));
  const wb = await scorecardWorkbook(session.teamId, weeks);
  return fileResponse(await workbookFile(wb, format), `scorecard_${weeks[0]}_${weeks.at(-1)}`, format);
}
