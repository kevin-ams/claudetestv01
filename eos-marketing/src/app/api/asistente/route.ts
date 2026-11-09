import { getAccess } from "@/lib/auth/access";
import { ask, askInput, type AskEvent } from "@/lib/ai/ask";

// Las funciones de Netlify permiten 60 s; el asistente pide su respuesta final antes de ese límite.
export const maxDuration = 60;

/** Asistente IA (premium): responde en streaming, una línea JSON por evento (pasos, texto, fin o error). */
export async function POST(req: Request) {
  const access = await getAccess();
  if (!access) return Response.json({ error: "Inicia sesión." }, { status: 401 });
  if (access.level("asistente") === "none") return Response.json({ error: "El asistente IA es parte del plan Premium." }, { status: 403 });

  const parsed = askInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Pregunta inválida." }, { status: 400 });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: AskEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          // La persona cerró la página: se deja de enviar.
        }
      };
      await ask({ access, history: parsed.data.messages, emit, signal: req.signal });
      try {
        controller.close();
      } catch {}
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
