# Campaña de llamadas

Dashboard de la campaña de llamadas en frío a leads de carreras universitarias: grado de
interés, efectividad por asesor y por carrera, con recomendaciones automáticas.

Es una app independiente (Next.js 16 + Tailwind v4) desplegada en su propio proyecto de
Netlify. Vive en esta carpeta del repositorio; no depende de la app EOS de la raíz.

## Uso

1. Entra con tu nombre y la contraseña del equipo.
2. En Google Sheets: **Archivo → Descargar → Microsoft Excel (.xlsx)**.
3. Pulsa **Subir archivo actualizado** y elige ese archivo. Cada carga reemplaza a la anterior.

Pestañas:

- **General**: indicadores, recomendaciones, llamadas por día, nivel de interés, seguimiento
  prioritario (con enlace a WhatsApp) y detalle de llamadas.
- **Asesores**: meta diaria de **15 llamadas efectivas por asesor** (último día, promedio,
  días con meta cumplida, acumulado del período y llamadas diarias necesarias según su tasa
  de contacto), tabla de efectivas por día vs meta, resultado y productividad por asesor.
- **Carreras y contacto**: cobertura, contacto e interés por carrera, temas en
  observaciones, tasa de contacto por hora, por antigüedad del lead y si ya lo habían llamado.

Los filtros (fecha, asesor, facultad, nivel, carrera, resultado, interés, "¿ya lo
llamaron?", búsqueda) aplican a las tres pestañas. **Exportar PDF** genera un reporte con
las tres pestañas y los filtros aplicados; **Exportar CSV** baja el detalle de llamadas.

La meta se cambia en `DAILY_EFFECTIVE_GOAL` (`src/lib/calls/analytics.ts`).

## Formato del archivo

Se leen todas las pestañas cuyo encabezado (fila 1) tenga `CARRERA` y `ESTADO LLAMADA`
(p. ej. `contactos FISICC PREGRADO`); la facultad y el nivel salen del nombre de la pestaña.
Las columnas se ubican por nombre. Filas sin `ESTADO LLAMADA` cuentan como pendientes de
llamar. Para medir la meta y la productividad, cada llamada debe tener **Día** (dd/mm/aaaa)
y **hora** (hh:mm).

## Variables de entorno (Netlify)

| Variable | Descripción |
| --- | --- |
| `DASHBOARD_PASSWORD` | Contraseña compartida para entrar. |
| `AUTH_SECRET` | Secreto para firmar la cookie de sesión (cadena aleatoria larga). |

El último archivo subido se guarda en Netlify Blobs (store `campana-llamadas`).

## Desarrollo

```bash
cd campana-llamadas
npm install
DASHBOARD_PASSWORD=prueba npm run dev
```

Fuera de Netlify, el archivo subido se guarda en `.data/latest.json` (ignorado por git).

## Código

- `src/lib/calls/xlsx.ts`: lectura del Excel.
- `src/lib/calls/parse.ts`: normalización de la hoja (fechas, horas, estados, interés).
- `src/lib/calls/analytics.ts`: filtros, métricas, meta diaria y recomendaciones.
- `src/lib/calls/storage.ts`: guardar y leer el último archivo (Netlify Blobs).
- `src/components/dashboard/*`: UI del dashboard.
- `src/lib/auth/*`, `src/proxy.ts`: acceso con contraseña.
