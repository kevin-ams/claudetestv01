import { getSession } from "@/lib/auth/session";
import { listIssues } from "@/lib/domain/issues";
import { listTeamMembers } from "@/lib/domain/users";
import { IssueList } from "./issue-list";
import { AddIssueForm } from "./add-issue-form";
import { PageHeader } from "@/components/page-header";

export default async function IssuesPage() {
  const session = await getSession();
  if (!session) return null;

  const [openIssues, solvedIssues, members] = await Promise.all([
    listIssues(session.teamId, "open"),
    listIssues(session.teamId, "solved"),
    listTeamMembers(session.teamId),
  ]);

  return (
    <div className="tone-issues mx-auto max-w-4xl">
      <PageHeader
        module="issues"
        title="Issues List (IDS)"
        description="La lista maestra de obstáculos y oportunidades. Identifica, Discute y Resuelve."
      />
      <div className="mb-6">
        <AddIssueForm members={members} />
      </div>
      <IssueList openIssues={openIssues} solvedIssues={solvedIssues} members={members} />
    </div>
  );
}
