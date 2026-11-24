# Fronteras y dependencias

Este documento evita el problema más caro de un equipo trabajando en paralelo: que dos
personas toquen lo mismo, o que alguien se meta a "arreglar" el módulo de otro y rompa un
supuesto que no conocía.

---

## La regla

> **Un módulo solo puede estar bloqueado por el contrato de datos, nunca por el código de
> otra persona.**

De ahí se derivan dos prohibiciones concretas:

1. **Ningún módulo importa código de otro módulo.** Se comunican por el contrato: un
   archivo JSON, una llamada HTTP o un CSV. Si M5 necesita evaluar una lectura, llama a la
   interfaz de M2; no copia su lógica ni importa su módulo interno.
2. **Nadie edita archivos que pertenecen a otro módulo.** Si necesitas un cambio ahí, se
   pide. La tabla de abajo dice de quién es cada cosa.

---

## Propiedad de archivos por módulo

| Módulo | Es dueño de | No toca |
|---|---|---|
| **M0** Datos y contrato | `scripts/`, `datos/`, `contrato/esquemas/`, `contrato/fixtures/`, `docs/` | el código de los módulos |
| **M1** Topología | lo que escriba en `datos/procesados/` sobre tramos y orden de sitios | el resto de `datos/procesados/` |
| **M2** Motor de reglas | su librería y sus pruebas | los esquemas, los fixtures |
| **M3** Propagación | su módulo de propagación | la salida de M1, que consume sin modificar |
| **M4** Dispositivo | firmware, circuito, ficha técnica | el contrato |
| **M5** Backend | API, base de datos, migraciones | `contrato/servidor_mock.py`, que es de M0 |
| **M6** Mapa público | su frontend | la API, que consume |
| **M7** Panel de autoridad | su frontend | la API, que consume |
| **M8** App ciudadana | su app | la API, que consume |
| **M9** Integración | guion de demo, evidencia, pruebas de extremo a extremo | el código de los demás; reporta, no arregla |
| **M10** Documentación | `docs/01` a `06`, `10`, `11` | `08` y `09`, que son generados |

**Caso especial.** Los esquemas del contrato son de M0, pero cualquiera puede **proponer**
un cambio. Lo que no puede es hacerlo en silencio: ver
[`05-protocolo-de-cambios.md`](05-protocolo-de-cambios.md).

---

## Dirección de las dependencias

```
M0 (hecho) ──► M1 ──► M3 ──┐
   │            │          │
   │            └──────────┼──► M5 ──┬──► M6
   ├──► M2 ────────────────┘         ├──► M7
   ├──► M4 ──────────────────────────┘    └──► M8
   │                                            │
   └────────────────────────────────────────────┴──► M9
M10 en paralelo desde el primer día
```

**Las flechas son dependencias de contrato, no de código.** M6 depende del esquema que M5
sirve, no de que M5 exista. Hasta que exista, M6 lee del servidor mock.

**No hay ciclos y no debe haberlos.** Si descubres que necesitas que un módulo de abajo te
dé algo, es señal de que el corte está mal y hay que hablarlo, no resolverlo con un
`import`.

---

## Qué usar mientras el módulo vecino no existe

| Necesitas | Mientras no exista, usa |
|---|---|
| Lecturas de un dispositivo | `python contrato/reproducir_escenario.py <escenario>` |
| Un backend al que mandarle lecturas | `python contrato/servidor_mock.py` |
| Veredictos y alertas | el evaluador stub del mock (marcado `"motor": "stub"`) |
| Los sitios para pintar en un mapa | `contrato/fixtures/sitios.geojson` |
| La línea base de una estación | `contrato/fixtures/linea_base.json` |
| El orden aguas abajo de los sitios | un CSV de 5 filas hecho a mano con las estaciones del piloto |
| Una predicción de propagación | una tabla de llegadas precalculada para el escenario de la demo |

---

## Fronteras que se cruzan con frecuencia por error

**El motor de reglas y el backend.** Es tentador que el backend "mejore" un poco la
evaluación, porque ya tiene el dato ahí. No. El veredicto lo produce M2 y el backend lo
persiste y lo publica. Si la lógica se parte en dos, nadie puede medir el criterio de
terminado de M2.

**La propagación y el motor de reglas.** M3 consume una alerta ya emitida. No decide si
hay alerta.

**El frontend y las reglas de negocio.** Un frontend no decide el color de un sitio
calculándolo por su cuenta: lo recibe en el veredicto. Si lo calcula, habrá dos
definiciones del semáforo y se van a desincronizar.

**La topología y todo lo demás.** M1 produce un dato (el orden de los sitios y las
distancias sobre el cauce) y ahí termina su responsabilidad. No evalúa, no alerta.

---

## Qué pasa si un módulo no termina

Cada módulo tiene declarado de antemano qué muestra la demo sin él. Está en
[`../11-metodologia-modulos.md`](../11-metodologia-modulos.md), sección "Plan de
degradación".

La propiedad que hay que preservar en cada cambio: **la demo sobrevive la ausencia de
cualquier módulo individual.** Si un cambio tuyo hace que la demo deje de correr sin otro
módulo, rompiste la propiedad y hay que revertirlo o compensarlo.

Caso típico: si el mapa deja de funcionar contra el servidor mock porque empezó a depender
de un endpoint que solo existe en el backend real, el mapa ya no es independiente. La
solución es agregar ese endpoint al mock, no quitar la dependencia del frontend.
