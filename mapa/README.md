# Mapa de la cuenca · prototipo de M6

Muestra la cuenca del río Atoyac del INEGI (RH18A, 10 subcuencas, 31 480 km²) delimitada: lo
de fuera se aclara y el contorno va en tinta. Encima, los ríos y barrancas con grosor por orden,
las 14 confluencias principales, los 219 sitios del monitoreo oficial y las 5 estaciones centinela. Al hacer clic en una estación el mapa se
acerca y abre el simulador de esa estación (la estación en el río y cómo mide cada sonda).

## Correrlo

```powershell
python -m http.server 8000
```

Abrir `http://127.0.0.1:8000/mapa/`. Para que el mapa se entere de las alertas, arrancar
también el backend de contrato:

```powershell
python contrato/servidor_mock.py
```

El mapa funciona sin él (el estado queda en "sin conexión"). Con él, el simulador de la
estación envía sus lecturas y la estación se pone en rojo si el backend abre una alerta.

## Datos

Las confluencias se calculan sobre la red completa (todos los órdenes) acumulando la longitud
de red aguas arriba; se rotulan solo las que el INEGI nombra como río en ambos brazos, porque
la toponimia está dispersa y el nombre automático puede fallar en barrancas. Las demás dan su
nombre al pasar el cursor.

Los ríos, subcuencas, contorno y confluencias salen de `datos/procesados/mapa/`, que genera
`scripts/60_red_para_mapa.py` a partir de la red hidrográfica del INEGI. Si faltan:

```powershell
python -I scripts/00_descargar_fuentes.py F08
```

Y correr `python -I scripts/60_red_para_mapa.py`, que extrae el zip a `datos/geo/` si hace falta.

## Frontera

No importa código de otro módulo. Muestra el simulador por URL y lee el backend por contrato
(solo para poner en rojo la estación con una alerta abierta).

El token de Mapbox vive en el `.env` de la raíz (`MAPBOX_ACCESS_TOKEN=pk...`, no versionado) y
se copia a `mapa/config.js` (tampoco versionado) con:

```powershell
python -I mapa/generar_config.py
```

El navegador no puede leer `.env`, por eso existe `config.js`. El script se niega a escribir un
token secreto (`sk.`) y nunca imprime el token completo. Un token público sigue siendo visible en el
navegador, como en cualquier mapa de Mapbox: la protección es restringirlo por URL en la cuenta.
También se puede crear `config.js` a mano copiando `config.ejemplo.js`.

Con `mapa/config.js` y un token público de Mapbox
usa Mapbox GL JS con el estilo claro de Mapbox. Sin él, usa MapLibre GL
con la base vectorial de OpenFreeMap, sin llave; se apagan sus ríos para que la
red del INEGI sea la única agua. El mapa abre en la zona de la red de estaciones y no en toda la
cuenca. Todos los ríos tienen el mismo estilo y llevan guiones blancos que corren aguas abajo; la
casilla "Flujo del agua" los apaga. De la base se apagan calles y carreteras. El satélite, el relieve y
los sitios oficiales se quitaron para que el mapa diga una sola cosa. La barra lateral es
la lista de estaciones y la casilla del flujo, y se pliega con el botón junto al título (al abrir una estación se pliega
sola para dar lugar a la zona y al simulador); las fuentes están en el botón de atribución.
