# Mapa de la cuenca · prototipo de M6

Muestra el Alto Atoyac con sus ríos y barrancas, las 10 subcuencas, los 219 sitios del
monitoreo oficial y las 5 estaciones centinela. Al hacer clic en una estación el mapa se
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

Los ríos y subcuencas salen de `datos/procesados/mapa/`, que genera
`scripts/60_red_para_mapa.py` a partir de la red hidrográfica del INEGI. Si faltan:

```powershell
python -I scripts/00_descargar_fuentes.py F08
```

Y correr `python -I scripts/60_red_para_mapa.py`, que extrae el zip a `datos/geo/` si hace falta.

## Frontera

No importa código de otro módulo. Muestra el simulador por URL y lee el backend por contrato.
Necesita internet solo para el mapa base: relieve sombreado y nombres de lugares de Esri, sin llave.
Se eligió el relieve porque no trae calles ni ríos propios: la red del INEGI es lo único que se lee como agua. Sin red, ríos, subcuencas
y sitios siguen visibles.
