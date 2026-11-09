export type SegmentKey =
  | "segue"
  | "scorecard"
  | "rocks"
  | "headlines"
  | "todos"
  | "ids"
  | "conclude";

export type SegmentDef = {
  key: SegmentKey;
  label: string;
  minutes: number;
  description: string;
};

export const L10_AGENDA: SegmentDef[] = [
  {
    key: "segue",
    label: "Buenas noticias",
    minutes: 5,
    description: "Buenas noticias, personales y del negocio.",
  },
  {
    key: "scorecard",
    label: "Scorecard",
    minutes: 5,
    description: "Revisa los números de la semana. Cualquier número en rojo se convierte en Issue.",
  },
  {
    key: "rocks",
    label: "Rocks",
    minutes: 5,
    description: "On-track u off-track. Cualquier Rock off-track se convierte en Issue.",
  },
  {
    key: "headlines",
    label: "Noticias",
    minutes: 5,
    description: "Noticias externas y del equipo. Solo informativo, no se discute aquí; se publican en el Dashboard.",
  },
  {
    key: "todos",
    label: "To-Do List",
    minutes: 5,
    description: "Revisa los to-dos de la semana pasada. ¿Hecho o no hecho?",
  },
  {
    key: "ids",
    label: "IDS",
    minutes: 60,
    description: "Identificar, Discutir, Resolver: ataca la lista de Issues por prioridad.",
  },
  {
    key: "conclude",
    label: "Conclusión",
    minutes: 5,
    description: "Recapitula los nuevos to-dos, mensajes a cascadear y califica la reunión del 1 al 10.",
  },
];

export const TOTAL_MEETING_MINUTES = L10_AGENDA.reduce(
  (sum, s) => sum + s.minutes,
  0
);

export function segmentIndex(key: string | null): number {
  if (!key) return -1;
  return L10_AGENDA.findIndex((s) => s.key === key);
}

export function nextSegment(key: string | null): SegmentDef | null {
  const idx = segmentIndex(key);
  if (idx === -1) return L10_AGENDA[0];
  if (idx >= L10_AGENDA.length - 1) return null;
  return L10_AGENDA[idx + 1];
}
