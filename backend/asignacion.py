# -*- coding: utf-8 -*-
"""Asigna un punto cualquiera al tramo del rio que le toca, y de ahi al sitio
de monitoreo que queda aguas abajo.

Para que serve: un reporte ciudadano llega con coordenadas. Asignarlo al sitio
mas cercano en linea recta esta MAL, porque dos puntos a 200 m pueden estar en
barrancas distintas que no se comunican. Hay que engancharlo al cauce y seguir
el agua. Es la mejora concreta sobre el radio fijo que usaba SIGRIV.

El algoritmo es el mismo de scripts/70_topologia_red.py (proyeccion
punto-segmento con rejilla espacial) y los datos los produce
scripts/71_red_para_asignacion.py, que poda la red de 65 342 tramos a los
11 765 que alcanzan un sitio en 20 km y la simplifica a 1.6 MB para que quepa
en la funcion de Vercel.

Sin dependencias externas.
"""
import json
import math
import os
from collections import defaultdict

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUTA = os.path.join(RAIZ, 'datos', 'procesados', 'red', 'red_asignacion.json')
# La red de asignacion solo trae los tramos que llegan a un sitio en 20 km: fuera de ella un reporte junto a un
# rio salia "sin cauce". La distancia al cauce se mide tambien contra la red del INEGI de orden >= 4 que dibuja el
# mapa (scripts/60_red_para_mapa.py); el sitio aguas abajo sigue saliendo solo de la red de asignacion.
RUTA_RED = os.path.join(RAIZ, 'datos', 'procesados', 'mapa', 'red_hidrografica.geojson')

# Metrica local: a la latitud de la cuenca basta una proyeccion plana.
LAT0 = 19.1
M_LAT = 110574.0
M_LON = 111320.0 * math.cos(math.radians(LAT0))

# Un reporte mas lejos de esto no se asigna a ningun sitio. No es el mismo
# umbral que el de los sitios de monitoreo (150 m): un sitio de muestreo ESTA
# en el rio, mientras que una persona reporta desde donde puede pararse, y el
# GPS de un telefono en una barranca con mala vista del cielo falla facil.
TOLERANCIA_M = 1500.0

CELDA = 0.01


class Asignador:
    """Carga la red una vez y engancha puntos. Si no hay red, no asigna."""

    def __init__(self, ruta=RUTA, ruta_red=RUTA_RED):
        self.tramos = {}
        self.rejilla = defaultdict(list)
        self.disponible = False
        self.lineas = []                       # red del INEGI para la distancia al cauce
        self.rejilla_red = defaultdict(list)
        if ruta_red and os.path.exists(ruta_red):
            with open(ruta_red, encoding='utf-8') as f:
                red = json.load(f)
            for ft in red.get('features', []):
                g = ft.get('geometry') or {}
                partes = g.get('coordinates', []) if g.get('type') == 'MultiLineString' else [g.get('coordinates', [])]
                for pts in partes:
                    if len(pts) < 2:
                        continue
                    k = len(self.lineas)
                    self.lineas.append(pts)
                    for i in range(len(pts) - 1):
                        a, b = pts[i], pts[i + 1]
                        cx0, cx1 = sorted((int(a[0] / CELDA), int(b[0] / CELDA)))
                        cy0, cy1 = sorted((int(a[1] / CELDA), int(b[1] / CELDA)))
                        for cx in range(cx0, cx1 + 1):
                            for cy in range(cy0, cy1 + 1):
                                self.rejilla_red[(cx, cy)].append((k, i))
        if not os.path.exists(ruta):
            return
        with open(ruta, encoding='utf-8') as f:
            datos = json.load(f)
        for t in datos['tramos']:
            self.tramos[t['t']] = t
            pts = t['p']
            for i in range(len(pts) - 1):
                a, b = pts[i], pts[i + 1]
                cx0, cx1 = sorted((int(a[0] / CELDA), int(b[0] / CELDA)))
                cy0, cy1 = sorted((int(a[1] / CELDA), int(b[1] / CELDA)))
                for cx in range(cx0, cx1 + 1):
                    for cy in range(cy0, cy1 + 1):
                        self.rejilla[(cx, cy)].append((t['t'], i))
        self.disponible = True

    @staticmethod
    def _proyecta(p, a, b):
        """(distancia en metros, fraccion en el segmento) del punto p a a-b."""
        ax = (a[0] - p[0]) * M_LON
        ay = (a[1] - p[1]) * M_LAT
        bx = (b[0] - p[0]) * M_LON
        by = (b[1] - p[1]) * M_LAT
        dx, dy = bx - ax, by - ay
        largo2 = dx * dx + dy * dy
        if largo2 == 0:
            return math.hypot(ax, ay), 0.0
        t = max(0.0, min(1.0, -(ax * dx + ay * dy) / largo2))
        return math.hypot(ax + t * dx, ay + t * dy), t

    def distancia_red(self, lat, lon, radio=2):
        """Metros al cauce mas cercano de la red del INEGI (orden >= 4), o None si no hay uno en ~2 km."""
        if not self.lineas or lat is None or lon is None:
            return None
        p = (float(lon), float(lat))
        cx, cy = int(p[0] / CELDA), int(p[1] / CELDA)
        mejor = None
        for ix in range(cx - radio, cx + radio + 1):
            for iy in range(cy - radio, cy + radio + 1):
                for k, i in self.rejilla_red.get((ix, iy), ()):
                    pts = self.lineas[k]
                    d, _ = self._proyecta(p, pts[i], pts[i + 1])
                    if mejor is None or d < mejor:
                        mejor = d
        return None if mejor is None else round(mejor, 1)

    def asignar(self, lat, lon):
        """Devuelve dict con c_sitio_asignado, distancia_al_cauce_m y el tramo.

        c_sitio_asignado queda en None si no hay cauce dentro de la tolerancia:
        es un estado valido del contrato y mas honesto que inventar un sitio.
        """
        vacio = {'c_sitio_asignado': None, 'distancia_al_cauce_m': None,
                 'c_tramo': None}
        if lat is None or lon is None:
            return vacio
        d_red = self.distancia_red(lat, lon)
        if not self.disponible:
            return dict(vacio, distancia_al_cauce_m=d_red)
        p = (float(lon), float(lat))
        cx, cy = int(p[0] / CELDA), int(p[1] / CELDA)
        mejor = None
        for radio in (1, 3, 6):
            for ix in range(cx - radio, cx + radio + 1):
                for iy in range(cy - radio, cy + radio + 1):
                    for ct, i in self.rejilla.get((ix, iy), ()):
                        pts = self.tramos[ct]['p']
                        d, t = self._proyecta(p, pts[i], pts[i + 1])
                        if mejor is None or d < mejor[0]:
                            mejor = (d, ct, t)
            if mejor and mejor[0] <= radio * CELDA * M_LAT:
                break
        if not mejor:
            return dict(vacio, distancia_al_cauce_m=d_red)
        d, ct, _ = mejor
        if d > TOLERANCIA_M:
            # se reporta la distancia aunque no se asigne: es informacion util; si la red del INEGI tiene un
            # cauce mas cerca (fuera de la red de asignacion), esa es la distancia real al cauce
            cerca = min(d, d_red) if d_red is not None else d
            return {'c_sitio_asignado': None, 'distancia_al_cauce_m': round(cerca, 1),
                    'c_tramo': None}
        return {'c_sitio_asignado': self.tramos[ct]['s'],
                'distancia_al_cauce_m': round(d, 1), 'c_tramo': ct}
