"use client";

import { usePathname, useRouter } from "next/navigation";
import { AppSelect } from "@/components/ui/select";

export function LogFilters({
  modules,
  members,
  module,
  person,
}: {
  modules: { key: string; label: string }[];
  members: { id: number; name: string }[];
  module: string;
  person: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const go = (next: { modulo?: string; persona?: string }) => {
    const q = new URLSearchParams();
    const m = next.modulo ?? module;
    const p = next.persona ?? person;
    if (m) q.set("modulo", m);
    if (p) q.set("persona", p);
    router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false });
  };
  return (
    <div className="flex flex-wrap gap-2">
      <AppSelect aria-label="Módulo" className="w-56" value={module} onChange={(e) => go({ modulo: e.target.value })}>
        <option value="">Todos los módulos</option>
        {modules.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label}
          </option>
        ))}
      </AppSelect>
      <AppSelect aria-label="Persona" className="w-48" value={person} onChange={(e) => go({ persona: e.target.value })}>
        <option value="">Todas las personas</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </AppSelect>
    </div>
  );
}
