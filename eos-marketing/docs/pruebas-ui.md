# Pruebas de interfaz y velocidad

## Prueba de humo (`scripts/ui-smoke.mjs`)

Recorre todas las secciones del menú en modo claro y oscuro y revisa que carguen
sin errores. También prueba el menú colapsable, el cambio de tema y el menú en
celular, y mide la velocidad de carga (TTFB, FCP, LCP y CLS).

```bash
npm run build && npm start            # en otra terminal
npm i -D playwright && npx playwright install chromium   # solo la primera vez
EOS_URL=http://localhost:3000 EOS_EMAIL=... EOS_PASSWORD=... node scripts/ui-smoke.mjs
```

Termina con código 1 si alguna página falla o supera estos umbrales:
TTFB 800 ms, FCP 1.8 s, LCP 2.5 s y CLS 0.1.

## Resultados del rediseño con vidrio (9 nov 2026, build local con PGlite y datos demo)

- `npm test`: 57/57 pruebas. `eslint` y `tsc` sin errores.
- Prueba de humo: 19 secciones × 2 modos sin errores. Menú colapsable (240 ↔ 56 px), cambio de tema y menú en celular funcionan.
- **Velocidad (A/B alternado contra la versión anterior):**
  - TTFB y carga completa iguales (≈40 ms y ≈80 ms).
  - FCP con `loading.tsx` incluido: ≈125 ms contra ≈90 ms antes.
    - Quitar el desenfoque, las sombras o la luz de fondo no cambia el resultado.
    - En ese momento el esqueleto `(app)/loading.tsx` era la principal sospecha, por eso no se incluyó.
    - Este paquete sin `loading.tsx` todavía no se ha medido.

## Pendientes

1. Repetir el A/B sin `loading.tsx` para confirmar que el FCP vuelve a ≈90 ms y no hay otra causa. Si se quiere esqueleto de carga, medirlo aparte.
2. Correr la prueba de humo contra el sitio de Netlify después del deploy (con una cuenta de prueba).
3. En celular, con 2 o más equipos (p. ej. con la demo), el selector de equipo empuja el botón "Salir" fuera de la barra. Esto ya pasaba antes del rediseño.
