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
2. En la facultad agrega sus **carreras** y crea sus **campañas**. Dentro de cada campaña usa
   **+ Nuevo arte** (título, carrera o “toda la facultad”, formato, fecha de publicación, enlace de
   Drive y copy). Navegación: **Facultad → Campaña → Artes** (en el admin y en el portal). Los
   artes sin campaña aparecen como “Otros artes”.
3. Comparte con la facultad el **enlace directo** (ya trae el código) o el código.
4. La facultad entra con nombre y correo, ve sus **campañas** (las que tienen pendientes primero),
   entra a una y, por cada arte, puede **hacer clic sobre la imagen para
   marcar puntos numerados** y escribir qué cambiar en cada uno. Luego **Aprueba**, **Solicita
   cambios** (con puntos o comentario) o **Solo comenta**.
5. En el panel, el admin ve los cambios solicitados y usa **Subir nueva versión**: pega el enlace de
   Drive del archivo corregido, describe qué cambió y marca qué puntos quedaron atendidos. El arte
   pasa a la siguiente versión y vuelve a *Pendiente*. Las versiones anteriores, con sus puntos,
   siguen consultables.
6. **Aviso por correo:** al publicar una nueva versión se puede avisar por correo (Resend) a las
   personas de la facultad que revisaron el arte (vienen marcadas quienes pidieron cambios o
   comentaron). El correo trae un botón que lleva directo al arte. También se puede reenviar desde
   la tarjeta **Notificar nueva versión**. Cada aviso queda en el historial del admin.
7. **Campaña revisada:** cuando la facultad revisa el último arte pendiente de una campaña
   (todos quedan aprobados o con cambios solicitados), se envía un correo a **quien creó la
   campaña** con el estado de cada arte. Si todos están aprobados, el asunto es
   “✅ Campaña aprobada”. Las campañas sin creador registrado avisan a todos los administradores.
8. **Regenerar código** cierra de inmediato el acceso de quien entró con el código anterior.
   Desmarcar *Acceso al portal activo* bloquea a la facultad sin borrar nada.

## Reporte para Diseño

En cada campaña, **📄 Reporte para Diseño** genera un reporte imprimible (Imprimir / Guardar PDF)
con cada arte que tiene cambios solicitados: la imagen de la versión actual con los puntos
numerados, la lista de cambios con casillas para ir marcando, los comentarios generales, el copy
y el enlace al archivo en Drive. Se puede ver solo lo que tiene cambios o todos los artes.

- **Enlace para Diseño** (`/reporte/<token>`): se abre sin cuenta y siempre muestra el estado
  actual. Se crea y se revoca desde el reporte (migración 006).
- **Enviar por correo**: manda el enlace con un resumen a uno o varios correos de Diseño (Resend).
- **Checklist de Diseño**: en el enlace, Diseño marca cada cambio al terminarlo (se guarda en el
  servidor, con su nombre opcional). Cada arte muestra su avance. Cuando un arte queda completo, se
  crea un aviso en el panel (y dice si con eso se completó toda la campaña). En el admin el
  checklist se ve en solo lectura (migración 007).

## Avisos (🔔)

La campanita del encabezado del admin muestra los avisos sin leer de cada administrador:
Diseño terminó los cambios de un arte, y la facultad terminó de revisar una campaña. Se actualiza
cada minuto; cada aviso lleva a su arte o campaña y se puede marcar todo como leído.

## Guía del portal

La primera vez que alguien entra al portal se abre una **guía interactiva** que resalta cada
parte de la pantalla y explica para qué sirve (inicio/campañas, campaña y arte). Se puede
**omitir**, marcar **“No mostrar guías automáticamente”**, y volver a verla o reactivarla desde
el botón **? Ayuda** del encabezado. Las preferencias se guardan en el navegador, por correo.
El contenido está en `src/components/guia/pasos.ts`.

## Producción (Netlify)

Sitio: **ges-revision-artes** → https://gesartes.amscreativeint.com (también https://ges-revision-artes.netlify.app; variables ya configuradas:
`AUTH_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `APP_URL`, `APP_TIMEZONE`).
Se publica desde esta carpeta (`revision-artes`). Antes de publicar desde tu máquina, aparta
`.env.local` (no debe viajar en el despliegue; la app igual prioriza la base de Netlify):

- Netlify Database aprovisiona Postgres y aplica `netlify/database/migrations` en cada deploy
  (no se usa `DATABASE_URL` ni `db:migrate` allí). La app se conecta con el driver HTTP de Neon
  usando `NETLIFY_DB_URL` (`src/lib/db.ts`), igual que EOS.
- Configura la variable `AUTH_SECRET` (por ejemplo `openssl rand -base64 32`).
- Opcional: `APP_TIMEZONE` (por defecto `America/Guatemala`) para las fechas del historial.

## Correos (Resend)

Misma integración que EOS: API HTTP de [Resend](https://resend.com), sin dependencias extra
(`src/lib/email.ts`). Variables:

| Variable | Descripción |
| -------- | ----------- |
| `RESEND_API_KEY` | Llave de envío (secreta). Sin ella la app funciona pero no envía avisos. |
| `RESEND_FROM` | Remitente, p. ej. `GES Revisión de Artes <artes@tudominio.com>` (dominio verificado en Resend). Sin ella se usa `onboarding@resend.dev`, que solo entrega al dueño de la cuenta. |
| `APP_URL` | Dirección pública para los enlaces del correo (p. ej. `https://gesartes.amscreativeint.com`). |

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
