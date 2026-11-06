import { BookOpen } from "@gravity-ui/icons";
import Link from "next/link";

export type RelatedNote = { id: number; title: string };
export type RelatedNotesMap = Record<number, RelatedNote[]>;

/** Notas del vault (Conocimiento) que mencionan este rock, issue o indicador. */
export function RelatedNotes({ notes, compact = false }: { notes?: RelatedNote[]; compact?: boolean }) {
  if (!notes?.length) return null;
  if (compact) {
    return (
      <Link
        href={`/conocimiento?nota=${notes[0].id}`}
        className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
        title={`Notas relacionadas: ${notes.map((n) => n.title).join(", ")}`}
      >
        <BookOpen width={12} height={12} aria-hidden />
        {notes.length}
      </Link>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
      <span className="inline-flex items-center gap-1 text-muted">
        <BookOpen width={12} height={12} aria-hidden /> Notas relacionadas:
      </span>
      {notes.map((n) => (
        <Link key={n.id} href={`/conocimiento?nota=${n.id}`} className="text-primary hover:underline">
          {n.title}
        </Link>
      ))}
    </div>
  );
}
