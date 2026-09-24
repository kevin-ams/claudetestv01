import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { listMeetings, getActiveMeeting } from "@/lib/domain/meetings";
import { StartMeetingButton } from "./start-meeting-button";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Programada",
  in_progress: "En curso",
  completed: "Completada",
};

export default async function MeetingListPage() {
  const session = await getSession();
  if (!session) return null;

  const [meetings, active] = await Promise.all([
    listMeetings(session.teamId),
    getActiveMeeting(session.teamId),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reunión Level 10</h1>
          <p className="text-sm text-muted">
            La agenda semanal de 90 minutos: Buenas noticias, Scorecard, Rocks, Noticias,
            To-Dos, IDS y Conclusión.
          </p>
        </div>
        {active ? (
          <Link href={`/meeting/${active.id}`} className="eos-btn eos-btn-primary">
            Continuar reunión en curso →
          </Link>
        ) : (
          <StartMeetingButton />
        )}
      </div>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
        Historial
      </h2>
      {meetings.length === 0 ? (
        <p className="text-sm text-muted">Todavía no has hecho ninguna reunión.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {meetings.map((m) => (
            <li key={m.id} className="eos-card flex items-center justify-between gap-3 p-3">
              <div>
                <p className="font-medium">
                  Reunión #{m.id} · {new Date(m.created_at).toLocaleDateString("es-GT")}
                </p>
                <p className="text-xs text-muted">
                  {STATUS_LABEL[m.status]}
                  {m.avg_rating !== null && ` · Calificación: ${Number(m.avg_rating).toFixed(1)}/10`}
                </p>
              </div>
              <Link href={`/meeting/${m.id}`} className="eos-btn eos-btn-secondary text-xs">
                Ver
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
