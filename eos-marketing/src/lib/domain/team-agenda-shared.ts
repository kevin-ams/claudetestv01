export type AgendaStatus = "on_track" | "off_track";

export type AgendaItem = {
  id: number;
  user_id: number;
  user_name: string;
  week_start: string;
  title: string;
  detail: string;
  status: AgendaStatus;
  due_date: string | null;
  clickup_task_id: string | null;
  clickup_url: string | null;
  clickup_list: string;
  issue_id: number | null;
};

export function isAgendaStatus(v: unknown): v is AgendaStatus {
  return v === "on_track" || v === "off_track";
}

/** Tarea de ClickUp candidata a importarse a la agenda. */
export type ClickUpWeekTask = {
  id: string;
  name: string;
  url: string;
  list: string;
  status: string;
  dueDate: string | null; // yyyy-mm-dd
  overdue: boolean;
  imported: boolean;
};
