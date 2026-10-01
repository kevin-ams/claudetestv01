import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { avatarUrl, getProfile, PRONOUNS } from "@/lib/domain/profile";
import { ProfileForm } from "./profile-form";

export default async function PerfilPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const profile = await getProfile(session.userId);
  if (!profile) redirect("/salir");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Mi perfil</h1>
        <p className="text-sm text-muted">Tu nombre, cómo quieres que te nombren, tu foto y tu color.</p>
      </div>
      <ProfileForm
        profile={{ ...profile, avatarSrc: avatarUrl(profile) }}
        pronouns={PRONOUNS.map((p) => ({ key: p.key, label: p.label }))}
      />
    </div>
  );
}
