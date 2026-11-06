# Revisión de arquitectura — EOS Nivel 10 (noviembre 2026)

Estado actual: ~41 000 líneas de TypeScript en 303 archivos, 41 migraciones, Next.js 16 (App Router + server actions),
HeroUI, Postgres (Neon/Netlify Database en producción, PGlite en local). La app creció por módulos (L10, Scorecard,
carreras, contenido, reportes, Dashboard AC, Conocimiento, MCP) y ya tiene una funcionalidad clara. Esta revisión
propone cómo ordenarla para que siga siendo segura, mantenible y escalable.

Las propuestas van por prioridad: **P0** (riesgo real hoy), **P1** (datos y escalabilidad), **P2** (estructura del
código), **P3** (calidad y operación).

---

## Lo que ya está bien

- **Capa de dominio separada** (`src/lib/domain/*`): las páginas y acciones casi no escriben SQL (solo 6 consultas
  fuera de `domain`).
- **SQL parametrizado** con plantillas `sql\`…\`` (sin concatenar texto): no hay inyección SQL.
- **Permisos por módulo y rol** centralizados (`lib/auth/modules.ts`, `access.ts`) y aplicados en cada acción.
- **Migraciones versionadas** e idempotentes, el mismo esquema en local y en la nube.
- **Integraciones aisladas** (`lib/integrations/*`) y tareas pesadas en funciones en segundo plano.
- **Pruebas** desde la Etapa 7 (Vitest con PGlite temporal) para el vault y el servidor MCP.

---

## P0 — Aislamiento entre equipos en las acciones (seguridad)

**Problema.** Muchas server actions reciben el `id` de un registro y lo modifican sin comprobar que pertenezca al
equipo de quien llama. Ejemplos confirmados:

| Acción | Qué hace sin revisar el equipo |
|---|---|
| `deleteIssueAction`, `solveIssueAction`, `reopenIssueAction`, `updateIssueAction`, `toggleIssueTopAction` | Borrar/resolver/editar un Issue |
| `updateRockStatusAction`, `updateRockAction`, `deleteRockAction`, acciones de hitos | Cambiar o borrar Rocks e hitos |
| `completeTodoAction`, `deleteTodoAction` | Completar o borrar To-Dos |
| `upsertEntryAction`, `setTargetAction`, `archiveMetricAction`… | Escribir en el Scorecard |
| `setLeadsAction`, `setBudgetAction`, `updateCareerAction`… | Editar indicadores de carrera |
| `addHeadlineAction`, `rateMeetingAction`, `saveCascadeNotesAction`… | Escribir en una L10 |

Las server actions son endpoints públicos (cualquiera con sesión puede invocarlas con otro `id`). Hoy una persona de
un equipo —o una cuenta de demo— podría modificar datos de otro equipo adivinando números. Las **páginas** sí revisan
el equipo (p. ej. `/meeting/[id]`); el hueco está en las **acciones**. Un análisis automático marca ~48 acciones a
revisar (algunas son falsos positivos).

**Propuesta.**
1. Que **toda función de dominio que lee o escribe por id reciba también `teamId`** y lo use en el `WHERE`
   (`WHERE id = $1 AND team_id = $2`). Así el aislamiento no depende de que cada acción se acuerde de revisarlo.
   El vault ya funciona así (`vaultId` en cada consulta) y por eso pasó las pruebas de aislamiento.
2. Un helper único para acciones, p. ej. `withTeam("issues", "edit", async (ctx) => …)`, que resuelva sesión,
   permiso y equipo, y devuelva errores con el mismo formato.
3. Una prueba de aislamiento por módulo (como `tests/vault-isolation.test.ts`): crear datos en el equipo A e intentar
   leerlos/modificarlos desde el equipo B.

**Esfuerzo:** medio (mecánico, módulo por módulo). **Recomendación: hacerlo antes que cualquier otra cosa.**

---

