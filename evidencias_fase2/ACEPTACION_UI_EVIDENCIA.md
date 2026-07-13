# Evidencia de Sistema y Aceptación (UI) — MasterFerre

Ejecutado el 12-07-2026 sobre la app real levantada en `http://localhost:3000`
(commit `dcef530` + cambios de Fase 2), con navegador controlado. Los datos de
prueba se limpiaron al terminar (`git checkout -- bd/`), por lo que los archivos
`bd/*.txt` originales del equipo quedaron intactos.

Estas pruebas complementan las de Jest (unidad/integración): aquí se valida el
sistema **a través de la interfaz**, como lo haría un cliente/analista funcional.
El proyecto reproducible está en `repo_sqa_masterferre_tmp/selenium/masterferre-aceptacion.side`.

## Resultados por caso

| Caso | Tipo | Resultado observado | Oráculo | Veredicto |
|---|---|---|---|---|
| SA-01 Carga del catálogo | Sistema | `/main` cargó el catálogo desde `/catalogo`; logo e imágenes de producto se renderizaron **sin 404** | Debe cargar | ✅ Conforme (además cierra el Issue original #21 de imágenes 404) |
| SA-02 Registro de usuario | Aceptación | Alta de usuario válido → "Sus datos han sido registrados con éxito!" | Debe registrar | ✅ Conforme |
| SA-03 Registro de producto | Aceptación | Alta de producto válido (ID 4101) → "Producto registrado con éxito!" | Debe registrar | ✅ Conforme |
| SA-04 Buscar producto | Sistema | Búsqueda por ID muestra el producto en la tabla | Debe encontrar | ✅ Conforme |
| SA-05 Agregar al carrito | Aceptación | Botón "Agregar a carrito" → "Producto agregado al carrito" | Debe agregar | ✅ Conforme |
| **SA-06 XSS en nombre** | Seguridad (negativo) | `<script>alert('xss')</script>` como nombre → **HTTP 200 "registrado con éxito"** | Debe **rechazar** entrada peligrosa | ❌ **VULNERABILIDAD**: sin sanitización de entrada |
| **SA-07 Precio negativo** | Seguridad (negativo) | precio `-50` → **HTTP 200 "registrado con éxito"** | Debe **rechazar** | ❌ **VULNERABILIDAD**: manipulación de parámetros (coincide con el oráculo corregido en Jest) |
| **SA-08 Acceso anónimo** | Seguridad (negativo) | `/registrar-productos` y `/buscar-usuario` (Buscar/Modificar/Eliminar usuarios) **cargan sin login** | Debe exigir autenticación/rol | ❌ **VULNERABILIDAD**: sin middleware de sesión/rol (KAN-59, KAN-60) |

## Trazabilidad UI → hallazgo estático

- SA-06 → validación de entrada / Integridad (KAN-57 familia de confidencialidad + validación).
- SA-07 → manipulación de parámetros / Integridad §8.4.2.
- SA-08 → Autenticidad §8.4.3 y Autorización §8.4.2 (KAN-59 / KAN-60).

## Cómo se capturó sin bloquear el navegador

Los formularios usan `window.alert()` para confirmar. Para automatizar sin que el
diálogo bloqueara la sesión, se sustituyó `window.alert` por un registrador en
memoria antes de enviar cada formulario, y se leyó el mensaje capturado. En Selenium
IDE el mismo mensaje se valida con el comando `assertAlert`.

## Capturas

Las capturas de pantalla (catálogo cargado, formulario de producto, gestión de
usuarios accesible anónimamente) se tomaron durante la ejecución y deben adjuntarse
al PACS como Apéndice H. Para la defensa, reejecutar la suite `.side` con Selenium IDE
graba el flujo completo en vivo.
