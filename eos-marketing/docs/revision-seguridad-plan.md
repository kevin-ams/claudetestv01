# Plan de revisión de seguridad — EOS Nivel 10 (noviembre 2026)

**Marco:** ISO/IEC 27001:2022 y sus controles del Anexo A (detallados en ISO/IEC 27002:2022), más **OWASP ASVS 5.0
nivel 2** como lista técnica para verificar la aplicación.

La revisión de arquitectura (`docs/revision-arquitectura.md`) ya cerró un riesgo de seguridad: el aislamiento entre
equipos (P0). Esta revisión es más amplia: cubre las bases de un sistema de gestión de seguridad de la información
(SGSI) en lo que toca a la plataforma.

> **Alcance de ISO 27001.** La certificación es de una **organización** (su SGSI), no de una aplicación. Este plan cubre
> lo que la plataforma debe tener y demostrar: los controles tecnológicos y la evidencia de los organizacionales que
> dependen de ella. Los controles de personas (6.x) y físicos (7.x) son responsabilidad de la institución y de los
> proveedores de nube. Quedan señalados, pero no se implementan en el código.

---

## 1. Hallazgos preliminares (inventario del 9 de noviembre)

| # | Hallazgo | Control | Riesgo | Estado |
|---|---|---|---|---|
| 1 | Next.js 16.3.2 tenía avisos **críticos** (ejecución remota de código en optimización de imágenes, `next/og` y `use cache`; SSRF; DoS en server actions). | 8.8 | Crítico | Actualizado a 16.4.5 en la rama y probado. **Publicación en espera de tu aprobación.** |
| 2 | Si faltara `AUTH_SECRET`, las sesiones se firmarían con una clave fija conocida. Hoy existe en Netlify, pero el código no se protege si se borra. | 8.9, 8.24 | Alto (latente) | La app debe negarse a arrancar sin ella (fase 3). |
| 3 | Las variables de entorno se leen directamente (`process.env`) en **26 archivos**, sin validación ni inventario. 4 de los archivos que leen secretos no están marcados como "solo servidor". No hay `.env.example`. | 8.9 | Medio | Encapsulamiento (fase 3). |
| 4 | El inicio de sesión no limita intentos. No hay doble factor (MFA) para administradores ni para el dueño de la plataforma. | 8.5 | Alto | Fase 2. |
| 5 | Las sesiones duran 30 días y no se pueden revocar. Cambiar la contraseña no cierra las demás sesiones. | 8.5, 5.18 | Medio | Fase 2. |
| 6 | No hay encabezados de seguridad (CSP, `frame-ancestors`, HSTS, `X-Content-Type-Options`, `Referrer-Policy`). | 8.26, 8.28 | Medio | Fase 4. |
| 7 | El registro de actividad cubre cambios de negocio, pero no eventos de seguridad: inicios de sesión fallidos, creación de tokens, descargas de respaldos, cambios de rol. | 8.15, 8.16 | Medio | Fase 5. |
| 8 | No hay CI: las pruebas, `tsc`, `eslint` y `npm audit` se corren a mano. Se publica desde una rama de trabajo, no desde `main` con revisión. | 8.25, 8.32 | Medio | Fase 7. |
| 9 | Quedan 4 avisos menores en dependencias internas (`brace-expansion`, `source-map-js`, `uuid` vía `exceljs`). | 8.8 | Bajo | Fase 7. |
| 10 | No se encontraron secretos en el historial de git (búsqueda rápida). | 8.4 | — | Confirmar con un escáner en la fase 7. |

---

## 2. Método

1. **Inventario y clasificación** de activos y datos (5.9, 5.12): qué datos guarda la plataforma, quién es dueño de
   cada uno y qué tan sensible es (por ejemplo, contactos de leads, presupuestos, evaluaciones de personas en la L10,
   notas del vault).
2. **Registro de riesgos**: amenaza, probabilidad, impacto, control que lo trata y riesgo residual. Atacantes
   posibles: visitante sin sesión, persona de otro equipo u organización, cuenta de demo, rol de solo lectura,
   token MCP filtrado, contenido malicioso dentro de notas o datos (para la IA), proveedor comprometido.
