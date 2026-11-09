import { getSession } from "@/lib/auth/session";
import { listTodos } from "@/lib/domain/todos";
import { listTeamMembers } from "@/lib/domain/users";
import { TodoList } from "./todo-list";
import { PageHeader } from "@/components/page-header";

export default async function TodosPage() {
  const session = await getSession();
  if (!session) return null;

  const [todos, members] = await Promise.all([
    listTodos(session.teamId),
    listTeamMembers(session.teamId),
  ]);

  return (
    <div className="tone-todos mx-auto max-w-3xl">
      <PageHeader
        module="todos"
        title="To-Dos"
        description="Tareas de una semana que salen de la Reunión Level 10 o del día a día."
      />
      <TodoList todos={todos} members={members} />
    </div>
  );
}
