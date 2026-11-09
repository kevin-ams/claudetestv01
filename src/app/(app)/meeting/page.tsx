import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { listMeetings, getActiveMeeting } from "@/lib/domain/meetings";
import { StartMeetingButton } from "./start-meeting-button";
import { PageHeader, SectionTitle } from "@/components/page-header";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Programada",
  in_progress: "En curso",
  completed: "Completada",
};

function ratingClass(rating: number | null) {
  if (rating === null) return "bg-background text-muted";
  const r = Number(rating);
  if (r >= 8) return "bg-emerald-100 text-emerald-700";
  if (r >= 6) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

export default async function MeetingListPage() {
  const session = await getSession();
  if (!session) return null;

  const [meetings, active] = await Promise.all([
    listMeetings(session.teamId),
    getActiveMeeting(session.teamId),
  ]);

  return (
    <div className="tone-meeting mx-auto max-w-3xl">
      <PageHeader
        module="meeting"
        title="Reunión Level 10"
        description="La agenda semanal de 90 minutos: Segue, Scorecard, Rocks, Titulares, To-Dos, IDS y Conclusión."
        actions={
          active ? (
            <Link href={`/meeting/${active.id}`} className="btn btn-primary">
              <span className="pulse-dot !bg-white" aria-hidden /> Continuar reunión en curso →
            </Link>
          ) : (
            <StartMeetingButton />
          )
        }
      />

      <SectionTitle count={meetings.length}>Historial</SectionTitle>
      {meetings.length === 0 ? (
        <p className="text-sm text-muted">Todavía no has hecho ninguna reunión.</p>
      ) : (
        <ul className="stagger flex flex-col gap-2">
          {meetings.map((m) => (
            <li
              key={m.id}
              className={`${
                m.status === "in_progress" ? "tone-meeting" : m.status === "completed" ? "tone-vto" : "tone-team"
              } card lift accent-left flex items-center justify-between gap-3 p-3`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-11 w-11 flex-col items-center justify-center rounded-xl text-sm font-extrabold ${ratingClass(m.avg_rating)}`}
                  title="Calificación"
                >
                  {m.avg_rating !== null ? Number(m.avg_rating).toFixed(1) : "–"}
                </span>
                <div>
                  <p className="font-medium">
                    Reunión #{m.id} · {new Date(m.created_at).toLocaleDateString("es-GT")}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    {m.status === "in_progress" && <span className="pulse-dot" aria-hidden />}
                    {STATUS_LABEL[m.status]}
                  </p>
                </div>
              </div>
              <Link href={`/meeting/${m.id}`} className="btn btn-secondary text-xs">
                Ver
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
