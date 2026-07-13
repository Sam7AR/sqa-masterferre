# Comparación de ciclos y métricas — Fase 2 (Seguridad)

Generado a partir de `ciclo-1-base.json` y `ciclo-2-regresion.json` (Jest, mismo commit y datos).

## Resumen por ciclo

| Ciclo | Total | Conformes | No conformes | Tasa conformidad |
|---|---:|---:|---:|---:|
| Ciclo 1 - base | 30 | 5 | 25 | 16.67% |
| Ciclo 2 - regresión | 30 | 6 | 24 | 20.0% |

## Estabilidad de regresión (M-PR01)

- Casos comparables: 30
- Mismo estado en ambos ciclos: 29
- **Estabilidad = 96.67%** (umbral >=95%: CUMPLE)

### Diferencias entre ciclos
| Suite | Caso | Ciclo 1 | Ciclo 2 | Explicación |
|---|---|---|---|---|
| ISO 25010 — §8.4.2 Integridad: Concurrencia sin exclusión mutua | Modificación y registro concurrentes no deben perder datos | failed | passed | No determinista por ausencia de exclusión mutua (KAN-58): la carrera entre writeFile y appendFile a veces pierde datos y a veces no. La variación ES el hallazgo. |

## No conformidad por subcaracterística (ciclo 1, M-P03)

| Subcaracterística / grupo | Conformes | No conformes | % no conformidad |
|---|---:|---:|---:|
| ISO 25010 — §8.4.1 Confidencialidad | 0 | 2 | 100.0% |
| ISO 25010 — §8.4.1 Confidencialidad: Error real de persistencia | 1 | 1 | 50.0% |
| ISO 25010 — §8.4.2 Integridad: Concurrencia sin exclusión mutua | 1 | 2 | 66.7% |
| ISO 25010 — §8.4.2 Integridad: Inyección JSON | 0 | 5 | 100.0% |
| ISO 25010 — §8.4.3 Autenticidad: Bypass de autenticación | 0 | 5 | 100.0% |
| ISO 25010 — §8.4.3 Autorización por propiedad del recurso | 0 | 2 | 100.0% |
| ISO 25010 — §8.4.4 No Repudio: Ausencia de auditoría | 0 | 3 | 100.0% |
| Seguridad complementaria — Filtrado de información | 2 | 0 | 0.0% |
| Seguridad complementaria — Manipulación de parámetros | 0 | 1 | 100.0% |
| Seguridad complementaria — Validación de entrada | 1 | 4 | 80.0% |

## npm audit (dependencias)

- low: 3, moderate: 2, high: 4, critical: 0, total: 9
- No confundir vulnerabilidad de dependencia con caso funcional de seguridad; se reporta como riesgo aparte.