## P1 — Datos y escalabilidad

### 1. Modelar la organización de forma explícita
Hoy "organización" es implícito: *todos los equipos que no son demo forman una sola organización*
(`orgTeamIds`), y el V/TO, el organigrama y el vault viven en el "equipo ancla" (el primero creado). Funciona para un
solo cliente, pero no escala a vender el plan Premium a otras instituciones.

**Propuesta:** tabla `organizations` (+ `teams.organization_id`), y que V/TO, organigrama, vault, tokens y plan
(`base`/`premium`) cuelguen de la organización. El "dueño de la plataforma" pasa a ser un rol global y los
administradores lo son de su organización. Es la base para facturación y para multi-cliente.

### 2. Migraciones fuera del arranque
En producción las migraciones se aplican en la **primera consulta** después de un deploy (con un candado). Si una
falla, la app entera falla en ese momento, y una migración lenta retrasa a la primera persona.

**Propuesta:** correrlas como paso del build/deploy (`npm run migrate` antes de publicar), con registro de duración, y
dejar en tiempo de ejecución solo una verificación ("la base está en la versión N").

### 3. Consultas en bucle (N+1) y trabajo repetido
Hay ~22 bucles con `await` de una consulta por elemento (p. ej. guardar enlaces de una nota, fragmentos del vault,
importaciones). Además, al guardar una nota se cargan **todas** las entidades EOS de la organización solo para resolver
los `[[rock:…]]`.

**Propuesta:** inserciones por lote (`INSERT … SELECT * FROM unnest($1::int[], $2::text[])`) o `db().batch()` en
transacción; resolver entidades solo si la nota tiene enlaces EOS.

### 4. Transacciones donde hay varios pasos
Operaciones como "guardar nota + enlaces + historial + renombrar en otras notas", "enviar To-Do/Issue a otro equipo y
moverlo" o "importar presupuesto" son varias escrituras independientes: si una falla a la mitad, quedan datos a medias.

**Propuesta:** exponer `db().transaction(async (tx) => …)` en ambos backends (PGlite ya lo tiene; en Neon con `Pool`) y
usarlo en esas operaciones.

### 5. Paginación y límites
Varias listas cargan todo (notas del vault, To-Dos, actividad, carreras). Con 2 000 notas el vault aún responde bien,
pero no hay techo.

**Propuesta:** paginar (cursor por `id`/fecha) las listas que crecen sin límite y devolver al navegador solo los campos
que la pantalla usa.

### 6. Tipos de las columnas
Hay conversiones repetidas para arreglos y JSON que llegan distinto según el driver (`typeof x === "string" ?
JSON.parse(x) : x`, helpers `arr()`), y fechas como texto.

**Propuesta:** un mapeo único en `db.ts` (parsers de `json/jsonb`, `text[]`, `int[]`, `real[]` iguales en PGlite y
Neon) y funciones `fromRow` tipadas por entidad.

---

## P2 — Estructura del código

### 1. Validación de entradas con un esquema
Las acciones validan a mano (`Number(x)`, `String(x).trim().slice(0, 160)`, regex de fechas) y cada una distinto. `zod`
ya está instalado pero se usa en 2 archivos.

**Propuesta:** un esquema `zod` por acción (`z.object({ title: z.string().trim().min(1).max(160), … })`), compartido
con el formulario cuando aplique. Menos código y errores uniformes.

### 2. Un formato de resultado y de errores
Conviven tres estilos: acciones que lanzan `Error`, que devuelven `{ ok, message }`, y que no devuelven nada. Hay 14
`catch {}` silenciosos y el mensaje "Si se publicó una versión nueva, recarga" repetido en muchos componentes.

**Propuesta:** `ActionResult<T> = { ok: true; data: T } | { ok: false; error: { code; message } }`, un `safeAction()`
que envuelva permisos + validación + registro de errores, y un hook de cliente `useAction()` que muestre el error
estándar.

