# EOS · Nivel 10 — Marketing

App en línea para llevar Traction/EOS: **V/TO**, **Organigrama de Responsabilidad**,
**Rocks**, **Scorecard**, **Issues (IDS)**, **To-Dos** y la **Reunión Level 10**
con agenda, timer y calificación final.

> Copia local del sistema EOS L10, **sin datos**, base para rediseñarlo para
> un equipo de marketing. El sistema original sigue intacto en la raíz del repo.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router, Server Actions) + TypeScript + Tailwind CSS v4
- [PGlite](https://pglite.dev) — Postgres embebido en Node, guardado en disco (`.data/pglite`). No requiere servidor de base de datos ni cuenta en la nube.
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

## Variables de entorno (opcionales)

| Variable       | Descripción                                                     |
| -------------- | ---------------------------------------------------------------- |
| `AUTH_SECRET`  | Secreto para firmar las cookies de sesión. Si falta, usa uno de desarrollo. |
| `EOS_DATA_DIR` | Carpeta de la base de datos local (por defecto `.data/pglite`). |
| `CLICKUP_API_TOKEN`, `CLICKUP_LIST_ID` | Para activar "Enviar a ClickUp" en To-Dos e Issues (preparado en `src/lib/integrations/clickup.ts`, falta implementarlo). |
| `ACTIVECAMPAIGN_API_URL`, `ACTIVECAMPAIGN_API_KEY` | Para activar la sincronización de leads (la consulta está preparada en `src/lib/integrations/activecampaign.ts`, falta implementarla). |

## Estructura

- `src/lib/db.ts` — conexión a PGlite y ejecución de migraciones.
- `src/lib/domain/*` — acceso a datos (SQL), sin lógica de UI.
- `src/lib/auth/*` — sesiones, contraseñas y acciones de login/registro.
- `src/app/(app)/*` — módulos protegidos de la aplicación (un folder por módulo).
- `db/migrations/*` — esquema SQL, se aplica automáticamente al arrancar.

## Módulos

- **V/TO** (`/vto`): Vision/Traction Organizer editable por secciones.
- **Organigrama** (`/accountability`): árbol de asientos con roles/responsabilidades.
- **Rocks** (`/rocks`): prioridades trimestrales de la empresa y de cada persona, con hitos y fecha por hito.
- **Metas de carrera** (`/metas`): meta mensual de leads y de presupuesto por carrera,
  en una tabla de 12 meses editable, con filtros y opción de copiar un mes a otro.
- **Control de carrera** (`/control`): visualización de los 12 hitos del lanzamiento de cada
  carrera (Definición, Producción, Activación, Mejora continua) y tablero Kanban: las
  tarjetas se arrastran entre hitos, llevan etiquetas, responsable y estado on/off track.
  Ruta crítica (CPM) con duraciones y dependencias por hito: fechas planeadas, holgura,
  hitos atrasados y fecha de lanzamiento prevista.
- **Análisis** (`/analisis`): gráficas de leads contra meta, consumo contra presupuesto y
  costo por lead por semana; leads por responsable y por programa; tendencia de un
  indicador del Scorecard contra su meta; y carreras más lejos de su meta. Filtros por
  rango de fechas, programa, responsable, nivel y carrera; cada gráfica tiene vista en tabla.
- **Ajustes** (`/ajustes`): índice de configuraciones.
  - **Equipo** (`/ajustes/equipo`): personas, accesos y nombre del equipo.
  - **Hitos de Control de carrera** (`/ajustes/hitos`, administradores): editar, renombrar,
    eliminar, agregar y reordenar hitos; etapa, duración, dependencias y lanzamiento.
  - **Anuncios** (`/ajustes/anuncios`, administradores): hasta 5 imágenes (PNG, JPG, WEBP o
    GIF, máx. 5 MB) que aparecen como popup a todo el equipo cada N minutos (5 por
    defecto), en rotación; se pueden activar/desactivar en general o por imagen.
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
- **Scorecard** (`/scorecard`): indicadores semanales por dueño, con meta, semáforo y un dueño "rollup" calculado automáticamente (suma o promedio de los demás).
- **Issues** (`/issues`): lista IDS priorizable, con fecha específica, conversión a To-Do
  al resolver y botón "Enviar a ClickUp".
- **To-Dos** (`/todos`): pendientes semanales con descripción, dueño, fecha límite y botón
  "Enviar a ClickUp".
- **Dashboard** (`/`): muestra las Noticias compartidas en la reunión.
- **Reunión Level 10** (`/meeting`): agenda de 90 minutos (Buenas noticias, Scorecard, Rocks,
  Noticias, To-Dos, IDS, Conclusión). Botones "+ To-Do" y "+ Issue" disponibles en
  todos los pasos, y atajos por paso: "→ Issue" desde Scorecard, carreras a revisar,
  Rocks, Noticias y To-Dos; "+ To-Do" desde cada Issue en IDS. Timer por segmento, conectada en vivo a Scorecard, Rocks, Issues y To-Dos, y calificación final 1–10.
