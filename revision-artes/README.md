# GES: Administrador de Revisión de Artes

Interfaz construida con [HeroUI v3](https://heroui.com) (Tailwind CSS v4 + React Aria).

App para que las facultades revisen y aprueben los artes de sus campañas antes de publicarse.

- **Administración** (`/admin`): el equipo de comunicación crea facultades, carreras y artes,
  ve quién aprobó o pidió cambios, y sube nuevas versiones.
- **Portal de facultades** (`/portal`): un solo portal compartido. Cada facultad entra con su
  **código de acceso** y solo ve sus propios artes. No hay cuentas: se pide **nombre y correo**
  al entrar y quedan registrados en cada aprobación, solicitud de cambios o comentario.
- **Artes en Google Drive**: la app no almacena archivos, solo el enlace del archivo o carpeta
  de Drive, y los muestra con el visor de Google. El archivo debe estar compartido como
  *“Cualquier persona con el enlace puede ver”*. No requiere credenciales de Google, así que
  funciona igual en local y en producción.

## Desarrollo local

Requisitos: Node 22+ y Postgres 14+.

**Base de datos en Mac (Postgres.app, sin Docker):** instala https://postgresapp.com, pulsa
*Initialize* y crea el usuario y la base una sola vez:

```bash
/Applications/Postgres.app/Contents/Versions/latest/bin/psql -d postgres \
  -c "CREATE USER artes WITH PASSWORD 'artes';" -c "CREATE DATABASE revision_artes OWNER artes;"
```

(Con Docker basta `docker compose up -d`.)

```bash
cd revision-artes
npm install
cp .env.example .env.local     # ajusta AUTH_SECRET
npm run db:migrate             # crea/actualiza las tablas
npm run dev                    # http://localhost:3000
```

> Cada vez que traigas cambios nuevos (`git pull`), corre `npm install` y `npm run db:migrate`
> antes de `npm run dev`.

La primera vez entra a `http://localhost:3000/admin`: te pedirá crear la cuenta de administración.

> En local solo tú puedes abrir la app. Para que las facultades la usen hay que publicarla
> (ver *Producción*).

## Flujo

1. **Admin → Facultades**: crea la facultad. Se genera un código como `K7M2P-QX9RT`.
2. En la facultad agrega sus **carreras** y luego **+ Nuevo arte** (título, carrera o “toda la
   facultad”, campaña, formato, fecha de publicación, enlace de Drive y copy).
3. Comparte con la facultad el **enlace directo** (ya trae el código) o el código.
4. La facultad entra con nombre y correo y, por cada arte, puede **hacer clic sobre la imagen para
   marcar puntos numerados** y escribir qué cambiar en cada uno. Luego **Aprueba**, **Solicita
   cambios** (con puntos o comentario) o **Solo comenta**.
5. En el panel, el admin ve los cambios solicitados y usa **Subir nueva versión**: pega el enlace de
   Drive del archivo corregido, describe qué cambió y marca qué puntos quedaron atendidos. El arte
   pasa a la siguiente versión y vuelve a *Pendiente*. Las versiones anteriores, con sus puntos,
   siguen consultables.
6. **Regenerar código** cierra de inmediato el acceso de quien entró con el código anterior.
   Desmarcar *Acceso al portal activo* bloquea a la facultad sin borrar nada.

## Producción (Netlify)

Cuando esté lista la versión final, se publica en Netlify como un sitio aparte con
**base directory = `revision-artes`**:

- Netlify Database aprovisiona Postgres y aplica `netlify/database/migrations` en cada deploy
  (no se usa `DATABASE_URL` ni `db:migrate` allí).
- Configura la variable `AUTH_SECRET` (por ejemplo `openssl rand -base64 32`).
- Opcional: `APP_TIMEZONE` (por defecto `America/Guatemala`) para las fechas del historial.

## Estructura

- `src/lib/domain/*` — acceso a datos (facultades, carreras, artes, revisiones, admins).
- `src/lib/auth/*` — sesiones separadas para admin (contraseña) y portal (código de facultad).
- `src/lib/drive.ts` — lectura de enlaces de Drive y URLs de vista previa/miniatura.
- `src/components/visor-arte.tsx` — visor del arte con los puntos marcados (coordenadas en %).
  Los puntos funcionan con archivos (imagen o PDF); para carpetas se usa el visor de Drive.
- `src/app/admin/*` — panel de administración.
- `src/app/portal/*` — portal de facultades. Toda consulta filtra por la facultad de la sesión.
- `netlify/database/migrations/*` — esquema SQL.
- `scripts/migrate.mjs` — aplica las migraciones a la base local.
