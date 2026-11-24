# Estado actual y traspaso

**Corte: 2026-11-24.** Para quien se incorpora o toma un módulo nuevo: qué hay, qué falta, qué
puede empezarse hoy sin esperar a nadie y por dónde entrar. Los criterios de terminado completos
están en [11-metodologia-modulos.md](11-metodologia-modulos.md); las reglas del repositorio, en
[`contexto/00-LEEME-PRIMERO.md`](contexto/00-LEEME-PRIMERO.md).

## En una frase

Hay **datos** (M0), un **dispositivo simulado** (M4), un **mapa** (M6) y la **topología del río**
(M1): ya se sabe qué sitio está aguas abajo de cuál y a qué distancia. Falta decidir si una lectura
es alarma (M2) y estimar hasta dónde llega la contaminación (M3), que ya tiene su entrada lista.

## Lo que se hizo, en el orden en que se hizo

1. **Recolección de datos de la cuenca del Alto Atoyac** (M0): 219 sitios, 145 703 resultados de
   2012 a 2025, línea base por sitio y parámetro, contrato de datos v1.0 con 7 esquemas, fixtures con
   5 estaciones y 5 escenarios de un día, y un servidor mock.
2. **Diseño del dispositivo a partir de esos datos** (M4): una estación centinela con cuatro bloques
   (sondas, controlador, comunicación, energía), con rangos elegidos contra lo que el río registra.
   No hay hardware: se presenta con un simulador web que corre la lógica del firmware.
3. **Representación de la cuenca y del mecanismo** (M6): mapa con la red hidrográfica del INEGI, las
   subcuencas, los 219 sitios oficiales y las 5 estaciones; al elegir una estación se abre su
   simulador.

## Estado por módulo

| Módulo | Estado | Dónde |
|---|---|---|
| M0 Datos y contrato | **Construido** | `datos/`, `contrato/`, `scripts/` |
| M1 Topología | **Construida.** 210 de 219 sitios con sucesor; 14 marcados para revisión | `datos/procesados/red/`, `docs/13-topologia-red.md` |
| M2 Motor de reglas | **Pendiente.** Sin dependencias pendientes | librería propia |
| M3 Propagación | **Construida.** Modelo calibrado con 90 tramos del propio río, cobertura 78 % fuera de muestra | `scripts/80_propagacion.py`, `docs/14-propagacion.md` |
| M4 Dispositivo | **Simulador construido y probado; sin hardware** | `dispositivo/` |
| M5 Backend | Pendiente. Puede empezarse contra el contrato | — |
| M6 Mapa | **Prototipo** (aún no colorea por índice ni está probado a ancho de teléfono) | `mapa/` |
| M7 Panel de autoridad | Pendiente | — |
| M8 App ciudadana | Pendiente | — |
| M9 Integración | Pendiente | — |
| M10 Documentación y costos | En curso; faltan costos, manual por usuario y propuesta por fases | `docs/` |

## Qué se puede tomar hoy sin esperar a nadie

### M2, motor de reglas (recomendado para quien entra)

- **Qué es.** Una función `evaluar(lectura) → veredicto` que decide si cada parámetro está dentro de
  lo habitual **para ese punto** y si hay que abrir una alerta.
- **Entradas listas.** `contrato/fixtures/linea_base.json` (banda histórica de cada estación),
  `contrato/fixtures/escenarios/*.json` (cinco días simulados), `contrato/esquemas/veredicto.schema.json`
  (lo que debe devolver), `datos/procesados/umbral.csv` (límites oficiales).
- **La vara.** El evaluador provisional del mock da 31 alertas en un día normal
  (`contrato/README.md`, "La vara a superar").
- **Terminado.** A lo más 2 alertas en `normal`; evento detectado en menos de 45 minutos simulados en
  los tres escenarios de incidente; en `falla_sensor`, cero alertas ambientales y al menos 4 avisos
  técnicos.
- **Cómo probar.** `python contrato/reproducir_escenario.py <escenario> --url <backend>` reproduce un
  escenario contra un servidor; el mock (`python contrato/servidor_mock.py`) es la referencia.
- **Frontera.** El simulador ya muestra lo que devuelva `POST /lecturas`
  (`veredictos[].parametros[].posicion_en_banda` y `veredictos[].alertas`): cuando M2 exista, se verá
  ahí sin tocar el simulador.

### M1, topología

- **Qué es.** Proyectar los 219 sitios sobre la red del INEGI y decir, para cada uno, cuál es el
  siguiente aguas abajo y a qué distancia sobre el cauce.
- **Entradas listas.** La red ya está descargada en `datos/geo/F08_red_hidrografica` (no se versiona:
  `python -I scripts/00_descargar_fuentes.py` la baja). Los tramos traen `ORDER_1`, `ARBSUM_1` y
  `FLOWDIR`. `scripts/60_red_para_mapa.py` ya tiene un lector de shapefile y dbf sin dependencias.
- **Terminado.** Los 219 sitios con `c_sitio_aguas_abajo` o la razón de por qué no; distancias sobre
  el cauce; validado contra al menos 10 sitios cuyo nombre declara su posición.
- **Lo que desbloquea.** M3 y, con él, pintar en el mapa la contaminación avanzando río abajo.

### M5, backend

- Puede empezarse ya contra el contrato: el mock es la especificación ejecutable. Terminado cuando
  `reproducir_escenario.py normal --url <backend>` corre sin errores de contrato, rechaza con 422 lo
  mismo que el mock y los datos persisten tras reiniciar.

### M10, documentación del reto

- Pendientes que no dependen de código: estimación de costos (incluida calibración y reposición de
  sondas), manual breve por tipo de usuario y propuesta de implementación por fases. La ficha del
  dispositivo ya existe: [`dispositivo/ficha-tecnica.md`](../dispositivo/ficha-tecnica.md).

## Lo que está a medias o es supuesto

- **Hardware.** Las especificaciones de sondas, el consumo y la cobertura celular son supuestos de
  diseño; están separados de lo medido en la ficha técnica.
- **Huecos de datos.** Precipitación del SMN y REPDA/DENUE filtrado siguen sin integrarse.
- **Contrato v1.0.** Escrito; falta la sesión del equipo para congelarlo.
- **Mapa base.** Relieve y nombres de Esri sin cuenta: sirve para la demostración, no para uso público.

## Cómo correr lo que existe

Desde la raíz del repositorio (los frontends leen `contrato/fixtures/` y `datos/procesados/`, así que
con doble clic no funcionan):

```powershell
python -m http.server 8000
```

```powershell
python contrato/servidor_mock.py
```

- Mapa: `http://127.0.0.1:8000/mapa/`
- Simulador: `http://127.0.0.1:8000/dispositivo/simulador/`
- Pruebas del firmware: `node dispositivo/simulador/prueba.js`
- Verificación del repositorio, antes de entregar cualquier cambio: `python -I scripts/50_verificar_repo.py`

Si `datos/procesados/muestreo.csv` no existe (no se versiona por tamaño), la verificación avisa; se
genera con `python -I scripts/10_construir_tablas.py` después de bajar los crudos.

## Reglas que no hay que olvidar

- Ningún módulo importa código de otro: se hablan por JSON, HTTP o CSV.
- Los archivos derivados no se editan: se edita su generador (`contexto/02-mapa-del-repo.md`).
- El firmware nunca emite alertas; eso es del backend.
- El semáforo de CONAGUA no pinta el mapa: 176 de 198 sitios con dato están en rojo.
- Cada cambio relevante se anota arriba en `contexto/06-registro-de-cambios.md`.
