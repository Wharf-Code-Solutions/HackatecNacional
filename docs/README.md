# Documentación

Esta carpeta tiene **dos secciones con propósitos distintos**. Conviene no confundirlas.

| Sección | Para quién | Qué contiene |
|---|---|---|
| **Esta carpeta** (`docs/*.md`) | Personas: quien escribe la documentación técnica del reto, quien prepara el pitch, quien se incorpora al equipo | Qué se está construyendo, con qué tecnologías, de dónde salen los datos y por qué se decidió cada cosa |
| **[`contexto/`](contexto/)** | Agentes de IA y desarrolladores antes de tocar código | Las reglas que no se pueden romper, el mapa de qué archivo manda sobre qué, el protocolo para hacer un cambio y el registro de cambios |

**Si eres un agente de IA y vas a modificar este repositorio, empieza por
[`contexto/00-LEEME-PRIMERO.md`](contexto/00-LEEME-PRIMERO.md).** No por aquí.

---

## Sección 1: el prototipo

**¿Te incorporas o vas a tomar un módulo?** Empieza por [12-estado-y-traspaso.md](12-estado-y-traspaso.md).

Orden de lectura recomendado. Los primeros seis documentos se mantienen a mano; los
últimos seis son documentos de trabajo, dos de ellos generados por scripts.

| # | Documento | Qué responde | Origen |
|---|---|---|---|
| 01 | [Qué estamos construyendo](01-que-construimos.md) | El problema, la solución y qué existe hoy frente a qué está planeado | a mano |
| 02 | [Arquitectura](02-arquitectura.md) | Cómo encajan las piezas y por dónde fluye un dato | a mano |
| 03 | [Tecnologías](03-tecnologias.md) | Qué se usa, qué se descartó y por qué | a mano |
| 04 | [Fuentes de datos](04-fuentes-de-datos.md) | De dónde salen los datos, cómo se obtuvieron y qué pregunta responde cada uno | a mano |
| 05 | [Decisiones técnicas](05-decisiones-tecnicas.md) | Las decisiones con su justificación, la alternativa descartada y su consecuencia | a mano |
| 06 | [Glosario](06-glosario.md) | Los términos del dominio y del proyecto | a mano |
| 07 | [Plan de recolección de datos](07-plan-recoleccion-datos.md) | El plan original de la Etapa 1, **tal como se escribió** | histórico, no se edita |
| 08 | [Verificación de datos](08-verificacion-datos.md) | El estado del conjunto de datos, con veredicto por sección | **generado** por `scripts/30_verificacion_datos.py` |
| 09 | [Hallazgos del exploratorio](09-hallazgos-exploratorio.md) | Qué dicen los datos | **generado** por `scripts/20_analisis_exploratorio.py` |
| 10 | [Revisión crítica del plan](10-revision-critica-plan.md) | Seis objeciones al plan de etapas 2 a 8, con alternativas | a mano |
| 18 | [Red de estaciones](18-red-de-estaciones.md) | Cuántas estaciones, dónde, cómo se comunican y cuánto cuestan, con la curva de cobertura | a mano; cifras de `scripts/96_red_estaciones.py` |
| 17 | [Plan de la app ciudadana](17-plan-app-ciudadana.md) | Especificación completa de M8: decisiones, alternativas descartadas, contrato y criterio de terminado | a mano |
| 16 | [Modelos proxy](16-modelos-proxy.md) | Qué parámetro de laboratorio se puede estimar desde un sensor y cuál no | **generado** por `scripts/90_modelos_proxy.py` |
| 15 | [Motor de reglas](15-motor-reglas.md) | Resultado contra los cinco escenarios y el intercambio que se eligió | **generado** por `motor/prueba.py` |
| 14 | [Propagación](14-propagacion.md) | Qué modelo se usa, por qué los datos descartaron el decaimiento y cómo se validó | **generado** por `scripts/80_propagacion.py` |
| 13 | [Topología de la red](13-topologia-red.md) | Cómo se ordenaron los sitios río abajo y qué casos quedaron marcados | **generado** por `scripts/70_topologia_red.py` |
| 11 | [Metodología de módulos](11-metodologia-modulos.md) | Cómo se reparte el trabajo sin cuellos de botella | a mano |
| 12 | [Estado actual y traspaso](12-estado-y-traspaso.md) | Qué hay, qué falta y qué puede tomar alguien hoy sin esperar a nadie | a mano |

> Los documentos **08 y 09 se sobrescriben** cada vez que corre su script. No los edites a
> mano: el cambio se pierde en la siguiente corrida. Si algo está mal ahí, se corrige en
> el script.

## Sección 2: contexto para agentes

| # | Documento | Qué contiene |
|---|---|---|
| 00 | [LÉEME PRIMERO](contexto/00-LEEME-PRIMERO.md) | El protocolo de arranque de un agente |
| 01 | [Invariantes](contexto/01-invariantes.md) | Las reglas que no se rompen, con cómo detectar que se rompieron |
| 02 | [Mapa del repositorio](contexto/02-mapa-del-repo.md) | Qué archivo es la fuente de verdad de qué, y qué se puede editar a mano |
| 03 | [Fronteras y dependencias](contexto/03-fronteras-y-dependencias.md) | Qué módulo puede tocar qué, y en qué dirección fluyen las dependencias |
| 04 | [Verificación obligatoria](contexto/04-verificacion-obligatoria.md) | Los comandos que deben pasar antes de declarar un cambio terminado |
| 05 | [Protocolo de cambios](contexto/05-protocolo-de-cambios.md) | "Si cambias X, entonces tienes que hacer Y" |
| 06 | [Registro de cambios](contexto/06-registro-de-cambios.md) | Bitácora de cambios relevantes, en orden inverso |

---

## Para quien escribe la documentación técnica del reto

El reto pide documentación técnica, estimación de costos y propuesta de implementación.
Lo que ya está escrito y de dónde tomarlo:

| Entregable que pide el reto | De dónde sale |
|---|---|
| Arquitectura general | [02-arquitectura.md](02-arquitectura.md) |
| Contrato de datos y modelo de base de datos | [`contrato/README.md`](../contrato/README.md) y [`datos/README.md`](../datos/README.md) |
| Reglas y modelos con supuestos y limitaciones | [10-revision-critica-plan.md](10-revision-critica-plan.md) y la sección de limitaciones de [`datos/README.md`](../datos/README.md) |
| Ficha del dispositivo | [`dispositivo/ficha-tecnica.md`](../dispositivo/ficha-tecnica.md) (diseño y simulador; sin hardware) |
| Manual breve por tipo de usuario | **pendiente** |
| Resultados obtenidos | [08](08-verificacion-datos.md), [09](09-hallazgos-exploratorio.md) y la tabla del stub en [`contrato/README.md`](../contrato/README.md) |
| Estimación de costos | **pendiente**, ver la advertencia sobre calibración en [05-decisiones-tecnicas.md](05-decisiones-tecnicas.md) |
| Propuesta de implementación por fases | **pendiente**, el plan original la esboza en su sección 7.3 |

Lo marcado como pendiente **no existe todavía**. No lo documentes como si existiera: la
distinción entre lo construido y lo planeado es la parte más fácil de perder y la que un
jurado detecta más rápido.
