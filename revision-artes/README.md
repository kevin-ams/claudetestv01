# Revisión de Artes

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

Requisitos: Node 22+ y Docker (o cualquier Postgres 14+).

```bash
cd revision-artes
npm install
cp .env.example .env.local     # ajusta AUTH_SECRET
docker compose up -d           # Postgres local en el puerto 5432
npm run db:migrate             # crea las tablas
npm run dev                    # http://localhost:3000
```

La primera vez entra a `http://localhost:3000/admin`: te pedirá crear la cuenta de administración.

> En local solo tú puedes abrir la app. Para que las facultades la usen hay que publicarla
> (ver *Producción*).

## Flujo

1. **Admin → Facultades**: crea la facultad. Se genera un código como `K7M2P-QX9RT`.
2. En la facultad agrega sus **carreras** y luego **+ Nuevo arte** (título, carrera o “toda la
   facultad”, campaña, formato, fecha de publicación, enlace de Drive y copy).
3. Comparte con la facultad el **enlace directo** (ya trae el código) o el código.
4. La facultad entra con nombre y correo, y por cada arte puede **Aprobar**, **Solicitar cambios**
   (con comentario obligatorio) o **Solo comentar**.
5. Si el admin cambia el enlace de Drive, se registra como **nueva versión** y el arte vuelve a
   *Pendiente*.
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
- `src/app/admin/*` — panel de administración.
- `src/app/portal/*` — portal de facultades. Toda consulta filtra por la facultad de la sesión.
- `netlify/database/migrations/*` — esquema SQL.
- `scripts/migrate.mjs` — aplica las migraciones a la base local.
