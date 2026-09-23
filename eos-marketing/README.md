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
de administrador.

**Volver a cero:** detén la app y borra la carpeta `.data/`.

## Variables de entorno (opcionales)

| Variable       | Descripción                                                     |
| -------------- | ---------------------------------------------------------------- |
| `AUTH_SECRET`  | Secreto para firmar las cookies de sesión. Si falta, usa uno de desarrollo. |
| `EOS_DATA_DIR` | Carpeta de la base de datos local (por defecto `.data/pglite`). |

## Estructura

- `src/lib/db.ts` — conexión a PGlite y ejecución de migraciones.
- `src/lib/domain/*` — acceso a datos (SQL), sin lógica de UI.
- `src/lib/auth/*` — sesiones, contraseñas y acciones de login/registro.
- `src/app/(app)/*` — módulos protegidos de la aplicación (un folder por módulo).
- `db/migrations/*` — esquema SQL, se aplica automáticamente al arrancar.

## Módulos

- **V/TO** (`/vto`): Vision/Traction Organizer editable por secciones.
- **Organigrama** (`/accountability`): árbol de asientos con roles/responsabilidades.
- **Rocks** (`/rocks`): prioridades trimestrales de la empresa y de cada persona, con hitos.
- **Scorecard** (`/scorecard`): indicadores semanales por dueño, con meta, semáforo y un dueño "rollup" calculado automáticamente (suma o promedio de los demás).
- **Issues** (`/issues`): lista IDS priorizable, con conversión a To-Do al resolver.
- **To-Dos** (`/todos`): pendientes semanales con dueño y fecha límite.
- **Reunión Level 10** (`/meeting`): agenda de 90 minutos con timer por segmento, conectada en vivo a Scorecard, Rocks, Issues y To-Dos, y calificación final 1–10.
