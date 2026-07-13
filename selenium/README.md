# Pruebas de Sistema y Aceptación (Selenium IDE) — MasterFerre

Proyecto de pruebas funcionales/UI para la característica **Seguridad (ISO/IEC 25010)**,
complementario a las pruebas unitarias/integración de `__tests__/`.

## Qué es esto

`masterferre-aceptacion.side` es un proyecto de **Selenium IDE** (formato `.side`, JSON).
Selenium IDE graba y reproduce interacciones reales de un usuario en el navegador
(abrir páginas, escribir en formularios, hacer clic, verificar textos/alertas). Aquí el
Tester actúa como **cliente/analista funcional** y valida el sistema de punta a punta a
través de la interfaz, no solo por API.

## Casos incluidos (suite "Aceptacion completa")

| Caso | Tipo | Qué valida |
|---|---|---|
| SA-01 | Sistema | El catálogo (`/main`) carga desde `/catalogo` y el logo no da 404 (Issue original #21). |
| SA-02 | Aceptación | Alta de un usuario válido de extremo a extremo. |
| SA-03 | Aceptación | Alta de un producto válido. |
| SA-04 | Sistema | Búsqueda de producto por ID y render en tabla. |
| SA-05 | Aceptación | Agregar un producto al carrito desde el catálogo. |
| SA-06 | Seguridad (negativo) | El sistema **acepta** `<script>` en el nombre → hallazgo de validación de entrada. |
| SA-07 | Seguridad (negativo) | El sistema **acepta** precio negativo → hallazgo de manipulación de parámetros. |
| SA-08 | Seguridad (negativo) | Rutas administrativas accesibles **sin autenticación** (KAN-59/KAN-60). |

> Los casos SA-06/07/08 son *vulnerabilidades esperadas*: el oráculo de seguridad pedía
> rechazo/bloqueo, pero el producto responde "éxito"/permite el acceso. Esa confirmación por
> alerta ES el hallazgo, coherente con que T8 audita sin corregir el producto.

## Cómo ejecutarlo

### Opción A — Selenium IDE (interfaz gráfica, recomendada para la defensa)
1. Instalar la extensión **Selenium IDE** en Chrome/Firefox.
2. Levantar la app: `npm ci && npm start` (queda en `http://localhost:3000`).
3. Abrir Selenium IDE → *Open project* → `selenium/masterferre-aceptacion.side`.
4. Ejecutar la suite "Aceptacion completa". Las capturas quedan en la carpeta de descargas.

### Opción B — Línea de comandos (para CI / evidencia reproducible)
```bash
npm ci
npm start &                         # app en localhost:3000
npx selenium-side-runner selenium/masterferre-aceptacion.side
```
Requiere `selenium-side-runner` y un `chromedriver` compatible con el Chrome instalado.
Para CI headless: `npx selenium-side-runner -c "goog:chromeOptions.args=[--headless=new,--no-sandbox]" selenium/masterferre-aceptacion.side`.

## Nota sobre alertas

Los formularios de MasterFerre usan `alert()` para confirmar. Selenium IDE las maneja con
`assertAlert`. Si automatizas la UI con otras herramientas, neutraliza `window.alert`
antes de interactuar para no bloquear el navegador.
