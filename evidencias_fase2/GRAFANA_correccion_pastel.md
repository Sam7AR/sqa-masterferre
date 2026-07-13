# Corrección de la gráfica de pastel de Grafana ("Porcentaje de pruebas pasadas y fallidas")

Dashboard: **Porcentaje de Salud** (`/d/savlm22/porcentaje-de-salud`), panel 7 (piechart).

## El problema (verificado el 12-07-2026)

El pastel mostraba **20 failed + 4 passed = 24**, pero la suite tenía **23 casos**.
Un caso se contaba dos veces.

### Causa raíz

En la telemetría, `estado` (passed/failed) se envía como **tag** de `detalle_pruebas`.
En InfluxDB, cada combinación distinta de tags es una **serie** independiente. Cuando una
prueba cambia de resultado entre ejecuciones —exactamente el caso "precio negativo", que
fue `failed` en los runs viejos y `passed` en el run 11 tras el workaround del oráculo—
se generan **dos series** para la misma prueba:

- `prueba="...precios negativos", estado="failed"`  (runs 1..10)
- `prueba="...precios negativos", estado="passed"`  (run 11)

La consulta original agrupaba por `estado` y aplicaba `last()`, que conserva el último
punto de **cada serie**. Como ambas series existen en la ventana temporal, la prueba
aparece una vez como failed y otra como passed → **doble conteo (24)**.

```flux
// CONSULTA ORIGINAL (doble conteo)
from(bucket: "telemetria_sqa")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "detalle_pruebas")
  |> filter(fn: (r) => r["_field"] == "valor_estado")
  |> last()
  |> group(columns: ["estado"])
  |> count()
  |> group()
  |> rename(columns: {_value: "cantidad"})
  |> keep(columns: ["estado", "cantidad"])
```

## La corrección

Deduplicar por **identidad de la prueba**, no por estado. Se agrupa por `prueba`, se toma
el `last()` real de cada prueba (su estado más reciente, sin importar el tag) y recién
entonces se deriva passed/failed del campo numérico `valor_estado` (1 = passed, 0 = failed):

```flux
// CONSULTA CORREGIDA (una prueba = un conteo)
from(bucket: "telemetria_sqa")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "detalle_pruebas")
  |> filter(fn: (r) => r["_field"] == "valor_estado")
  |> group(columns: ["prueba"])          // una serie por prueba, fusiona failed+passed
  |> last()                              // estado más reciente REAL de cada prueba
  |> group()
  |> map(fn: (r) => ({ r with estado_real: if r._value == 1 then "passed" else "failed" }))
  |> group(columns: ["estado_real"])
  |> count()
  |> group()
  |> rename(columns: {_value: "cantidad"})
  |> keep(columns: ["estado_real", "cantidad"])
```

Resultado esperado con esta consulta: **passed + failed = 23** (sin doble conteo).

### Alternativa aún más robusta (recomendada a futuro)

Ahora que `scripts/enviar-metricas.js` envía los tags `run_id` y `cycle_id`, lo ideal es
que cada panel filtre a **un run/ciclo concreto** en vez de a toda la ventana temporal.
Así nunca se mezclan ejecuciones:

```flux
// Fijar el análisis a un ciclo (p. ej. el ciclo de regresión)
  |> filter(fn: (r) => r["cycle_id"] == "ciclo-2-regresion")
```

O, para "la última corrida", quedarse con el `run_id` de mayor `run_number`.

## Nota de responsabilidad

**No se modificó el dashboard en vivo**: es un recurso compartido y público de Samuel.
Esta corrección se entrega como consulta lista para pegar en el editor del panel 7
(Edit → pestaña Query). Es un cambio puntual y reversible; conviene aplicarlo junto con
él para no pisar su trabajo. Los demás paneles ("...en esta corrida") usan `last()` sobre
`auditoria_seguridad`, que es una sola serie, por lo que no sufren el doble conteo; aun así
se beneficiarían de filtrar por `run_id`/`cycle_id` una vez que fluya la nueva telemetría.
