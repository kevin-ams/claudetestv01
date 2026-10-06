export function FormMessage({ error, success }: { error: string | null; success?: string | null }) {
  if (error) return <p className="text-sm text-red">{error}</p>;
  if (success) return <p className="text-sm text-green">{success}</p>;
  return null;
}
