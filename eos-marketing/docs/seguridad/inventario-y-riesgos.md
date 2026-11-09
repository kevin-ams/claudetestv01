# Inventario, clasificación y riesgos (ISO 27001 5.9, 5.12, 6.1.2)

> Fase 1 de la revisión de seguridad (noviembre 2026). **Dueños y niveles: propuesta a confirmar por la institución.**

## 1. Niveles de clasificación

| Nivel | Significa | Ejemplos |
|---|---|---|
| **Restringido** | Su fuga daña a personas o a la organización; solo quien lo necesita. | Contraseñas (hash), secretos de doble factor, tokens, respaldos completos, variables de entorno. |
| **Confidencial** | Interno del equipo u organización; no sale sin autorización. | Leads y tratos (contactos), presupuestos, calificaciones de personas en la L10, notas del vault, bitácora de seguridad. |
| **Interno** | De trabajo diario; su fuga molesta pero no daña. | Rocks, Issues, To-Dos, Scorecard, agenda, calendario editorial. |
| **Público** | Se puede compartir. | Aviso de privacidad, logo. |

## 2. Inventario de datos

| Dato | Dónde vive | Nivel | Dueño propuesto | Quién accede |
|---|---|---|---|---|
| Cuentas: nombre, correo, foto, rol | `users`, `team_members`, Blobs | Confidencial | Administrador de cada equipo | La persona; administradores de su equipo |
| Contraseñas (bcrypt), secreto TOTP (AES-256-GCM), códigos de recuperación (sha256) | `users` | Restringido | Dueño de la plataforma | Nadie las lee: solo se comparan |
| Tokens MCP (sha256) | `api_tokens` | Restringido | Cada persona | La persona; administradores pueden revocarlos |
| Enlaces de contraseña (sha256) | `password_tokens` | Restringido | Plataforma | Nadie; caducan |
| EOS: V/TO, organigrama, Rocks, Issues, To-Dos, Scorecard, L10 | Tablas EOS | Interno / Confidencial (calificaciones L10) | Líder de cada equipo | Según el rol (módulos) |
| Leads, tratos y presupuesto por carrera | `career_weekly`, tablas AC | Confidencial | Dirección de marketing | Módulos Indicadores, Metas y Dashboard AC |
| Vault (notas, versiones, vectores) | `vault_*` | Confidencial | Administrador Premium | Rol con Conocimiento |
| Consumo del Asistente IA | `ai_usage` | Interno | Dueño de la plataforma | Administradores |
| Bitácora de actividad y de seguridad | `activity_log`, `security_events` | Confidencial | Dueño de la plataforma | Administradores (solo lectura) |
| Respaldos completos | Descarga `.json.gz` | Restringido | Dueño de la plataforma | Solo el dueño de la plataforma |
| Variables de entorno | Netlify | Restringido | Dueño de la plataforma | Equipo de Netlify |
| Grabaciones de uso (contenido oculto) | Microsoft Clarity | Interno | Dueño de la plataforma | Cuenta de Clarity |

## 3. Activos técnicos

Repositorio en GitHub (`kevin-ams/claudetestv01`, carpeta `eos-marketing`), sitio de Netlify `eos-nivel-10`
(dominio `eos.amscreativeint.com`), base Neon (esquema `eos_marketing`), Netlify Blobs (imágenes), funciones
programadas (`ac-weekly-sync`, `ac-sync-background`, `maintenance-weekly`), cuentas en los proveedores de la sección 5.

## 4. Registro de riesgos

Escala 1–3 (probabilidad × impacto). **Residual** = después de los controles de esta revisión.

| # | Riesgo | P×I antes | Controles | Residual |
|---|---|---|---|---|
| R1 | Ejecución remota de código por vulnerabilidad de Next.js | 3×3 | Next 16.4.5; `npm audit` en CI; Dependabot | 1×3 |
| R2 | Fuerza bruta de contraseñas | 3×2 | 5 intentos/15 min por cuenta, 30 por IP; tiempo constante; política de 10+ caracteres; 2FA opcional; alerta al dueño | 1×2 |
| R3 | Sesiones falsificadas por clave débil o ausente | 2×3 | `AUTH_SECRET` obligatoria (falla segura); sin clave por omisión | 1×3 |
| R4 | Un administrador de equipo o de demo descarga o pisa toda la base | 3×3 | Respaldo y restauración solo para el dueño de la plataforma; bitácora y alerta | 1×3 |
| R5 | Una persona de otro equipo u organización ve o cambia datos | 3×3 | Aislamiento por equipo (P0) y organización (P1), 30+ pruebas automáticas | 1×3 |
| R6 | Fuga de secretos (repositorio, navegador, logs) | 2×3 | Configuración encapsulada + regla de lint; revisión del JS del navegador; gitleaks en CI; variables "secret" en Netlify | 1×3 |
| R7 | Archivos maliciosos disfrazados de imagen | 2×2 | Validación por contenido real (bytes); `nosniff` | 1×1 |
| R8 | Fórmulas inyectadas en CSV con datos de leads | 2×2 | Neutralización en la exportación CSV; XLSX con celdas tipadas | 1×1 |
| R9 | Clickjacking y XSS | 2×2 | `X-Frame-Options: DENY`, `frame-ancestors`, HTML sanitizado, CSP (en modo reporte) | 1×2 |
| R10 | Instrucciones maliciosas en notas que manipulan al asistente IA | 2×2 | Herramientas solo de lectura y con permisos del rol; aviso en el prompt; topes de gasto | 1×1 |
| R11 | Gasto descontrolado de IA | 2×2 | Tope por organización, por persona y global | 1×1 |
| R12 | Pérdida de datos | 1×3 | Respaldos (Neon + descarga), prueba de restauración trimestral | 1×2 |
| R13 | Incidente sin detectar | 2×2 | Bitácora inmutable de seguridad, alertas por correo, logs de Netlify, reportes CSP | 1×2 |
| R14 | Proveedor comprometido | 1×3 | Proveedores con SOC 2 / ISO 27001 (sección 5), mínimo de datos compartidos, rotación de claves | 1×3 (aceptado) |
| R15 | Dependencia `uuid` vía `exceljs` (aviso moderado) | 1×1 | No se usa con datos del usuario | 1×1 (aceptado) |

## 5. Proveedores (ISO 27001 5.19–5.23)

| Proveedor | Qué recibe | Certificaciones públicas | Acción de la institución |
|---|---|---|---|
| Netlify | Código, imágenes, variables, logs | SOC 2 Tipo II, ISO 27001 | Aceptar DPA; revisar miembros del equipo |
| Neon | Toda la base de datos | SOC 2 Tipo II, ISO 27001 | DPA; región de los datos |
| Resend | Correos y destinatarios | SOC 2 Tipo II | DPA |
| ActiveCampaign | (Origen) leads y tratos | SOC 2 Tipo II, ISO 27001 | Clave con permisos mínimos |
| ClickUp | (Origen) tareas | SOC 2 Tipo II, ISO 27001 | Token de una cuenta de servicio |
| Anthropic | Preguntas y datos consultados por el asistente | SOC 2 Tipo II, ISO 27001, ISO 42001 | Términos comerciales (no entrena con datos de la API) |
| Microsoft Clarity | Uso de la app, contenido enmascarado | ISO 27001 (Microsoft) | Modo de enmascarado estricto |
| GitHub | Código fuente | SOC 2, ISO 27001 | 2FA de colaboradores; protección de `main` |

Las certificaciones se deben confirmar en el portal de confianza de cada proveedor al aceptar su DPA.
