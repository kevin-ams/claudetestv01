# Plan de revisión de seguridad — EOS Nivel 10 (noviembre 2026)

La revisión de arquitectura (`docs/revision-arquitectura.md`) ya cerró un riesgo de seguridad: el aislamiento entre
equipos en las acciones (P0). Esta revisión es distinta: mira la aplicación como lo haría alguien que quiere entrar,
leer datos ajenos o gastar recursos, y revisa cada puerta de entrada.

## Hallazgos preliminares (inventario rápido del 9 de noviembre)

| # | Hallazgo | Riesgo | Estado |
|---|---|---|---|
| 1 | Next.js 16.3.2 tenía avisos **críticos** (ejecución remota de código en optimización de imágenes, `next/og` y `use cache`; SSRF; DoS en server actions). | Crítico | Actualizado a 16.4.5 en la rama (pruebas, build y navegador OK). **Falta publicarlo.** |
| 2 | Si falta `AUTH_SECRET`, las sesiones se firman con una clave fija conocida (`src/lib/auth/token.ts`): cualquiera podría fabricar una sesión. | Crítico si falta la variable | Verificar en Netlify que `AUTH_SECRET` existe (solo el nombre). Cambiar el código para que en producción **no arranque** sin ella. |
| 3 | El inicio de sesión no limita intentos: se pueden probar contraseñas sin freno. | Alto | Por corregir: límite por correo e IP, con espera creciente. |
| 4 | No hay encabezados de seguridad (CSP, `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS). | Medio | Por corregir en `next.config.ts` (`headers()`), con la CSP afinada para Clarity. |
| 5 | Las sesiones duran 30 días y no se pueden revocar (no hay "cerrar sesión en todos los dispositivos" ni invalidación al cambiar la contraseña). | Medio | Por decidir: versión de sesión por usuario en la base. |
| 6 | 4 avisos menores en dependencias internas (`brace-expansion`, `source-map-js`, `uuid` vía `exceljs`): denegación de servicio en herramientas de compilación. | Bajo | Revisar en la fase 1. |

## Alcance

Toda la app en `eos-marketing/` (Next.js en Netlify, base Neon/PGlite), sus integraciones (ActiveCampaign, Resend,
ClickUp, Netlify Blobs), el servidor MCP, el asistente IA y la configuración de Netlify. Fuera de alcance: la
seguridad de los proveedores mismos y pruebas de carga.

## Método

1. **Modelo de amenazas**: quién puede atacar (visitante sin sesión, persona de otro equipo, cuenta de demo,
   persona con rol de solo lectura, token MCP filtrado, contenido malicioso dentro de notas o datos) y qué querría
   (entrar, leer, modificar, gastar dinero, tumbar el sitio).
2. **Revisión de código por área** con la lista de abajo. Cada hallazgo se confirma leyendo el código o con una prueba
   local, nunca contra producción.
3. **Herramientas automáticas**: `npm audit`, búsqueda de secretos en el historial de git, y las pruebas de
   aislamiento existentes, ampliadas con pruebas de seguridad (inicio de sesión, permisos, entradas inválidas).
4. **Informe** con riesgo, evidencia (archivo y línea), corrección propuesta y prueba que la cubre. Las correcciones
   se hacen y se prueban en local, y se publican en un solo deploy con tu aprobación.

## Lista de revisión por área

| Área | Qué se revisa |
|---|---|
| **Autenticación** | Firma y vigencia de la sesión, `AUTH_SECRET`, cookie (`httpOnly`, `secure`, `sameSite`), límite de intentos, recuperación de contraseña (caducidad y un solo uso del enlace), enumeración de correos, `bcrypt` (costo 10), cambio de contraseña. |
| **Autorización** | Rol y módulo en cada página, acción y ruta `/api/*`; dueño de la plataforma; Premium; solo lectura; demo. Repaso de las 12 rutas API (`avatar`, `logo`, `anuncios`, `respaldo`, `exportar`, `reuniones/[id]/resumen`, `calendario/planificacion`, `cron`, `mcp`, `asistente`). |
| **Datos entre organizaciones** | Organizaciones nuevas (P1), vault y V/TO en el equipo ancla, tokens MCP, caché del asistente, búsquedas semánticas. |
| **Entradas y salidas** | Validación (zod) en las acciones que faltan; los 3 usos de HTML sin escapar (vista previa del vault y del asistente: confirmar que pasan por `rehype-sanitize`); archivos subidos (tamaño, tipo, nombre); exportaciones a Excel (fórmulas inyectadas); correos (inyección de encabezados). |
| **Servidor MCP** | Tokens (hash, revocación, límite por minuto, alcance y escritura), CORS `*` (aceptable con token, confirmar), datos devueltos y descripciones de herramientas. |
| **Asistente IA** | Inyección de instrucciones desde notas o datos (herramientas solo de lectura, a confirmar), topes de gasto, tamaño de la conversación, que no se filtren datos de otro rol por la caché. |
| **Integraciones y secretos** | Dónde vive cada clave, qué pasa si falta, `CRON_SECRET`, funciones en segundo plano (quién puede invocarlas), webhooks; búsqueda de secretos en el historial de git. |
| **Respaldo y restauración** | Quién puede descargar un respaldo completo y quién puede restaurarlo; si restaurar puede pisar otra organización. |
| **Navegador** | CSP, clickjacking, Clarity (enmascarado del contenido y de los campos), enlaces externos, datos en `localStorage`. |
| **Operación** | Logs sin datos sensibles, alertas, dependencias al día, `npm audit` en cada push (CI, P3 de la arquitectura). |

## Orden propuesto

| Fase | Trabajo | Esfuerzo |
|---|---|---|
| 0 · Ya | Publicar Next.js 16.4.5. Confirmar `AUTH_SECRET` en Netlify y hacer que la app falle si falta. | Bajo |
| 1 | Autenticación (límite de intentos, revocación de sesiones, recuperación de contraseña) y encabezados de seguridad. | Medio |
| 2 | Autorización de las rutas API, respaldo y restauración, archivos subidos y exportaciones. | Medio |
| 3 | MCP, asistente IA e integraciones; búsqueda de secretos. | Medio |
| 4 | Informe final, pruebas de seguridad en la batería de Vitest y `npm audit` en CI. | Bajo |

## Qué necesito de ti

- Confirmar en Netlify (Project configuration › Environment variables) que existe la variable **`AUTH_SECRET`**.
  Solo el nombre: no pegues su valor en el chat.
- Aprobar el deploy de la fase 0 (Next.js 16.4.5).
- Decidir si quieres "cerrar sesión en todos los dispositivos" y que cambiar la contraseña cierre las demás sesiones.
