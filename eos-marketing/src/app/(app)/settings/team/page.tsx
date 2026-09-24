import { redirect } from "next/navigation";

/** Equipo ahora vive dentro de Ajustes. */
export default function OldTeamSettingsPage() {
  redirect("/ajustes/equipo");
}
