# EOS · Nivel 10

App en línea para llevar Traction/EOS: **V/TO**, **Organigrama de Responsabilidad**,
**Rocks**, **Scorecard**, **Issues (IDS)**, **To-Dos** y la **Reunión Level 10**
con agenda, timer y calificación final.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router, Server Actions) + TypeScript + Tailwind CSS v4
- [Netlify Database](https://docs.netlify.com/build/data-and-storage/netlify-database/) (Postgres, se aprovisiona solo al desplegar)
- Autenticación propia con cookies firmadas (JWT vía `jose`) + `bcryptjs`
- Desplegado en Netlify (`@netlify/plugin-nextjs`)

## Desarrollo local

```bash
npm install
npx netlify dev
```

`netlify dev` levanta Next.js y aprovisiona una base de datos de desarrollo
automáticamente (no requiere Postgres local). La primera vez que abras la app
verás la pantalla de configuración (`/setup`) para crear tu equipo y tu cuenta
de administrador.

## Variables de entorno

| Variable      | Descripción                                              |
| ------------- | --------------------------------------------------------- |
| `AUTH_SECRET` | Secreto usado para firmar las cookies de sesión (JWT). Ya está configurado en el sitio de Netlify. |

## Estructura

- `src/lib/domain/*` — acceso a datos (Postgres vía `@netlify/database`), sin lógica de UI.
- `src/lib/auth/*` — sesiones, contraseñas y acciones de login/registro.
- `src/app/(app)/*` — módulos protegidos de la aplicación (un folder por módulo).
- `netlify/database/migrations/*` — esquema SQL, se aplica automáticamente en cada deploy.

## Módulos

- **V/TO** (`/vto`): Vision/Traction Organizer editable por secciones.
- **Organigrama** (`/accountability`): árbol de asientos con roles/responsabilidades.
- **Rocks** (`/rocks`): prioridades trimestrales de la empresa y de cada persona, con hitos.
- **Scorecard** (`/scorecard`): indicadores semanales por dueño, con meta, semáforo y un dueño "rollup" calculado automáticamente (suma o promedio de los demás).
- **Issues** (`/issues`): lista IDS priorizable, con conversión a To-Do al resolver.
- **To-Dos** (`/todos`): pendientes semanales con dueño y fecha límite.
- **Reunión Level 10** (`/meeting`): agenda de 90 minutos con timer por segmento, conectada en vivo a Scorecard, Rocks, Issues y To-Dos, y calificación final 1–10.
