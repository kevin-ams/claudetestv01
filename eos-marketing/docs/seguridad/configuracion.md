# Configuración y secretos (ISO 27001 8.9, 8.24)

## Cómo funciona

- **Un solo punto de lectura:** `src/lib/config/server.ts` (`server-only`) lee y valida todas las variables.
  `src/lib/config/shared.ts` solo tiene lo no secreto que puede llegar al navegador (zona horaria).
- **Regla de lint:** `process.env` está prohibido en `src/**` fuera de esos módulos (`no-restricted-properties`).
  Las funciones de Netlify (`netlify/functions/*`) son paquetes aparte y leen solo `APP_URL`/`URL` y `CRON_SECRET`.
- **Falla segura:** en producción, sin `AUTH_SECRET`, la app no firma ni acepta sesiones (no hay clave por omisión).
  Las integraciones opcionales sin clave se apagan y lo indica Ajustes › Diagnóstico › Configuración del servidor.
- **Navegador:** no hay variables `NEXT_PUBLIC_*`. `npm run check:secrets` (en CI, después del build) revisa que el
  JavaScript publicado no lea variables secretas ni contenga valores con forma de clave.
- **Diagnóstico:** muestra si cada variable está, nunca su valor.

## Inventario

| Variable | Secreta | Obligatoria | Alcance en Netlify | Para qué | Rotación |
|---|---|---|---|---|---|
| `AUTH_SECRET` | Sí | Sí | Functions | Firma sesiones; deriva la clave que cifra el doble factor | Anual o ante sospecha (ver abajo) |
| `CRON_SECRET` | Sí | Sí | Functions | Protege `/api/cron/*` y las funciones programadas | Anual |
| `RESEND_API_KEY` | Sí | No | Functions | Correos | Anual |
| `ACTIVECAMPAIGN_API_KEY` | Sí | No | Functions | Leads y tratos | Al salir quien la creó |
| `CLICKUP_API_TOKEN` | Sí | No | Functions | Tareas de ClickUp | Al salir quien la creó |
| `ANTHROPIC_API_KEY` | Sí | No | Functions | Asistente IA | Anual |
| `NETLIFY_DB_URL` | Sí | Auto | La define Netlify Database | Conexión a la base | La gestiona Netlify |
| `APP_URL` | No | No | Todos | Enlaces de correos | — |
| `ACTIVECAMPAIGN_API_URL` | No | No | Functions | Cuenta de ActiveCampaign | — |
| `RESEND_FROM`, `CLICKUP_SPACE_NAME`, `CLICKUP_SPACE_ID`, `EOS_TIMEZONE` | No | No | Functions | Ajustes | — |
| `AI_GLOBAL_MONTHLY_CAP_USD` | No | No | Functions | Tope global de IA | — |
| `CLARITY_PROJECT_ID` | No (es público) | No | Functions | Analítica | — |
| `PLATFORM_OWNER_EMAILS` | No | No | Functions | Dueño de la plataforma | Al cambiar de dueño |
| `EOS_FORCE_LOCAL_DB`, `EOS_DATA_DIR`, `EOS_UPLOADS_DIR` | No | No | Solo local | Desarrollo y pruebas | — |

## En Netlify (lo hace el dueño de la plataforma)

1. Project configuration › Environment variables: en cada variable secreta, **Options › Edit › "Contains secret
   values"** (no se muestra en la interfaz ni en los logs de build) y alcance **Functions** (no Builds).
2. Team settings › Members: solo las personas que publican; con doble factor activo en su cuenta de Netlify.
3. Cambiar una variable no afecta lo publicado hasta el siguiente deploy.

## Rotación

1. Generar el valor nuevo (32+ caracteres aleatorios para `AUTH_SECRET` y `CRON_SECRET`; en el proveedor para las demás).
2. Reemplazarlo en Netlify y publicar.
3. Revocar el valor anterior en el proveedor.
4. **`AUTH_SECRET`:** al cambiarla se cierran todas las sesiones (todos vuelven a entrar) y los secretos de doble
   factor ya no se pueden descifrar: antes de rotarla, avisar a quienes usan doble factor; después, restablecerlo en
   Ajustes › Seguridad para que lo activen de nuevo.
5. Registrar la rotación (fecha, variable, quién) en la bitácora de cambios (`docs/seguridad/operacion.md`).