3. **Declaración de aplicabilidad (SoA)** de la plataforma: cada control del Anexo A con "aplica / no aplica",
   cómo se cumple y dónde está la evidencia.
4. **Verificación técnica** con OWASP ASVS nivel 2: revisión de código, pruebas automatizadas (Vitest) y pruebas
   locales. Nunca se ataca producción.
5. **Correcciones**: se hacen y prueban en local, se publican en un solo deploy con tu aprobación, y cada una queda
   con su prueba y su evidencia.

---

## 3. Controles del Anexo A y lo que implican para la plataforma

### Tecnológicos (8.x): se implementan en la plataforma

| Control | Qué significa aquí | Trabajo |
|---|---|---|
| **8.2** Derechos de acceso privilegiado | Dueño de la plataforma, Administrador, Administrador Premium. | Lista de quién tiene privilegios. MFA obligatorio para esos roles. Registro de cada uso privilegiado. |
| **8.3** Restricción de acceso a la información | Roles por módulo, aislamiento por equipo y organización (P0). | Pruebas de aislamiento por módulo (ya hay 23). Revisar las 12 rutas `/api/*` y el respaldo. |
| **8.4** Acceso al código fuente | Repositorio en GitHub. | Protección de `main` (PR obligatorio), revisión de colaboradores, escaneo de secretos. |
| **8.5** Autenticación segura | Contraseñas con bcrypt y sesión firmada (JWT). | Límite de intentos y bloqueo temporal. MFA (TOTP) para privilegiados. Política de contraseñas. Revocar sesiones. Enlace de recuperación de un solo uso con caducidad corta. |
| **8.6** Gestión de capacidad | Límites de uso. | Límites por minuto en las rutas API. Topes de la IA (ya hechos). Tamaño máximo de archivos. |
| **8.7** Protección contra malware | Archivos subidos (imágenes, PDF al convertidor, respaldos). | Validar tipo real y tamaño. No servir archivos como HTML. Nombres seguros. |
| **8.8** Vulnerabilidades técnicas | Dependencias y avisos. | `npm audit` en CI, Dependabot, tiempo máximo para parchar (crítico: 48 h). |
| **8.9** Gestión de la configuración | **Encapsulamiento de variables** (ver sección 4). | Un módulo de configuración validado, sin valores por omisión para secretos e inventariado. |
| **8.10** Eliminación de información | Borrar personas, equipos y la demo. | Política de retención (actividad, consumo de IA, respaldos, versiones de notas) y borrado verificable. |
| **8.11** Enmascaramiento de datos | Clarity, logs y exportaciones. | Confirmar el enmascarado de Clarity (contenido y campos). Logs sin datos personales ni tokens. |
| **8.12** Prevención de fuga de datos | Exportaciones a Excel, respaldos, MCP, asistente IA, correos. | Quién puede exportar y descargar respaldos, registro de cada descarga, alcance de los tokens MCP. |
| **8.13** Respaldo de la información | Respaldo propio y Neon. | Frecuencia, cifrado, dónde se guardan y una **prueba de restauración** documentada. |
| **8.15 / 8.16** Registro y monitoreo | Bitácora de actividad. | Bitácora de **eventos de seguridad**, protegida contra cambios, con retención definida y alertas (fallos de sincronización, picos de inicios de sesión fallidos, gasto de la IA). |
| **8.20–8.22** Seguridad y segregación de redes | Netlify, Neon y APIs externas. | Conexión a la base solo desde funciones. Revisar el CORS del MCP. Sin puertos expuestos. |
| **8.24** Uso de criptografía | TLS, firma de sesión, hash de tokens. | HSTS, largo mínimo de `AUTH_SECRET`, rotación de claves sin cerrar todas las sesiones de golpe, cifrado en reposo (Neon), procedimiento de rotación. |
| **8.25–8.29** Desarrollo seguro y pruebas | Ciclo de desarrollo. | Requisitos de seguridad por cambio, revisión de código, pruebas de seguridad en Vitest, ASVS nivel 2. |
| **8.31** Separación de entornos | Local (PGlite) y producción (Neon). | Un entorno de pruebas (rama de Neon y deploy preview) para probar antes de publicar sin tocar datos reales. |
| **8.32** Gestión de cambios | Deploys manuales desde una rama. | Publicar desde `main` con PR aprobado y CI en verde. Registro de cada deploy (qué cambió, quién lo aprobó). |
| **8.33** Información de prueba | Datos de demo. | Nunca copiar datos reales al entorno local ni a la demo. |

