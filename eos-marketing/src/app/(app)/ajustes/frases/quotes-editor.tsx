"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Input, TextArea } from "@heroui/react";
import { AppCheckbox } from "@/components/ui/checkbox";
import { AppSelect } from "@/components/ui/select";
import type { Quote } from "@/lib/domain/quotes";
import {
  createQuoteAction,
  deleteQuoteAction,
  restoreCatalogAction,
  setQuoteActiveAction,
  type QuoteResult,
} from "./actions";

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function QuotesEditor({
  quotes,
  todayId,
  categories,
  canEdit,
}: {
  quotes: Quote[];
  todayId: number | null;
  categories: Record<string, string>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [newCategory, setNewCategory] = useState("inspiracion");
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [pending, startTransition] = useTransition();

  const allCategories = useMemo(() => {
    const keys = new Set([...Object.keys(categories), ...quotes.map((q) => q.category).filter(Boolean)]);
    return [...keys].map((k) => ({ key: k, label: categories[k] ?? k }));
  }, [categories, quotes]);
  const label = (k: string) => categories[k] ?? k;

  const shown = quotes.filter(
    (q) =>
      (!category || q.category === category) &&
      (!status || (status === "on" ? q.active : !q.active)) &&
      (!query || norm(`${q.text} ${q.author}`).includes(norm(query)))
  );
  const active = quotes.filter((q) => q.active).length;

  const run = (fn: () => Promise<QuoteResult>, after?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      setResult(res);
      if (res.ok) {
        after?.();
        router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-4">
      {canEdit ? (
        <Card>
          <Card.Header>
            <Card.Title>Agregar frase</Card.Title>
          </Card.Header>
          <Card.Content className="gap-2">
            <TextArea
              aria-label="Frase"
              fullWidth
              placeholder="Escribe la frase…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Input aria-label="Autor" placeholder="Autor (opcional)" value={author} onChange={(e) => setAuthor(e.target.value)} className="w-56" />
              <AppSelect aria-label="Categoría" className="w-44" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                {allCategories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </AppSelect>
              <Button
                isPending={pending}
                isDisabled={text.trim().length < 5}
                onPress={() =>
                  run(
                    () => createQuoteAction({ text, author, category: newCategory }),
                    () => {
                      setText("");
                      setAuthor("");
                    }
                  )
                }
              >
                + Agregar
              </Button>
              <Button variant="outline" isDisabled={pending} onPress={() => run(restoreCatalogAction)} className="ml-auto">
                Restaurar banco inicial
              </Button>
            </div>
            {result && <p className={`text-sm ${result.ok ? "text-green" : "text-red"}`}>{result.message}</p>}
          </Card.Content>
        </Card>
      ) : (
        <p className="rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow">Tu rol puede ver las frases, pero no cambiarlas.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="Buscar" placeholder="Buscar frase o autor…" value={query} onChange={(e) => setQuery(e.target.value)} className="w-64" />
        <AppSelect aria-label="Filtrar por categoría" className="w-48" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Todas las categorías</option>
          {allCategories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </AppSelect>
        <AppSelect aria-label="Filtrar por estado" className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Activas e inactivas</option>
          <option value="on">Solo activas</option>
          <option value="off">Solo inactivas</option>
        </AppSelect>
        <span className="text-sm text-muted">
          {shown.length} de {quotes.length} · {active} activa(s)
        </span>
      </div>

      <Card className="block gap-0 p-0">
        <ul className="flex flex-col divide-y divide-border">
          {shown.length === 0 && <li className="p-4 text-sm text-muted">No hay frases con este filtro.</li>}
          {shown.map((q) => (
            <li key={q.id} className={`flex flex-wrap items-start gap-3 p-3 ${q.active ? "" : "opacity-60"}`}>
              <AppCheckbox
                aria-label={q.active ? "Desactivar frase" : "Activar frase"}
                checked={q.active}
                disabled={!canEdit || pending}
                onChange={(e) => run(() => setQuoteActiveAction(q.id, e.target.checked))}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{q.text}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                  — {q.author || "Anónimo"}
                  {q.category && (
                    <Chip size="sm" variant="soft">
                      {label(q.category)}
                    </Chip>
                  )}
                  {q.id === todayId && (
                    <Chip size="sm" variant="soft" color="accent">
                      Frase de hoy
                    </Chip>
                  )}
                </p>
              </div>
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red"
                  isDisabled={pending}
                  onPress={() => {
                    if (confirm("¿Eliminar esta frase?")) run(() => deleteQuoteAction(q.id));
                  }}
                >
                  Eliminar
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
