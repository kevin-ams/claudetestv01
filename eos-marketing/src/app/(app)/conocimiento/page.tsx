import { getAccess } from "@/lib/auth/access";
import { getVault, listEosEntities, listNotes } from "@/lib/domain/vault";
import { VaultApp } from "./vault-app";

/** Conocimiento (Vault): notas en Markdown de toda la organización, enlazadas entre sí y con EOS. */
export default async function ConocimientoPage() {
  const access = await getAccess();
  if (!access) return null;
  const vault = await getVault(access.session.teamId);
  const [notes, entities] = await Promise.all([listNotes(vault.id), listEosEntities(access.session.teamId)]);
  return (
    <div className="mx-auto max-w-[1600px]">
      <VaultApp initialNotes={notes} entities={entities} canEdit={access.level("conocimiento") === "edit"} />
    </div>
  );
}