### Organizacionales (5.x): la plataforma da soporte y evidencia

| Control | Qué aporta la plataforma | Qué decide la institución |
|---|---|---|
| **5.9 / 5.12** Inventario y clasificación | Inventario de datos y dónde viven. | Dueño y nivel de confidencialidad de cada dato. |
| **5.14** Transferencia de información | Correos (Resend), exportaciones, MCP, IA. | Qué se puede enviar fuera y a quién. |
| **5.15–5.18** Control de acceso e identidades | Roles, alta y baja de personas, informe de accesos para revisión periódica. | Quién aprueba accesos. Revisión trimestral. |
| **5.19–5.23** Proveedores y nube | Lista de proveedores y qué datos recibe cada uno: Netlify, Neon, Anthropic, Resend, ActiveCampaign, ClickUp, Microsoft Clarity, GitHub. | Aceptar sus términos y acuerdos de tratamiento de datos (DPA). Revisar sus certificaciones (SOC 2, ISO 27001). |
| **5.24–5.28** Gestión de incidentes | Bitácora, alertas, procedimiento técnico (revocar tokens y sesiones, rotar claves, restaurar). | Responsable de incidentes, contacto y a quién se notifica. |
| **5.29 / 5.30** Continuidad | Respaldo y restauración probados. Plan si cae Netlify o Neon. | Tiempo máximo aceptable sin la plataforma. |
| **5.33 / 5.34** Registros y privacidad (PII) | Retención, borrado, enmascarado, aviso de privacidad. | Política de privacidad. Datos de estudiantes y leads. |
| **5.36 / 5.37** Cumplimiento y procedimientos | Informe de esta revisión y procedimientos escritos. | Revisión anual. |

### Personas (6.x) y físicos (7.x)

No se implementan en la plataforma. Los personas incluyen capacitación, confidencialidad y salida de personal; la
plataforma ayuda con la baja de accesos. Los físicos los cubren los centros de datos de Netlify, Neon y los demás
proveedores, con sus certificaciones.

---

## 4. Encapsulamiento de variables y secretos (control 8.9 + 8.24)

**Hoy:** 24 variables se leen con `process.env` desde 26 archivos. Algunas tienen valores por omisión inseguros
(`AUTH_SECRET`). Nada valida al arrancar que estén completas. Ningún documento dice cuáles existen ni para qué sirve
cada una.

**Propuesta:**

1. **Un solo módulo de configuración del servidor** (`src/lib/config/server.ts`, marcado `server-only`):
   - Lee y valida **todas** las variables con un esquema `zod` una sola vez.
   - Expone funciones tipadas (`config.auth.secret()`, `config.anthropic.apiKey()`, …).
   - Ningún otro archivo vuelve a leer `process.env`.
2. **Regla de lint** que prohíbe `process.env` fuera de ese módulo, para que no se rompa con el tiempo.
3. **Falla segura:**
   - En producción, si falta un secreto obligatorio (`AUTH_SECRET`, base de datos), la app no arranca.
   - `AUTH_SECRET` debe tener un largo mínimo de 32 caracteres.
   - Los secretos nunca tienen valor por omisión.
   - Una integración opcional (ActiveCampaign, ClickUp, Resend, Anthropic) sin clave se apaga y lo dice en Diagnóstico.
4. **Separación servidor/navegador:**
   - Ninguna variable secreta llega al navegador. Hoy no hay `NEXT_PUBLIC_*`; se mantiene así.
   - Lo público, como el ID de Clarity, se pasa explícitamente desde el servidor.
   - Una prueba automática revisa que el JavaScript publicado no contiene nombres ni valores de secretos.
