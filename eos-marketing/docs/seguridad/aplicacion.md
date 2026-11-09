# Seguridad de la aplicación (ISO 27001 8.2–8.7, 8.12, 8.26–8.28; OWASP ASVS 5.0 nivel 2)

## Autenticación (8.5)

- Contraseñas con bcrypt (costo 10); política: 10+ caracteres, sin contraseñas comunes ni el correo
  (`src/lib/auth/password-policy.ts`). Aplica a contraseñas nuevas o cambiadas.
- Límite de intentos (`src/lib/security/attempts.ts`): 5 fallos en 15 min bloquean la cuenta 15 min; 30 fallos por IP.
  Aplica a contraseña, código de doble factor y pedidos de restablecimiento. Al bloquearse se avisa al dueño.
- Tiempo constante: si el correo no existe se compara contra un hash de referencia (no revela qué correos existen).
- Doble factor opcional (TOTP, RFC 6238) con 10 códigos de recuperación de un solo uso. El Administrador Premium lo
  habilita en Ajustes › Seguridad; cada persona lo activa en Mi perfil. El secreto se guarda cifrado (AES-256-GCM).
- Sesión: cookie `httpOnly`, `secure`, `sameSite=lax`, firmada (HS256), 30 días. Por decisión de la institución no
  hay "cerrar sesión en todos los dispositivos".
- Restablecer contraseña: enlace de un solo uso con caducidad, respuesta idéntica exista o no la cuenta.

## Autorización (8.2, 8.3)

- Rol por módulo en cada página, acción y ruta API; aislamiento por equipo y organización con pruebas.
- Privilegios: dueño de la plataforma (respaldos, topes de IA, rol Premium), Administrador Premium (doble factor,
  módulos premium), administradores (equipo, roles, bitácora).
- Rutas API revisadas: `avatar`, `logo` y `anuncios` (imágenes, públicas para correos), `respaldo` (**solo el dueño**),
  `exportar/*` (por módulo + bitácora), `reuniones/[id]/resumen` y `calendario/planificacion` (sesión + equipo),
  `cron/*` (`CRON_SECRET` en tiempo constante), `mcp` (token con hash, alcance y límite por minuto),
  `asistente` (módulo premium + topes), `csp-report` (pública, no guarda nada).

## Entradas y salidas (8.7, 8.12, 8.28)

- Validación con zod en las acciones principales (Issues, To-Dos, Rocks, Scorecard, L10, asistente, ajustes).
- HTML de usuario (vault y asistente) pasa por `rehype-sanitize`; el correo de reportes se previsualiza en un iframe
  con `sandbox`.
- Imágenes: se aceptan solo si sus bytes son PNG, JPEG, GIF o WEBP (`sniffImage`), máximo 5 MB.
- CSV del Dashboard AC: textos que empiezan con `= + - @` se neutralizan (`src/lib/csv.ts`). Las exportaciones Excel
  usan celdas tipadas (texto no se evalúa como fórmula).
- SQL siempre parametrizado (plantillas `sql\`\``).

## Navegador (8.26)

Encabezados en `next.config.ts`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, HSTS de un año, `Permissions-Policy` (sin cámara, micrófono,
ubicación, pagos), `Cross-Origin-Opener-Policy: same-origin`, sin `X-Powered-By`.

**CSP en modo "solo reporte":** no bloquea nada; lo que bloquearía llega a `/api/csp-report` y queda en los logs de
Netlify (`[csp]`). Plan: revisar los reportes 1–2 semanas, ajustar la lista y cambiar el encabezado a
`Content-Security-Policy` (aplicada). Mejora posterior: nonces por petición en `proxy.ts` para quitar `'unsafe-inline'`.

## MCP y Asistente IA

- Tokens MCP: solo se guarda el hash; alcance (vault / EOS completo), escritura opcional, 120 peticiones/min,
  revocables; creación y revocación quedan en la bitácora. CORS `*` es aceptable porque cada petición exige el token.
- Asistente: herramientas solo de lectura con los permisos del rol; el contenido de las notas se trata como datos,
  no instrucciones; topes por organización, persona y plataforma; caché separada por equipo, rol y modelo.

## Clarity (8.11)

Todo el contenido de `<main>` va con `data-clarity-mask`; los campos de formulario los oculta Clarity por omisión.
Las sesiones se identifican con un número interno, equipo y rol (sin nombres ni correos). Recomendado: modo
"Estricto" en Clarity › Configuración › Enmascaramiento.
