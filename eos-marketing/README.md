# EOS · Nivel 10 — Marketing

App en línea para llevar Traction/EOS: **V/TO**, **Organigrama de Responsabilidad**,
**Rocks**, **Scorecard**, **Issues (IDS)**, **To-Dos** y la **Reunión Level 10**
con agenda, timer y calificación final.

> Copia local del sistema EOS L10, **sin datos**, base para rediseñarlo para
> un equipo de marketing. El sistema original sigue intacto en la raíz del repo.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router, Server Actions) + TypeScript + Tailwind CSS v4
- [PGlite](https://pglite.dev) — Postgres embebido en Node, guardado en disco (`.data/pglite`). No requiere servidor de base de datos ni cuenta en la nube.
- En Netlify: Netlify Database (Postgres) y Netlify Blobs para imágenes (ver "Publicar en Netlify").
- Autenticación propia con cookies firmadas (JWT vía `jose`) + `bcryptjs`

## Uso local

```bash
cd eos-marketing
npm install
npm run dev        # http://localhost:3000
```

La primera vez la base se crea vacía y se aplican las migraciones de
`db/migrations`. Abre la app y verás `/setup` para crear el equipo y la cuenta
de administrador. Al terminar el setup se cargan automáticamente:

- Las personas del equipo (Kevin, Lucero, Luis, Andrea, Patty, Miguel). Si tu
  nombre coincide con uno de ellos, tu cuenta ocupa ese lugar. Los demás quedan
  con un correo provisional `nombre@marketing.local` y sin acceso: asígnales
  correo y contraseña desde **Equipo → Editar acceso**.
- Las 117 carreras con su programa, nivel y responsable (`src/lib/domain/careers-catalog.ts`),
  sin metas (se cargan en **Metas de carrera**).
- El Rock de Kevin "Dashboard de Active" (Q4 2026) con sus hitos y fechas.

**Volver a cero:** detén la app y borra la carpeta `.data/`.

**Actualizar:** reemplaza los archivos (conserva `.data/`) y corre `npm install`. Las
actualizaciones de la base (`db/migrations`) se aplican solas, incluso si `npm run dev`
estaba corriendo.

## Publicar en Netlify

Sitio: **eos-nivel-10** (https://eos-nivel-10.netlify.app). `netlify.toml` está en esta carpeta.

- **Base de datos:** si existe Netlify Database (`NETLIFY_DB_URL`), `src/lib/db.ts` la usa en
  lugar de PGlite. Todas las tablas viven en el esquema **`eos_marketing`**, así no se
  mezclan con tablas anteriores de esa base. Las migraciones de `db/migrations` se
  empaquetan al compilar (`scripts/gen-migrations.mjs`, en `prebuild`) y se aplican solas
  al arrancar, con candado para no aplicarse doble.
- **Imágenes de anuncios:** Netlify Blobs (store `eos-marketing-uploads`) en vez de `.data/uploads`.
- **Variables:** `AUTH_SECRET` (secreto, configurado en el sitio) y `EOS_TIMEZONE`
  (`America/Guatemala`; las semanas se calculan en esa zona).
- **Volver a publicar:** desde esta carpeta, con el comando de despliegue de Netlify
  (`netlify deploy --build --prod` con la CLI enlazada al sitio).

La primera vez, abre el sitio y verás `/setup` para crear el equipo y el administrador.

## Variables de entorno (opcionales)

| Variable       | Descripción                                                     |
| -------------- | ---------------------------------------------------------------- |
| `AUTH_SECRET`  | Secreto para firmar las cookies de sesión. Si falta, usa uno de desarrollo. |
| `EOS_DATA_DIR` | Carpeta de la base de datos local (por defecto `.data/pglite`). |
| `EOS_TIMEZONE` | Zona horaria para semanas y fechas (por defecto `America/Guatemala`). |
| `CLICKUP_API_TOKEN`, `CLICKUP_LIST_ID` | Para activar "Enviar a ClickUp" en To-Dos e Issues (preparado en `src/lib/integrations/clickup.ts`, falta implementarlo). |
| `ACTIVECAMPAIGN_API_URL`, `ACTIVECAMPAIGN_API_KEY` | Leads semanales desde ActiveCampaign (Ajustes › Leads desde ActiveCampaign). |
| `CRON_SECRET` | Protege `/api/cron/activecampaign`, que llama la función programada `netlify/functions/ac-weekly-sync.mts` (cada hora, minuto 7). |

## Leads desde ActiveCampaign

En **Ajustes › Leads desde ActiveCampaign** cada carrera se vincula al **embudo** del director/carrera y, si el
embudo tiene varias carreras, al valor del campo del trato **Nombre de la Carrera** (`%DEAL_NOMBRE_DE_LA_CARRERA%`;
se sugiere el que coincide con el nombre).

- **Lead calificado** = trato que **entra al embudo** (normalmente a "Interesado - Cola de Asesor"). La fecha de
  entrada sale del historial del trato (`deals/{id}/dealActivities`, cambios `d_stageid`): si nació en una etapa
  del embudo, su fecha de creación; si no, el primer cambio desde una etapa de otro embudo. Cada trato cuenta una
  sola vez, en la semana (lunes a domingo, hora de Guatemala) en que entró, aunque después se mueva o se cierre.
- Las fechas se guardan en `ac_deal_entries`; `ac_pipeline_scans` recuerda hasta dónde se revisó cada embudo. Solo
  se vuelve a leer el historial de un trato si cambió. La primera revisión cubre los tratos modificados en las
  últimas 27 semanas y puede tardar varios minutos (≈5 consultas por segundo a ActiveCampaign).
- **Automático**: cada hora la función programada revisa lo nuevo y escribe la **semana en curso**; los lunes
  también cierra la semana anterior. **Manual**: "Sincronizar ahora" en Ajustes o el botón de Indicadores (visible
  en la semana en curso), con barra de avance.
- **Semanas anteriores (solo administradores)**: se elige una semana cerrada (últimas 26) y "Ver comparativa"
  muestra, por carrera, el dato guardado (manual o AC), el dato real del historial y la diferencia. Se marcan las
  carreras y se confirma; avisa que sobrescribe.
- **Ajustes › Diagnóstico › Historial de tratos** prueba (solo lectura) que la API entregue el historial.
- El usuario de la API necesita permiso a todos los embudos (Settings › Users › Groups › Deals).

## Correos (Resend)

La app envía correos con [Resend](https://resend.com) por su API HTTP (sin dependencias extra):

- **¿Olvidaste tu contraseña?** en el login: enlace de un solo uso, vence en 1 hora (`/recuperar` → `/restablecer`).
- **Acceso por correo**: al agregar a alguien (Ajustes › Equipo) o con el botón "Enviar acceso", la persona
  recibe un enlace (7 días) para crear su contraseña.
- **Resumen de la Reunión L10** con el PDF adjunto, a quienes asistieron y a otros correos opcionales.
- **Planificación semanal** del Calendario editorial con el PDF adjunto; recuerda los destinatarios del equipo.
- **Correo de prueba** en Ajustes › Diagnóstico.

Variables (en Netlify): `RESEND_API_KEY` (secreta), `RESEND_FROM` (p. ej. `Nombre <remitente@tudominio.com>`;
sin ella se usa `onboarding@resend.dev`, que solo entrega al dueño de la cuenta de Resend) y `APP_URL`
(dirección pública para los enlaces, p. ej. `https://eos.amscreativeint.com`). Los enlaces se guardan solo como
hash (tabla `password_tokens`, fuera de los respaldos).

## Interfaz (HeroUI v3)

- **Íconos**: toda la interfaz usa `@gravity-ui/icons` (los mismos del menú), que toman el color del tema; no se usan
  emojis. `StatusIcon` (`src/components/status-icon.tsx`) muestra correcto/error/aviso junto a un texto. Las
  herramientas de la caja guardan el nombre del ícono elegido (catálogo `TOOL_ICONS` en `tools-shared.ts`).

Toda la interfaz usa [HeroUI v3](https://heroui.com) (`@heroui/react`, Tailwind 4 + React
Aria): botones, campos, selects, casillas, chips, tarjetas, pestañas, ventanas (Modal/Drawer),
tooltips y barras de progreso. Íconos: `@gravity-ui/icons`. Los estilos de HeroUI se cargan en
`src/app/globals.css` después de Tailwind, con el tema mapeado a los colores de la app.

- `src/components/ui/select.tsx` (`AppSelect`) y `checkbox.tsx` (`AppCheckbox`): Select y
  Checkbox de HeroUI con la misma forma de uso que los elementos nativos (`<option>` como hijos,
  `name` para formularios, `onChange={(e) => e.target.value}`).
- `src/components/ui/segmented.tsx`: control segmentado (ToggleButtonGroup).

**Modo claro / oscuro:** cada persona elige Claro, Oscuro o Sistema (botón ☀/☾ de la barra
superior o Ajustes › Apariencia). Se guarda en la cookie `eos-theme`; un script en el `<head>`
lo aplica antes de pintar. Los colores oscuros están en `globals.css` (`.dark`).

**Color del template:** Ajustes › Apariencia (solo administradores) guarda `teams.theme_color`
(migración `008`). El layout lo inyecta como `--brand`; para el modo oscuro se calcula una
versión más clara y el color de texto con mejor contraste (`src/lib/theme.ts`).

**Moneda:** todos los montos se muestran en dólares (US$), p. ej. `$1,234.56`.

Para el agente de IA: el skill `heroui-react` está en `.claude/skills/` y el servidor MCP
`heroui-react` en `.mcp.json` (raíz del repo); Claude Code pide aprobarlo la primera vez.

## Estructura

- `src/lib/db.ts` — conexión a PGlite y ejecución de migraciones.
- `src/lib/domain/*` — acceso a datos (SQL), sin lógica de UI.
- `src/lib/auth/*` — sesiones, contraseñas y acciones de login/registro.
- `src/app/(app)/*` — módulos protegidos de la aplicación (un folder por módulo).
- `db/migrations/*` — esquema SQL, se aplica automáticamente al arrancar.

## Módulos

- **Caja de herramientas**: en Ajustes › Caja de herramientas (solo administradores) se crean accesos directos
  (enlace a otro sitio, abre pestaña nueva) o mini módulos con el sitio insertado (iframe, solo https; YouTube y
  Google Docs/Sheets/Slides/Drive se convierten a su versión para insertar). Cada una es para todo el equipo o solo
  para roles/personas elegidas (los administradores ven todas); se pueden ordenar y ocultar. Se ven en **Otras
  herramientas** (`/herramientas`), módulo que también se controla desde Roles y accesos. Tablas `tools`,
  `tool_roles`, `tool_users`.
- **Calendario editorial › Importar desde Google Sheets**: se pega el enlace del Plan de contenido publicado en la
  Web, se elige una sección "SEMANA …" y se ven los cambios antes de guardar (piezas nuevas, actualizadas por mismo
  tema, sin cambios y las que solo están en la app, que se pueden quitar). Lo vacío en la hoja no borra lo capturado
  en la app. Lee la pestaña con la columna "Pieza / Tema"; las filas después de "[+] … BUFFER" son de buffer.
- **Eventos para la L10** (`/meeting`): antes de la reunión cada equipo agrega sus eventos (título, fecha
  opcional y detalle). Se leen en el segmento de Noticias de la L10 y, al finalizarla, quedan ligados a esa
  reunión (salen en el resumen PDF). "Enviar a otro equipo" copia el evento a la próxima L10 de los equipos
  elegidos (aparece como "De: equipo"); el original muestra a quién se envió y si ya se leyó. Tabla `l10_events`.
- **V/TO** (`/vto`): Vision/Traction Organizer editable por secciones.
- **Organigrama** (`/accountability`): árbol de puestos con roles/responsabilidades. Cada
  puesto tiene "Reporta a": cambiarlo solo mueve ese puesto (y a quienes dependen de él).
  Al eliminar un puesto, sus dependientes no se borran: pasan a reportar al nivel de arriba.
- **Rocks** (`/rocks`): prioridades trimestrales de la empresa y de cada persona, con hitos y fecha por hito.
- **Metas de carrera** (`/metas`): meta mensual de leads y de presupuesto por carrera,
  en una tabla editable con los 12 meses del año más enero y febrero del siguiente, con filtros y opción de copiar un mes a otro.
- **Control de carrera** (`/control`): visualización de los 12 hitos del lanzamiento de cada
  carrera (Definición, Producción, Activación, Mejora continua) y tablero Kanban: las
  tarjetas se arrastran entre hitos, llevan etiquetas, responsable y estado on/off track.
  Ruta crítica (CPM) con duraciones y dependencias por hito: fechas planeadas, holgura,
  hitos atrasados y fecha de lanzamiento prevista.
- **Calendario editorial** (`/calendario`): plan de contenido por mes y semana (cada semana
  pertenece al mes de su lunes). Cada pieza tiene fecha, tema, pilar, capa (Hero/Hub/Hygiene),
  asignación, frente, audiencia, facultad/carrera, CTA, estado y nota; el estado se cambia en la
  misma fila. Resumen del mes: publicadas vs. total y por persona, mezcla por capa contra el
  objetivo (Hero 10 %, Hub 50 %, Hygiene 35 %, piso SEO de Hygiene ≥ 25 %) y mezcla por pilar.
  Por semana: piezas planificadas, buffer esporádico/reactivo (3 slots) y fechas clave (días
  internacionales). Incluye banco de ideas (Banco Hygiene, piezas sin semana), filtros por persona,
  estado, capa, facultad y texto. Cada pieza puede llevar el link de la publicación. Cada semana tiene
  **Enviar planificación (PDF)**: resumen de la semana por persona, buffer, fechas clave y coberturas,
  listo para mandar a jefatura.
- **Control de coberturas** (`/coberturas`): registro de coberturas por fecha con facultad,
  horario, asignación, tipo, estado, paquete (Express ≈2-3 h, Estándar ≈4-5 h, Ampliada ≈6-8 h,
  Especial/Hero 2+ días), tiempo estimado y real, horas fuera de horario y horas repuestas. Muestra
  por persona realizadas, agendadas y saldo de horas por reponer, más las coberturas realizadas
  por semana. Navega por mes o ve todo el registro.
- **Análisis de contenido** (`/analisis-contenido`): métricas del calendario y de las coberturas por
  semana, mes, trimestre, año o rango de fechas, comparadas con el periodo anterior: publicadas,
  cumplimiento, % Hygiene, Hero, buffer usado, reprogramadas/canceladas, coberturas y horas fuera de
  horario; tendencia de publicadas por semana (o por mes en periodos largos) por capa, mezcla por capa
  contra el objetivo, tabla por persona y desgloses por pilar, facultad, frente y estado.
- **Listas de contenido** (Ajustes › Listas de contenido): facultades e institutos, pilares, estados,
  frentes, tipos, estados y paquetes de cobertura (desplegables del calendario y de coberturas).
- **Logo de la organización** (Ajustes › Apariencia): imagen que aparece arriba a la izquierda, por equipo.
- **Plantilla Comunicación GES** (Ajustes › Equipos): crea el equipo "Comunicación GES" con quien
  la usa como Administrador, más Cesar y David (correo provisional `@comunicacion-ges.local`: define
  su acceso real en Ajustes › Equipo), e importa el plan de contenido (calendario Ago–Oct, banco
  Hygiene, días internacionales, coberturas) y el Scorecard (16 indicadores, metas de Cesar, David
  y General, y sus valores semanales). Los datos vienen de `src/lib/domain/ges-seed.json`.
- **Análisis** (`/analisis`): gráficas de leads contra meta, consumo contra presupuesto y
  costo por lead por semana; leads por responsable y por programa; tendencia de un
  indicador del Scorecard contra su meta; y carreras más lejos de su meta. Filtros por
  rango de fechas, programa, responsable, nivel y carrera; cada gráfica tiene vista en tabla.
- **Mi perfil** (`/perfil`, desde el nombre en la barra superior): cada persona edita su
  nombre, pronombre (él, ella, elle), foto (recortada a 512 px; en Netlify Blobs o
  `.data/uploads`), color personal (en su avatar y, si quiere, como color de la plataforma
  solo para ella) y contraseña.
- **Ajustes** (`/ajustes`): índice de configuraciones (Equipo, Roles y accesos, Equipos, Apariencia, Hitos, Anuncios, Demo, Diagnóstico, Exportar).
  - **Equipo** (`/ajustes/equipo`): personas, accesos, rol de cada persona y nombre del
    equipo. Se puede agregar a alguien que ya tiene cuenta solo con su correo.
  - **Roles y accesos** (`/ajustes/roles`): roles **Administrador** (todo, y es el único
    que administra equipo, roles y equipos) y **Usuario** (todo editable menos Ajustes),
    más roles propios. Por cada módulo: *Sin acceso*, *Solo ver* o *Ver y editar*. El menú
    oculta lo que no tiene acceso; en *Solo ver* la página muestra un aviso y los controles
    quedan deshabilitados; las acciones del servidor también lo validan.
  - **Equipos** (`/ajustes/equipos`): crear equipos (cada uno con sus propios datos),
    cambiar entre ellos. Los indicadores del Scorecard se pueden hacer **visibles para otros
    equipos** (todos o elegidos) desde "Gestionar indicadores"; esos equipos los ven en
    su Scorecard, sección "De otros equipos", en solo lectura.
  - **Hitos de Control de carrera** (`/ajustes/hitos`, administradores): editar, renombrar,
    eliminar, agregar y reordenar hitos; etapa, duración, dependencias y lanzamiento.
  - **Anuncios** (`/ajustes/anuncios`, administradores): hasta 5 imágenes (PNG, JPG, WEBP o
    GIF; las fotos grandes se reducen a 1920 px al subirlas) guardadas en `.data/uploads`, que aparecen como popup a todo el equipo cada N minutos (5 por
    defecto), en rotación; se pueden activar/desactivar en general o por imagen.
  - **Información demo** (`/ajustes/demo`, administradores): crea un equipo aparte
    "… · DEMO" con datos de ejemplo en todos los módulos y cambia tu vista a él; tu
    información real no se toca y el resto del equipo no la ve. "Desactivar" borra la
    demo completa y regresa al equipo real.
  - **Frases motivacionales** (`/ajustes/frases`): banco inicial de 155 frases
    (`src/lib/domain/quotes-catalog.ts`, copiado a cada equipo la primera vez); agregar,
    activar/desactivar, eliminar, filtrar y "Restaurar banco inicial".
  - **Log** (`/ajustes/log`, administradores): bitácora de acciones importantes (metas,
    valores y metas del Scorecard, hitos, Rocks, To-Dos, Issues, indicadores, Control de
    carrera, V/TO, organigrama, reuniones, personas, roles, anuncios, color y respaldos),
    con filtros por módulo y persona.
  - **Diagnóstico** (`/ajustes/diagnostico`): prueba lectura y escritura de la base,
    migraciones aplicadas, el almacenamiento de imágenes y cada anuncio guardado, y muestra el
    error exacto si algo falla. **Respaldos** (administradores): alerta si no hay respaldo o
    tiene 7 días o más; "Descargar respaldo" genera un `.json.gz` con toda la base (todos los
    equipos; sin imágenes de anuncios); "Restaurar" reemplaza toda la información por la de
    un respaldo (escribiendo RESTAURAR), en una sola transacción. Historial de respaldos.
  - **Exportar datos** (`/ajustes/exportar`): Scorecard e Indicadores de carrera en Excel
    `.xlsm` (libro habilitado para macros, sin macros incluidas) o `.xlsx`, por rango de
    semanas. También desde los botones "Exportar Excel" de Scorecard e Indicadores.
- **Indicadores de carrera** (`/indicadores`): leads y consumo de presupuesto de la
  semana contra la meta (prorrateada desde la meta mensual según los días de la semana
  en cada mes), con semáforo, costo por lead y totales. Filtros por
  programa, carrera, nivel y responsable; vistas por responsable y por programa.
  Los números se editan a mano en la tabla; el consumo se importa desde el CSV del
  reporte de Meta (la carrera se reconoce por su código en el nombre de la campaña y
  las asignaciones manuales se recuerdan); el botón de ActiveCampaign está listo para
  conectarse. En la reunión L10 se muestran en modo resumen dentro del Scorecard
  (última semana cerrada).
- **Scorecard** (`/scorecard`): indicadores semanales por dueño, con meta, semáforo (verde en meta, rojo
  por debajo, también en el promedio) y un dueño "rollup" calculado automáticamente (suma o promedio de los
  demás). Muestra 13 semanas en orden cronológico (de la más antigua a la más nueva) con la semana en
  curso resaltada y 3 semanas por delante; un slider permite ver semanas anteriores. Solo un
  administrador cambia las metas. Hay indicadores **calculados** (numerador ÷ denominador, × 100 si es %),
  p. ej. % Hygiene = Hygiene producidas ÷ Cadencia; en el rollup se calculan con los totales.
- **Issues** (`/issues`): lista IDS priorizable, con fecha específica, conversión a To-Do
  al resolver y botón "Enviar a ClickUp". Cada persona ve primero los suyos; filtros
  "Solo míos", "Todos" (para reordenar prioridades) o los de una persona.
- **To-Dos** (`/todos`): pendientes semanales con descripción, dueño, fecha límite y botón
  "Enviar a ClickUp". Mismos filtros por persona que Issues.
- **Dashboard** (`/`): saludo que cambia según la hora (y rota entre varias frases), las
  Noticias compartidas en la reunión, indicadores rápidos y la **frase del día**: una frase
  motivacional distinta cada día, sin repetir hasta recorrer todas las activas.
- **V/TO** (`/vto`): ya no incluye la tarjeta de Issues (viven en su propio módulo).
- **Reunión Level 10** (`/meeting`): agenda de 90 minutos (Buenas noticias, Scorecard, Rocks,
  Noticias, To-Dos, IDS, Conclusión). Botones "+ To-Do" y "+ Issue" disponibles en
  todos los pasos, y atajos por paso: "→ Issue" desde Scorecard, carreras a revisar,
  Rocks, Noticias y To-Dos; "+ To-Do" desde cada Issue en IDS. Timer por segmento, conectada en vivo a Scorecard, Rocks, Issues y To-Dos, y calificación final 1–10.
  Al iniciar, **lista de asistencia** (quien inicia queda presente y dirige; se puede cambiar
  quién dirige). En **Conclusión**, quien dirige (o un administrador) captura la calificación
  1–10 de cada asistente; los demás califican solo la suya.
  En **Conclusión** se listan los To-Dos que estaban pendientes y los nuevos de la reunión,
  y se registran los mensajes a cascadear. Al finalizar, **Generar resumen (PDF)** descarga
  lo registrado (asistencia, quién dirigió, calificaciones, Scorecard fuera de meta, indicadores de carrera, Rocks,
  noticias, To-Dos, IDS y mensajes); también desde el historial de reuniones.
