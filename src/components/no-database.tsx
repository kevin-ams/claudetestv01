import Link from "next/link";

/** Shown instead of the EOS login/setup when no database is available. */
export function NoDatabase() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-xl font-bold">Base de datos no configurada</h1>
        <p className="mt-2 text-sm text-muted">
          La app EOS necesita Netlify Database. Para usarla en local, arráncala con{" "}
          <code className="rounded bg-slate-100 px-1">npx netlify dev</code> en lugar de{" "}
          <code className="rounded bg-slate-100 px-1">npm run dev</code>.
        </p>
        <p className="mt-4 text-sm text-muted">
          El editor de planos no necesita base de datos y funciona igual:
        </p>
        <Link href="/plano" className="btn btn-primary mt-3 w-full">
          💡 Abrir Plano de iluminación
        </Link>
      </div>
    </div>
  );
}
