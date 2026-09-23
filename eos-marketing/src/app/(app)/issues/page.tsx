import { getSession } from "@/lib/auth/session";
import { listIssues } from "@/lib/domain/issues";
import { listTeamMembers } from "@/lib/domain/users";
import { isClickUpConfigured } from "@/lib/integrations/clickup";
import { IssueList } from "./issue-list";
import { AddIssueForm } from "./add-issue-form";

export default async function IssuesPage() {
  const session = await getSession();
  if (!session) return null;

  const [openIssues, solvedIssues, members] = await Promise.all([
    listIssues(session.teamId, "open"),
    listIssues(session.teamId, "solved"),
    listTeamMembers(session.teamId),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Issues List (IDS)</h1>
        <p className="text-sm text-muted">
          La lista maestra de obstáculos y oportunidades. Identifica, Discute y Resuelve.
        </p>
      </div>
      <div className="mb-6">
        <AddIssueForm members={members} />
      </div>
      <IssueList
        openIssues={openIssues}
        solvedIssues={solvedIssues}
        members={members}
        clickupConfigured={isClickUpConfigured()}
      />
    </div>
  );
}
