import type { ReactNode } from "react";
import { MODULES, type ModuleKey } from "@/lib/ui/modules";

export function PageHeader({
  module,
  title,
  description,
  actions,
}: {
  module: ModuleKey;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  const Icon = MODULES[module].icon;
  return (
    <div className={`tone-${module} page-hero animate-in mb-6 p-5 md:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="icon-chip icon-chip-solid !h-12 !w-12 !rounded-2xl">
            <Icon size={24} strokeWidth={2.2} aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {description && (
              <p className="mt-0.5 max-w-2xl text-sm text-muted">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

export function SectionTitle({
  children,
  count,
}: {
  children: ReactNode;
  count?: number;
}) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
      <span className="h-3.5 w-1 rounded-full bg-tone" aria-hidden />
      {children}
      {count !== undefined && (
        <span className="bg-tone-soft text-tone rounded-full px-2 py-0.5 text-[11px]">
          {count}
        </span>
      )}
    </h2>
  );
}
