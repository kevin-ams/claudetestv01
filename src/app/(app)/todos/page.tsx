import { getSession } from "@/lib/auth/session";
import { listTodos } from "@/lib/domain/todos";
import { listTeamMembers } from "@/lib/domain/users";
import { TodoList } from "./todo-list";

export default async function TodosPage() {
  const session = await getSession();
  if (!session) return null;

  const [todos, members] = await Promise.all([
    listTodos(session.teamId),
    listTeamMembers(session.teamId),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">To-Dos</h1>
        <p className="text-sm text-muted">
          Tareas de una semana que salen de la Reunión Level 10 o del día a día.
        </p>
      </div>
      <TodoList todos={todos} members={members} />
    </div>
  );
}