5. **Inventario documentado** (`.env.example` sin valores + `docs/configuracion.md`) con cada variable:
   - para qué sirve;
   - si es secreta;
   - si es obligatoria;
   - en qué alcance de Netlify va (Functions/Runtime frente a Builds);
   - quién la administra;
   - cada cuánto se rota.
6. **En Netlify:**
   - Marcar las claves como *secret* (no se muestran ni salen en los logs).
   - Limitar su alcance a las funciones (no al build) cuando no se necesiten al compilar.
   - Revisar quién tiene acceso al equipo de Netlify.
7. **Rotación:**
   - Procedimiento escrito para cambiar cada clave (Anthropic, ActiveCampaign, Resend, ClickUp, `CRON_SECRET`).
   - Para `AUTH_SECRET`, admitir dos claves durante el cambio, para no cerrar todas las sesiones de golpe.
8. **Diagnóstico** (Ajustes › Diagnóstico): muestra qué integraciones están configuradas, nunca los valores.

---

## 5. Fases y orden

| Fase | Trabajo | Controles | Esfuerzo |
|---|---|---|---|
| **0 · En espera** | Publicar Next.js 16.4.5 (ya probado) cuando lo apruebes. | 8.8 | Bajo |
| **1 · Inventario y riesgos** | Inventario y clasificación de datos, registro de riesgos, borrador de la SoA, lista de proveedores. | 5.9, 5.12, 5.19–5.23 | Medio |
| **2 · Identidad y acceso** | Límite de intentos, MFA para privilegiados, revocación de sesiones, política de contraseñas, informe de accesos para revisión periódica, baja de cuentas. | 5.15–5.18, 8.2, 8.3, 8.5 | Alto |
| **3 · Configuración y secretos** | Encapsulamiento de variables (sección 4), falla segura, inventario y rotación. | 8.9, 8.24 | Medio |
| **4 · Seguridad de la aplicación** | Encabezados y CSP, validación pendiente en acciones, HTML sanitizado, archivos subidos, inyección de fórmulas en Excel, límites por minuto en APIs, MCP e inyección de instrucciones a la IA. ASVS nivel 2. | 8.6, 8.7, 8.12, 8.26–8.28 | Alto |
| **5 · Registro, monitoreo e incidentes** | Bitácora de seguridad protegida, alertas, procedimiento de incidentes. | 8.15, 8.16, 5.24–5.28 | Medio |
| **6 · Datos y continuidad** | Retención y borrado, enmascarado (Clarity, logs), respaldo cifrado y prueba de restauración, aviso de privacidad. | 8.10, 8.11, 8.13, 5.29, 5.30, 5.33, 5.34 | Medio |
| **7 · Desarrollo y cambios** | CI (pruebas, tipos, lint, `npm audit`, escaneo de secretos), Dependabot, protección de `main`, entorno de pruebas (rama de Neon + deploy preview), registro de deploys. | 8.4, 8.8, 8.25, 8.29, 8.31–8.33 | Medio |
| **8 · Informe final** | SoA completa, riesgos residuales, evidencias y procedimientos escritos. | 5.36, 5.37 | Bajo |

Cada fase termina con sus pruebas en Vitest, su evidencia en `docs/seguridad/` y un deploy aprobado por ti. Las fases 1,
3 y 7 se pueden hacer casi completas desde aquí. Las fases 2 y 6 necesitan algunas decisiones tuyas.

---

## 6. Qué necesito de ti

- **Ya confirmado:** `AUTH_SECRET` existe en Netlify.
- **Decisiones de la institución:**
  - responsable de seguridad e incidentes;
  - dueño y nivel de confidencialidad de los datos;
  - períodos de retención;
  - tiempo máximo aceptable sin la plataforma.
- **MFA:** ¿obligatorio para dueño y administradores, opcional para el resto?
- **Sesiones:** ¿"cerrar sesión en todos los dispositivos", y que cambiar la contraseña cierre las demás?
- **Configuración que haces tú** (te daré los pasos exactos):
  - marcar variables como *secret* en Netlify;
  - protección de `main` en GitHub;
  - aceptar los DPA de los proveedores.
