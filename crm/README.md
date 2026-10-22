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

## Inicio de sesión con Google

1. En Google Cloud Console, crea un proyecto y configura la pantalla de consentimiento como **Interna**.
2. Crea un ID de cliente OAuth (aplicación web) con la URI de redirección `http://localhost:3000/api/auth/google/callback`.
3. Copia `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `.env.local`.

Solo entran cuentas verificadas de `ALLOWED_DOMAIN` (por defecto `amscreativeint.com`). La primera persona en entrar queda como administradora.

## Estado

- [x] Fase 0: marca, login con Google, layout, esquema núcleo, dashboard y etapas del pipeline configurables
- [ ] Fase 1: contactos, empresas, negocios (Kanban), tareas, importación
