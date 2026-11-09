"use client";

import { ArrowRight, Stop } from "@gravity-ui/icons";
import { Button, Card, TextArea } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { STALE } from "@/lib/client-actions";

type Turn = { role: "user" | "assistant"; content: string; steps?: string[]; note?: string; error?: boolean; cached?: boolean };
type Event =
  | { type: "step"; label: string }
  | { type: "text"; delta: string }
  | { type: "done"; cached: boolean; costUsd: number }
  | { type: "error"; code: string; message: string };

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeSanitize, defaultSchema).use(rehypeStringify);

/** [[Nota]] → enlace que abre la nota en el vault por su nombre. */
function toHtml(md: string): string {
  const linked = md.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, target: string, alias?: string) => {
    const label = (alias ?? target).replace(/([\\[\]()*_`])/g, "\\$1");
    return `[${label}](/conocimiento?abrir=${encodeURIComponent(target.trim())})`;
  });
  try {
    return String(processor.processSync(linked));
  } catch {
    return "";
  }
}

const EXAMPLES = [
  "¿Cómo van los Rocks del trimestre y cuáles están off track?",
  "¿Qué indicadores del Scorecard no llegaron a su meta en las últimas semanas?",
  "Prepárame un resumen para la L10 de esta semana.",
  "¿Qué To-Dos están vencidos y de quién son?",
  "¿Qué carreras van por debajo de su meta de leads este mes?",
  "¿Qué dice el vault sobre el proceso de inscripción?",
];

/** Historia que se manda al servidor: solo preguntas y respuestas completas, las últimas 12. */
function historyFor(turns: Turn[], question: string) {
  const done = turns.filter((t) => !t.error && t.content.trim()).map((t) => ({ role: t.role, content: t.content.slice(0, 4000) }));
  const msgs = [...done, { role: "user" as const, content: question }];
  while (msgs.length > 12 || (msgs.length > 1 && msgs[0].role !== "user")) msgs.shift();
  return msgs;
}

export function AssistantChat({ blocked }: { blocked: string | null }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const ctl = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [turns]);
  useEffect(() => () => ctl.current?.abort(), []);

  const patchLast = (fn: (t: Turn) => Turn) => setTurns((ts) => [...ts.slice(0, -1), fn(ts[ts.length - 1])]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy || blocked) return;
    const messages = historyFor(turns, q);
    setTurns((ts) => [...ts, { role: "user", content: q }, { role: "assistant", content: "", steps: [] }]);
    setQuestion("");
    setBusy(true);
    const controller = new AbortController();
    ctl.current = controller;
    try {
      const res = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        patchLast((t) => ({ ...t, error: true, note: data?.error ?? STALE }));
        return;
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let pending = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const lines = (pending + value).split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as Event;
          if (e.type === "step") patchLast((t) => ({ ...t, steps: [...(t.steps ?? []), e.label] }));
          else if (e.type === "text") patchLast((t) => ({ ...t, content: t.content + e.delta }));
          else if (e.type === "done") patchLast((t) => ({ ...t, cached: e.cached }));
          else if (e.type === "error") patchLast((t) => ({ ...t, error: !t.content, note: e.message }));
        }
      }
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      patchLast((t) => ({ ...t, error: !t.content, note: aborted ? "Detenido." : STALE }));
    } finally {
      setBusy(false);
      ctl.current = null;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {blocked && <p className="rounded-lg bg-yellow-bg px-3 py-2 text-sm text-yellow">{blocked}</p>}

      {turns.length === 0 ? (
        <Card className="p-4">
          <p className="mb-3 text-sm text-muted">Algunas preguntas para empezar:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                disabled={Boolean(blocked) || busy}
                onClick={() => send(ex)}
                className="rounded-lg border border-border px-3 py-2 text-left text-sm hover:border-primary hover:text-primary disabled:opacity-50"
              >
                {ex}
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-4" aria-live="polite">
          {turns.map((t, i) => (t.role === "user" ? <UserBubble key={i} text={t.content} /> : <Answer key={i} turn={t} live={busy && i === turns.length - 1} />))}
          <div ref={end} />
        </div>
      )}

      <form
        className="sticky bottom-0 flex items-end gap-2 bg-background py-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(question);
        }}
      >
        <TextArea
          aria-label="Tu pregunta"
          fullWidth
          rows={2}
          value={question}
          disabled={Boolean(blocked)}
          placeholder="Escribe tu pregunta… (Enter envía, Shift+Enter nueva línea)"
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(question);
            }
          }}
        />
        {busy ? (
          <Button type="button" variant="outline" onPress={() => ctl.current?.abort()}>
            <Stop aria-hidden /> Detener
          </Button>
        ) : (
          <Button type="submit" variant="primary" isDisabled={Boolean(blocked) || !question.trim()}>
            Preguntar <ArrowRight aria-hidden />
          </Button>
        )}
      </form>
      {turns.length > 0 && !busy && (
        <button type="button" className="self-start text-xs text-primary hover:underline" onClick={() => setTurns([])}>
          Nueva conversación
        </button>
      )}
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return <p className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">{text}</p>;
}

function Answer({ turn, live }: { turn: Turn; live: boolean }) {
  const html = useMemo(() => toHtml(turn.content), [turn.content]);
  return (
    <div className="flex flex-col gap-2">
      {(turn.steps?.length ?? 0) > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Datos consultados">
          {turn.steps!.map((s, i) => (
            <li key={i} className="rounded-md bg-default px-2 py-0.5 font-mono text-[11px] text-muted">
              {s}
            </li>
          ))}
        </ul>
      )}
      {turn.content ? (
        <Card className="p-4">
          <div className="vault-prose text-sm" dangerouslySetInnerHTML={{ __html: html }} />
        </Card>
      ) : live ? (
        <p className="text-sm italic text-muted">{turn.steps?.length ? "Revisando los datos…" : "Pensando…"}</p>
      ) : null}
      {(turn.note || turn.cached) && (
        <p className={`text-xs ${turn.error ? "text-red" : "text-muted"}`}>{turn.note ?? "Respuesta reciente reutilizada (no gastó consumo)."}</p>
      )}
    </div>
  );
}
