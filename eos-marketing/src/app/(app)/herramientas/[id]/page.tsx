import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { buttonVariants } from "@heroui/styles";
import { requireModulePage } from "@/lib/auth/access";
import { listVisibleTools } from "@/lib/domain/tools";
import { embedUrl } from "@/lib/domain/tools-shared";
import { ArrowUpRightFromSquare } from "@gravity-ui/icons";
import { ToolIcon } from "@/components/tool-icon";

/** Mini módulo: el sitio de la herramienta insertado en la app. */
export default async function ToolPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireModulePage("herramientas");
  const { id } = await params;
  const tools = await listVisibleTools({
    teamId: access.session.teamId,
    userId: access.session.userId,
    roleId: access.roleId,
    isAdmin: access.isAdmin,
  });
  const tool = tools.find((t) => t.id === Number(id));
  if (!tool) notFound();
  if (tool.kind === "link") redirect(tool.url);

  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-muted">
            <Link href="/herramientas" className="text-primary underline">
              Otras herramientas
            </Link>{" "}
            / {tool.name}
          </p>
          <h1 className="flex items-center gap-2 truncate text-xl font-bold">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ToolIcon name={tool.icon} kind={tool.kind} size={18} />
            </span>
            {tool.name}
          </h1>
        </div>
        <a href={tool.url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Abrir en pestaña nueva <ArrowUpRightFromSquare aria-hidden />
        </a>
      </div>
      <iframe
        src={embedUrl(tool.url)}
        title={tool.name}
        className="min-h-0 w-full flex-1 rounded-xl border border-border bg-card"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="clipboard-read; clipboard-write; fullscreen"
        allowFullScreen
      />
      <p className="text-xs text-muted">
        ¿No carga? Algunos sitios no permiten mostrarse dentro de otras páginas o piden iniciar sesión: usa “Abrir en pestaña
        nueva”.
      </p>
    </div>
  );
}
