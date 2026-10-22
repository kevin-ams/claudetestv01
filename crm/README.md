# Ams CRM

CRM interno de Ams Studio. Plan completo: [`../docs/CRM_PLAN.md`](../docs/CRM_PLAN.md).

> Vive temporalmente en la carpeta `crm/` de este repositorio. Se moverá a su propio repositorio `ams-crm` y **aún no se publica en Netlify**.

## Correr en local

```bash
cd crm
npm install
cp .env.example .env.local   # completa AUTH_SECRET; Google es opcional al inicio

# Base de datos local (Postgres)
createdb ams_crm
psql -d ams_crm -f netlify/database/migrations/001_core/migration.sql

npm run dev
```

Sin credenciales de Google, con `DEV_LOGIN=true` aparece el botón **Entrar en modo desarrollo** (solo con `npm run dev`).

## Acceso

- **Google**: el equipo de `ALLOWED_DOMAIN` (por defecto `amscreativeint.com`).
- **Correo y contraseña**: para personas externas o como respaldo. Un administrador los crea en *Configuración → Usuarios y acceso*; cada quien cambia su contraseña en *Mi perfil*.
- **Primer arranque**: si la base está vacía, el login muestra *Crear la primera cuenta de administrador* (`/setup`).
- Un administrador puede desactivar usuarios; el acceso se corta en la siguiente acción aunque tengan sesión abierta.

## Inicio de sesión con Google

1. En Google Cloud Console, crea un proyecto y configura la pantalla de consentimiento como **Interna**.
2. Crea un ID de cliente OAuth (aplicación web) con la URI de redirección `http://localhost:3000/api/auth/google/callback`.
3. En Windows, desde la carpeta `crm`, ejecuta el asistente; pide el ID y el secreto (oculto) y los guarda en `.env.local`, que nunca se sube a Git:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\configurar-entorno.ps1
   ```

Solo entran cuentas verificadas de `ALLOWED_DOMAIN` (por defecto `amscreativeint.com`). La primera persona en entrar queda como administradora.

## Estado

- [x] Fase 0: marca, login con Google, layout, esquema núcleo, dashboard y etapas del pipeline configurables
- [x] Acceso alterno con correo y contraseña, gestión de usuarios y Mi perfil
- [x] Propuesta de plantilla de cotización (`templates/cotizacion/`)
- [ ] Fase 1: contactos, empresas, negocios (Kanban), tareas, importación