### 3. Dividir `types.ts` y los componentes gigantes
- `lib/domain/types.ts` concentra los tipos de todos los módulos.
- Hay componentes de cliente de 500–800 líneas (`meeting-runner`, `vault-app`, `calendar-board`, `team-agenda`,
  `analysis-board`) que mezclan datos, estado y vista.

**Propuesta:** organizar por **módulo** ("feature folders"): `src/modules/<módulo>/{domain.ts, types.ts, actions.ts,
components/, tests/}`, con `app/` solo para rutas. Partir los componentes grandes en secciones y hooks
(`useAutosave`, `useMeetingSync`, etc.).

### 4. Lógica de negocio fuera de las acciones
Algunas acciones arman correos HTML, deciden reglas o encadenan varias operaciones (p. ej. enviar To-Do/Issue a otro
equipo, que además está duplicado entre ambos módulos).

**Propuesta:** las acciones solo hacen "permiso → validar → llamar al dominio → revalidar". La lógica (y las plantillas
de correo) va al dominio o a `lib/email/templates`, y lo compartido se unifica (un solo "enviar a otro equipo" genérico).

### 5. Revalidación más fina
Hay 151 llamadas a `revalidatePath`, varias con `"layout"`, que invalidan más de lo necesario y obligan a recalcular el
layout (con sus ~8 consultas).

**Propuesta:** etiquetas de caché (`revalidateTag("issues:" + teamId)`) y cachear lecturas estables (catálogo de
frases, carreras, roles, equipos del usuario) por equipo.

---

## P3 — Calidad y operación

1. **Pruebas:** extender Vitest a los cálculos críticos (Scorecard y fórmulas, prorrateo de metas, sincronización de
   ActiveCampaign con respuestas simuladas, permisos/roles) y una prueba de aislamiento por módulo (ver P0). Correr
   `npm test` + `tsc` + `eslint` en cada push (GitHub Actions) antes de publicar.
2. **Registro y alertas:** reemplazar `console.error` sueltos por un logger con contexto (equipo, acción, duración) y
   alertas para fallas de funciones programadas (la sincronización de AC falló en silencio durante semanas).
3. **Una sola rama de producción:** publicar siempre desde `main` (con PR), para que no vuelva a perderse trabajo de
   otra sesión como pasó con el Dashboard AC.
4. **Secretos y configuración:** documentar en un solo lugar (`.env.example`) las variables (`CRON_SECRET`,
   `PLATFORM_OWNER_EMAILS`, ActiveCampaign, Resend, ClickUp) y validarlas al arrancar con un esquema.
5. **Rendimiento:** medir el tiempo de las páginas más usadas (p50 ~45 ms hoy, pero p99 de 3–5 s en la primera visita
   tras el reposo de la base) y considerar mantener caliente la base solo en horario laboral si el arranque en frío
   molesta.
6. **Accesibilidad e i18n:** los textos están en el código; si se venderá a otros países, extraerlos a archivos de
   mensajes.

---

## Plan sugerido

| Orden | Trabajo | Por qué primero |
|---|---|---|
| 1 | **P0**: `teamId` obligatorio en el dominio + helper de acciones + pruebas de aislamiento por módulo | Riesgo de seguridad hoy |
| 2 | P2.1–P2.2: validación con zod y formato único de resultados (aprovechando que se tocan las acciones en P0) | Se hace junto con P0 casi sin costo extra |
| 3 | P3.1–P3.3: CI con pruebas + publicar desde `main` | Evita regresiones y pérdidas de código |
| 4 | P1.1: tabla `organizations` y plan por organización | Requisito para vender Premium / Etapa 8 |
| 5 | P1.2–P1.4: migraciones en el deploy, lotes y transacciones | Robustez de datos |
| 6 | P2.3–P2.5: carpetas por módulo, componentes más chicos, caché por etiquetas | Mantenibilidad (gradual, al tocar cada módulo) |
