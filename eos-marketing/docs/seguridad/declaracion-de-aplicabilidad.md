# Declaración de aplicabilidad (SoA) de la plataforma — ISO/IEC 27001:2022, Anexo A

Alcance: la plataforma EOS Nivel 10 (`eos-marketing`). Estado al 9 de noviembre de 2026.
**Cumple** = implementado con evidencia · **Parcial** = implementado en parte o depende de una decisión ·
**Institución** = control organizacional que la plataforma apoya pero decide la institución · **N/A** = no aplica a la plataforma.

## Tecnológicos (8.x)

| Control | Estado | Cómo se cumple | Evidencia |
|---|---|---|---|
| 8.1 Dispositivos de usuario | Institución | Política de equipos de la institución | — |
| 8.2 Accesos privilegiados | Cumple | Dueño / Premium / admin separados; respaldos y topes solo del dueño; bitácora | `aplicacion.md`, Ajustes › Seguridad |
| 8.3 Restricción de acceso | Cumple | Roles por módulo; aislamiento por equipo y organización | `tests/eos-isolation.test.ts`, `tests/vault-isolation.test.ts` |
| 8.4 Acceso al código fuente | Parcial | gitleaks en CI; falta protección de `main` (GitHub) | `operacion.md` |
| 8.5 Autenticación segura | Cumple | Política de contraseñas, límite de intentos, tiempo constante, 2FA opcional | `tests/security.test.ts` |
| 8.6 Capacidad | Cumple | Límites por minuto (MCP), topes de IA, tamaño de archivos | `tests/assistant.test.ts` |
| 8.7 Malware | Cumple | Validación de imágenes por contenido; `nosniff` | `tests/security.test.ts` |
| 8.8 Vulnerabilidades técnicas | Cumple | Next 16.4.5; `npm audit` en CI; Dependabot; riesgo aceptado `uuid` | CI, `inventario-y-riesgos.md` R15 |
| 8.9 Configuración | Cumple | Configuración encapsulada y validada; lint; falla segura; inventario | `configuracion.md`, `.env.example` |
| 8.10 Eliminación de información | Cumple | Retención automática semanal | `src/lib/security/retention.ts` |
| 8.11 Enmascaramiento | Cumple | Clarity con contenido oculto; logs sin secretos | `aplicacion.md` |
| 8.12 Prevención de fugas | Cumple | Respaldos solo del dueño; exportaciones en bitácora; JS del navegador revisado | `scripts/check-client-secrets.mjs` |
| 8.13 Respaldos | Parcial | Neon + respaldo descargable; falta la primera prueba de restauración documentada | `operacion.md` |
| 8.14 Redundancia | N/A (proveedor) | Netlify y Neon | — |
| 8.15 Registro | Cumple | Bitácora de seguridad inmutable 1 año | `tests/security.test.ts` |
| 8.16 Monitoreo | Cumple | Alertas por correo; logs; reportes CSP | `src/lib/security/events.ts` |
| 8.17 Sincronización de relojes | N/A (proveedor) | Servidores de Netlify/Neon | — |
| 8.18 Utilidades privilegiadas | N/A | Sin acceso a servidores | — |
| 8.19 Instalación de software | N/A | Plataforma administrada | — |
| 8.20–8.22 Redes | Cumple (proveedor) | Solo HTTPS; base sin acceso público directo desde la app | — |
| 8.23 Filtrado web | Institución | — | — |
| 8.24 Criptografía | Cumple | TLS + HSTS; bcrypt; sha256 de tokens; AES-256-GCM del 2FA; rotación documentada | `configuracion.md` |
| 8.25 Ciclo de desarrollo seguro | Cumple | CI con pruebas de seguridad | `.github/workflows/eos-marketing-ci.yml` |
| 8.26 Requisitos de seguridad | Cumple | OWASP ASVS nivel 2 como referencia; encabezados | `aplicacion.md` |
| 8.27 Arquitectura segura | Cumple | Revisión de arquitectura P0–P2 | `docs/revision-arquitectura.md` |
| 8.28 Codificación segura | Cumple | SQL parametrizado, zod, HTML sanitizado, CSV neutralizado | `aplicacion.md` |
| 8.29 Pruebas de seguridad | Cumple | 68+ pruebas automáticas | `tests/` |
| 8.30 Desarrollo tercerizado | N/A | — | — |
| 8.31 Separación de entornos | Parcial | Local (PGlite) y producción; entorno de pruebas recomendado | `operacion.md` |
| 8.32 Gestión de cambios | Parcial | CI + historial; falta publicar solo desde `main` con PR | `operacion.md` |
| 8.33 Información de prueba | Cumple | Datos de demo generados; nunca datos reales | — |
| 8.34 Pruebas de auditoría | Institución | — | — |

## Organizacionales (5.x) relevantes

| Control | Estado | Apoyo de la plataforma |
|---|---|---|
| 5.9 / 5.12 Inventario y clasificación | Parcial | `inventario-y-riesgos.md` (dueños y niveles por confirmar) |
| 5.14 Transferencia de información | Cumple | Correos y exportaciones con bitácora; MCP con token |
| 5.15–5.18 Control de acceso e identidades | Cumple | Roles, alta y baja, revisión de accesos con último ingreso |
| 5.19–5.23 Proveedores y nube | Institución | Lista de proveedores y qué reciben (`inventario-y-riesgos.md` §5) |
| 5.24–5.28 Incidentes | Parcial | Procedimiento técnico (`operacion.md`); falta designar responsable |
| 5.29 / 5.30 Continuidad | Parcial | Respaldos; falta definir el tiempo máximo sin servicio |
| 5.33 / 5.34 Registros y privacidad | Cumple | Retención automática; aviso de privacidad público (`/privacidad`) |
| 5.36 / 5.37 Cumplimiento y procedimientos | Cumple | Esta declaración y los procedimientos escritos |

## Personas (6.x) y físicos (7.x)

Institución y proveedores de nube. La plataforma apoya 6.5 (baja de accesos al salir una persona).
