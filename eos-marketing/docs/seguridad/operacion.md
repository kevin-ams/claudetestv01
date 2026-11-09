# Operación: registro, incidentes, datos, continuidad y cambios (ISO 27001 5.24–5.30, 8.10, 8.13, 8.15–8.16, 8.25, 8.31–8.33)

## Registro y monitoreo (8.15, 8.16)

- **Bitácora de seguridad** (`security_events`, Ajustes › Seguridad): inicios de sesión y fallos, bloqueos, doble
  factor, contraseñas, roles y accesos, tokens, respaldos, exportaciones y topes de IA, con IP. Solo agregar: un
  disparador de la base impide modificarla y borrar eventos de menos de un año. No viaja en los respaldos.
- **Bitácora de actividad** (Ajustes › Log): cambios de negocio.
- **Alertas por correo al dueño de la plataforma** (máximo una por tipo y persona cada hora): cuenta bloqueada por
  intentos, doble factor quitado por un administrador, respaldo restaurado.
- **Logs de Netlify:** errores, `[csp]` (reportes de la CSP), `[mantenimiento]`, `[ac-sync]`, `[asistente]`.
- **Revisión:** mensual de la bitácora de seguridad; trimestral de accesos (Ajustes › Seguridad › Revisión de accesos).

## Gestión de incidentes (5.24–5.28)

**Responsable propuesto:** el dueño de la plataforma (a confirmar por la institución).

1. **Detectar:** alerta, bitácora, reporte de una persona o del proveedor.
2. **Contener (en minutos):**
   - Cuenta comprometida → Ajustes › Equipo: quitar a la persona o cambiar su acceso; Ajustes › Seguridad: quitar su
     doble factor si hace falta; revocar sus tokens MCP (Conocimiento › Conectar con Claude).
   - Token o clave filtrada → revocarla en el proveedor, reemplazarla en Netlify y publicar (ver `configuracion.md`).
   - Sesiones robadas o `AUTH_SECRET` filtrada → rotar `AUTH_SECRET` (cierra todas las sesiones).
   - Datos dañados → restaurar desde Neon (punto en el tiempo) o desde el último respaldo descargado.
3. **Evidencia:** exportar la bitácora de seguridad y los logs de Netlify del periodo antes de cambiar nada más.
4. **Notificar:** a la dirección de la institución y, si hay datos personales afectados, a las personas involucradas.
5. **Aprender:** registrar causa, impacto y corrección en este documento (sección Historial).

## Retención y borrado (8.10, 5.33)

Automático cada domingo (función `maintenance-weekly` → `/api/cron/mantenimiento`):

| Dato | Se conserva |
|---|---|
| Intentos de inicio de sesión | 30 días |
| Caché del asistente IA | 1 día |
| Bitácora de seguridad | 1 año |
| Enlaces de contraseña | 30 días |
| Tokens MCP revocados | 180 días |
| Datos de EOS, vault, actividad, consumo de IA | Mientras la organización use la plataforma (propuesta a confirmar) |

Borrado de una persona a petición: quitarla de todos sus equipos; el dueño de la plataforma borra la cuenta.

## Respaldo y continuidad (8.13, 5.29, 5.30)

- **Neon:** restauración a un punto en el tiempo (según el plan contratado).
- **Respaldo descargable** (Ajustes › Diagnóstico): solo el dueño de la plataforma; incluye a todas las organizaciones
  y las contraseñas cifradas; guardarlo cifrado (p. ej. en una carpeta con acceso restringido). Frecuencia sugerida:
  semanal (Diagnóstico avisa si pasaron más de 7 días).
- **Prueba de restauración trimestral:** restaurar el último respaldo en local (`npm run dev` + Diagnóstico ›
  Restaurar) y verificar que se puede entrar y ver los datos. Registrar la fecha aquí.
- **Si cae Netlify o Neon:** la plataforma no está disponible; la L10 puede seguir con el último PDF de resumen.
  Tiempo máximo aceptable sin la plataforma: a definir por la institución.

## Desarrollo y cambios (8.25, 8.29, 8.31–8.33, 8.4)

- **CI** (`.github/workflows/eos-marketing-ci.yml`): tipos, lint (incluida la regla de variables), pruebas (aislamiento,
  seguridad, asistente), `npm audit --audit-level=high`, build + revisión de secretos en el navegador, y gitleaks.
- **Dependabot** (`.github/dependabot.yml`): PRs semanales de dependencias y de seguridad.
- **Protección de `main`** (lo configura el dueño del repositorio en GitHub › Settings › Branches): PR obligatorio,
  CI en verde, sin force-push. Publicar siempre desde `main`.
- **Entorno de pruebas** (recomendado): una rama de Neon y deploy previews de Netlify para probar con datos de prueba.
  Nunca copiar datos reales a local ni a la demo.
- **Registro de deploys:** cada deploy queda en Netlify (Deploys) con su commit; los de seguridad se anotan abajo.

## Historial

| Fecha | Tipo | Detalle |
|---|---|---|
| 2026-11-09 | Cambio | Revisión de seguridad ISO 27001 (fases 0–8): Next.js 16.4.5, configuración encapsulada, límite de intentos, doble factor opcional, bitácora de seguridad, respaldos solo para el dueño, encabezados, retención, CI. |
