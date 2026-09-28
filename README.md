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
| `CALLS_SHEET_ID` | ID de la hoja de Google Sheets de la campaña de llamadas (lo que va entre `/d/` y `/edit` en la URL). |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Correo de la cuenta de servicio de Google que lee la hoja. |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Llave privada (`private_key` del JSON de la cuenta de servicio). Se aceptan los `\n` literales. |
| `CALLS_FIXTURE_PATH` | Solo desarrollo: ruta a un JSON local con los datos de la hoja, para probar sin Google. No lo subas al repo. |

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
- **Campaña de llamadas** (`/llamadas`): dashboard de la campaña de llamadas en frío a leads de carreras, leído en vivo de Google Sheets. Filtros por fecha, asesor, facultad, nivel, carrera, resultado, interés y "¿ya lo llamaron?"; KPIs de cobertura, contacto e interés; gráficos por asesor, día, hora, antigüedad del lead y carrera; temas detectados en observaciones; recomendaciones automáticas; lista de seguimiento prioritario con enlace a WhatsApp; exportación a CSV.

## Sincronización con Google Sheets (campaña de llamadas)

La hoja sigue siendo la fuente de verdad: los asesores la llenan como siempre y el dashboard solo la **lee**.

1. En [Google Cloud Console](https://console.cloud.google.com/) crea (o usa) un proyecto, habilita **Google Sheets API** y crea una **cuenta de servicio**. En *Keys* genera una llave JSON.
2. Comparte la hoja con el correo de la cuenta de servicio (`...@...iam.gserviceaccount.com`) como **Lector**. Si el dominio de Google Workspace no permite compartir fuera, pide a TI que lo autorice para esa cuenta.
3. En Netlify → *Project configuration → Environment variables* agrega `CALLS_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, y vuelve a desplegar.

Cómo se actualiza:

- La lectura se guarda en caché **5 minutos** (`CALLS_REVALIDATE_SECONDS` en `src/lib/calls/source.ts`); pasado ese tiempo, la siguiente visita trae datos nuevos.
- El botón **Sincronizar ahora** descarta la caché y vuelve a leer la hoja al instante.
- Se leen todas las pestañas cuyo encabezado tenga `CARRERA` y `ESTADO LLAMADA` (p. ej. `contactos FISICC PREGRADO`); la facultad y el nivel salen del nombre de la pestaña. Las columnas se ubican por nombre, así que se pueden reordenar. Agregar una pestaña nueva con el mismo encabezado la incluye automáticamente.
- Filas sin `ESTADO LLAMADA` cuentan como *pendientes de llamar* (sirven para medir cobertura).

Para que las métricas sean confiables, los asesores deben llenar **Día** (dd/mm/aaaa) y **hora** (hh:mm) en cada llamada y usar las opciones de la pestaña *opciones* para ESTADO, YA LO LLAMARON e INTERÉS.

Código: `src/lib/calls/parse.ts` (normalización de la hoja), `src/lib/calls/analytics.ts` (métricas y recomendaciones), `src/lib/calls/source.ts` (lectura de Google + caché), `src/app/(app)/llamadas/*` (UI).
