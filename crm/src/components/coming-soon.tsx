import { LogoSymbol } from "@/components/logo";

export function ComingSoon({
  title,
  phase,
  description,
}: {
  title: string;
  phase: number;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <div className="card mt-6 flex flex-col items-center px-6 py-16 text-center">
        <LogoSymbol className="h-10 w-auto opacity-80" />
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-brand">
          Fase {phase}
        </p>
        <p className="mt-2 max-w-md text-sm text-muted">{description}</p>
      </div>
    </div>
  );
}
