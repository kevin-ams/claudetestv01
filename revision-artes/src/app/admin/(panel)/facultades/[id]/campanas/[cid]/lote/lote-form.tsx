"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Checkbox, Input, Label, TextArea, TextField } from "@heroui/react";
import { Xmark } from "@gravity-ui/icons";
import { driveThumbnailUrl, parseDriveUrl } from "@/lib/drive";
import { crearLoteAction, type FilaLote } from "../../../../../actions";

type Fila = FilaLote & { key: string };
type Carrera = { id: number; nombre: string };

const MAX = 50;
let contador = 0;
const nuevaKey = () => `f${++contador}`;

/** "Título | enlace" o solo el enlace, una línea por arte. */
function leerLineas(texto: string, desde: number): Fila[] {
  return texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((linea, i) => {
      const partes = linea.split("|").map((p) => p.trim());
      const url = partes.find((p) => /^https?:\/\//i.test(p)) ?? partes[partes.length - 1];
      const titulo = partes.length > 1 ? partes.filter((p) => p !== url).join(" ") : "";
      return {
        key: nuevaKey(),
        titulo: titulo || `Arte ${desde + i + 1}`,
        driveUrl: url,
        carreraId: "general",
        formato: "",
        fechaPublicacion: "",
        descripcion: "",
      };
    });
}

function problema(f: Fila, ids: Map<string, number>, existentes: Set<string>): string | null {
  const ref = parseDriveUrl(f.driveUrl);
  if (!ref) return "Enlace de Drive inválido";
  if ((ids.get(ref.id) ?? 0) > 1) return "Enlace repetido en el lote";
  if (existentes.has(ref.id)) return "Ya está en la campaña";
  if (f.titulo.trim().length < 2) return "Falta el título";
  return null;
}

export function LoteForm({
  facultadId,
  campanaId,
  campanaNombre,
  carreras,
  existentes,
  correosSugeridos,
  correoConfigurado,
}: {
  facultadId: number;
  campanaId: number;
  campanaNombre: string;
  carreras: Carrera[];
  existentes: string[];
  correosSugeridos: string[];
  correoConfigurado: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [filas, setFilas] = useState<Fila[]>([]);
  const [todos, setTodos] = useState({ carreraId: "", formato: "", fechaPublicacion: "" });
  const [avisar, setAvisar] = useState(false);
  const [correos, setCorreos] = useState(correosSugeridos.join(", "));
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [erroresFila, setErroresFila] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const setExistentes = useMemo(() => new Set(existentes), [existentes]);
  const conteo = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of filas) {
      const id = parseDriveUrl(f.driveUrl)?.id;
      if (id) m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  }, [filas]);
  const problemas = filas.map((f) => erroresFila[f.key] ?? problema(f, conteo, setExistentes));
  const validas = problemas.filter((p) => !p).length;

  function agregar() {
    const nuevas = leerLineas(texto, filas.length);
    if (nuevas.length === 0) return;
    setFilas((fs) => [...fs, ...nuevas].slice(0, MAX));
    setTexto("");
    setErrorServidor(null);
  }

  function cambiar(key: string, campo: keyof FilaLote, valor: string) {
    setFilas((fs) => fs.map((f) => (f.key === key ? { ...f, [campo]: valor } : f)));
    setErroresFila((e) => {
      const { [key]: _quitado, ...resto } = e;
      void _quitado;
      return resto;
    });
  }

  function aplicarATodas() {
    setFilas((fs) =>
      fs.map((f) => ({
        ...f,
        ...(todos.carreraId ? { carreraId: todos.carreraId } : {}),
        ...(todos.formato ? { formato: todos.formato } : {}),
        ...(todos.fechaPublicacion ? { fechaPublicacion: todos.fechaPublicacion } : {}),
      }))
    );
  }

  function crear() {
    setErrorServidor(null);
    startTransition(async () => {
      const res = await crearLoteAction(facultadId, campanaId, {
        filas: filas.map(({ key: _k, ...f }) => {
          void _k;
          return f;
        }),
        avisar,
        correos,
      });
      if (res.ok) {
        router.push(`/admin/facultades/${facultadId}/campanas/${campanaId}?lote=${encodeURIComponent(res.mensaje ?? "")}`);
        return;
      }
      setErrorServidor(res.error ?? "No se pudo crear el lote");
      if (res.errores) {
        const porKey: Record<string, string> = {};
        for (const [i, msg] of Object.entries(res.errores)) {
          const f = filas[Number(i)];
          if (f) porKey[f.key] = msg;
        }
        setErroresFila(porKey);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-sm">
        <h2 className="font-semibold">1. Pega los enlaces de Drive</h2>
        <TextField aria-label="Enlaces de Drive, uno por línea">
          <TextArea
            rows={5}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={"Un arte por línea. Opcional: Título | enlace\nPost lanzamiento | https://drive.google.com/file/d/…/view\nhttps://drive.google.com/file/d/…/view"}
            className="font-mono text-xs"
          />
        </TextField>
        <div className="flex flex-wrap items-center gap-3">
          <Button onPress={agregar} isDisabled={!texto.trim() || filas.length >= MAX}>
            Agregar a la tabla
          </Button>
          <span className="text-xs text-muted">
            Máximo {MAX} por lote. Los archivos deben estar compartidos como “Cualquier persona con el enlace”.
          </span>
        </div>
      </section>

      {filas.length > 0 && (
        <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">2. Revisa y completa ({filas.length})</h2>
            <span className={`text-sm ${validas === filas.length ? "text-success" : "text-danger"}`}>
              {validas} de {filas.length} listos
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface-secondary p-3">
            <span className="w-full text-xs font-semibold uppercase tracking-wide text-muted">Aplicar a todas</span>
            <label className="flex flex-col gap-1 text-sm">
              <span>Carrera</span>
              <select
                value={todos.carreraId}
                onChange={(e) => setTodos((t) => ({ ...t, carreraId: e.target.value }))}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
              >
                <option value="">— Sin cambio —</option>
                <option value="general">Toda la facultad</option>
                {carreras.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            <TextField className="w-48">
              <Label>Formato / canal</Label>
              <Input
                value={todos.formato}
                onChange={(e) => setTodos((t) => ({ ...t, formato: e.target.value }))}
                placeholder="Ej. Post Instagram"
              />
            </TextField>
            <TextField className="w-44">
              <Label>Fecha de publicación</Label>
              <Input
                type="date"
                value={todos.fechaPublicacion}
                onChange={(e) => setTodos((t) => ({ ...t, fechaPublicacion: e.target.value }))}
              />
            </TextField>
            <Button variant="secondary" onPress={aplicarATodas}>
              Aplicar a todas
            </Button>
          </div>

          <ul className="flex flex-col gap-3">
            {filas.map((f, i) => {
              const ref = parseDriveUrl(f.driveUrl);
              const thumb = ref ? driveThumbnailUrl(ref) : null;
              const error = problemas[i];
              return (
                <li
                  key={f.key}
                  data-testid="fila-lote"
                  className={`grid gap-3 rounded-2xl border p-3 sm:grid-cols-[96px_1fr_auto] ${error ? "border-danger bg-danger-soft" : "border-border"}`}
                >
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl bg-surface-secondary text-[10px] text-muted">
                    {thumb ? (
                      // Miniatura servida por Google Drive.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      "Sin vista previa"
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <TextField aria-label={`Título del arte ${i + 1}`} className="sm:col-span-2">
                      <Input value={f.titulo} onChange={(e) => cambiar(f.key, "titulo", e.target.value)} placeholder="Título" />
                    </TextField>
                    <TextField aria-label={`Enlace del arte ${i + 1}`} className="sm:col-span-2">
                      <Input
                        value={f.driveUrl}
                        onChange={(e) => cambiar(f.key, "driveUrl", e.target.value)}
                        className="font-mono text-xs"
                      />
                    </TextField>
                    <select
                      aria-label={`Carrera del arte ${i + 1}`}
                      value={f.carreraId}
                      onChange={(e) => cambiar(f.key, "carreraId", e.target.value)}
                      className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                    >
                      <option value="general">Toda la facultad</option>
                      {carreras.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <TextField aria-label={`Formato del arte ${i + 1}`}>
                        <Input value={f.formato} onChange={(e) => cambiar(f.key, "formato", e.target.value)} placeholder="Formato" />
                      </TextField>
                      <TextField aria-label={`Fecha del arte ${i + 1}`}>
                        <Input
                          type="date"
                          value={f.fechaPublicacion}
                          onChange={(e) => cambiar(f.key, "fechaPublicacion", e.target.value)}
                        />
                      </TextField>
                    </div>
                    <TextField aria-label={`Copy del arte ${i + 1}`} className="sm:col-span-2">
                      <TextArea
                        rows={2}
                        value={f.descripcion}
                        onChange={(e) => cambiar(f.key, "descripcion", e.target.value)}
                        placeholder="Copy / indicaciones (opcional)"
                      />
                    </TextField>
                    {error && <p className="text-xs font-medium text-danger sm:col-span-2">{error}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    aria-label={`Quitar arte ${i + 1}`}
                    onPress={() => setFilas((fs) => fs.filter((x) => x.key !== f.key))}
                  >
                    <Xmark aria-hidden className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {filas.length > 0 && (
        <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-sm">
          <h2 className="font-semibold">3. Crear los artes</h2>
          <Checkbox isSelected={avisar} onChange={setAvisar} isDisabled={!correoConfigurado}>
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <span className="text-sm">Avisar a la facultad con un solo correo</span>
            </Checkbox.Content>
          </Checkbox>
          {!correoConfigurado && (
            <p className="text-xs text-muted">El envío de correos no está configurado (falta RESEND_API_KEY).</p>
          )}
          {avisar && (
            <TextField>
              <Label>Correos de la facultad</Label>
              <Input
                value={correos}
                onChange={(e) => setCorreos(e.target.value)}
                placeholder="decano@galileo.edu, coordinacion@galileo.edu"
              />
            </TextField>
          )}
          {errorServidor && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{errorServidor}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          <div>
            <Button onPress={crear} isPending={pending} isDisabled={validas !== filas.length || filas.length === 0}>
              Crear {filas.length} {filas.length === 1 ? "arte" : "artes"} en “{campanaNombre}”
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
