# -*- coding: utf-8 -*-
"""M2: motor de reglas. Decide si una lectura amerita una alerta.

evaluar(paquete) -> veredicto, conforme a contrato/esquemas/veredicto.schema.json.

EL PROBLEMA QUE RESUELVE
El evaluador provisional del servidor mock implementa la regla obvia (salio de
la banda p10-p90, tres lecturas seguidas) y produce 31 alertas en un dia sin
ningun incidente contra 35 con una descarga industrial: no discrimina. La razon
es aritmetica: por construccion el 10 % de las lecturas normales cae bajo el
p10 y otro 10 % sobre el p90, asi que con 96 lecturas al dia por 5 parametros y
5 estaciones las rachas de tres aparecen solas.

COMO LO RESUELVE
Cuatro capas, en este orden, y el orden importa:

1. Validez fisica y salud del sensor. Un valor imposible, una lectura congelada
   o un salto imposible producen un AVISO TECNICO y **sacan ese parametro de la
   evaluacion ambiental**. Si no fuera primero, una turbiedad congelada en 37.5
   en un sitio cuya mediana historica es 368 pareceria un evento enorme.
2. Desviacion respecto de la historia del propio sitio, con z robusto sobre
   mediana y MAD. No percentiles: el umbral es 3.5, no 1.3.
3. Escalon respecto de las ultimas horas de la propia estacion. Detecta que
   algo *acaba de cambiar* aunque el valor absoluto siga dentro de la banda
   historica, que es lo que distingue "aqui acaba de pasar algo" de "este rio
   siempre esta mal".
4. Coherencia entre parametros y persistencia. Un evento real mueve varios
   parametros a la vez con una firma fisica. Se exige o dos parametros
   coherentes, o uno con senal muy fuerte, sostenido varias lecturas.

Sin dependencias externas. No persiste nada: eso es del backend (M5).
"""
import csv
import json
import math
import os
import statistics as st
from collections import defaultdict, deque

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIX = os.path.join(RAIZ, 'contrato', 'fixtures')
PROC = os.path.join(RAIZ, 'datos', 'procesados')

VERSION = '1.0'

# ------------------------------------------------------------------ umbrales
# Rango fisicamente posible de cada sensor. Fuera de aqui es falla, no evento.
RANGO_FISICO = {
    'OD': (0.0, 20.0), 'OD_PCT': (0.0, 200.0), 'PH': (0.0, 14.0),
    'COND': (0.0, 20000.0), 'TEMP': (0.0, 45.0), 'TURB': (0.0, 4000.0),
    'SDT': (0.0, 15000.0),
}
# Cambio maximo creible entre dos lecturas consecutivas (15 min). Solo se
# declara donde el salto es realmente imposible en un rio, no donde una
# descarga puede provocarlo de verdad: la conductividad SI puede multiplicarse
# en dos horas, asi que no se limita.
SALTO_IMPOSIBLE = {'TEMP': 6.0, 'PH': 3.0, 'OD': 10.0}

LECTURAS_CONGELADAS = 8      # 8 lecturas de 15 min = 2 h con el valor identico
VENTANA_RECIENTE = 16        # 4 h de referencia para el detector de escalon
# Brecha de guarda entre la referencia y la lectura actual. Sin ella, una
# descarga que sube de forma gradual contamina su propia ventana de referencia:
# la mediana reciente sube con el evento y la senal se diluye hasta
# desaparecer. Con la descarga organica, cuya rampa dura 90 min, el evento no se
# detectaba en absoluto. La referencia se toma de 6 h a 2 h antes.
BRECHA_GUARDA = 8
Z_ESCALON = 3.5              # desviaciones robustas contra las ultimas horas
Z_FUERTE = 6.0               # con esto basta una persistencia mas corta
Z_SENAL = 1.5                # minimo para que un parametro aporte a la firma
PERSISTENCIA = 3             # lecturas consecutivas antes de emitir
PERSISTENCIA_CORTA = 2       # cuando la senal es fuerte o la mueven 3+ parametros
N_MINIMO_BANDA = 12          # convencion del proyecto para usar una linea base
DERIVA_LECTURAS = 24         # 6 h de tendencia monotona


def _mad_valida(mad, mediana):
    """MAD utilizable. Si es cero o nula, se cae a una fraccion de la mediana."""
    if mad and mad > 0:
        return mad
    if mediana:
        return abs(mediana) * 0.1
    return None


def z_robusto(valor, mediana, mad):
    m = _mad_valida(mad, mediana)
    if m is None or mediana is None:
        return None
    return (valor - mediana) / (1.4826 * m)


class Motor:
    """Guarda el estado por estacion que las reglas necesitan.

    El estado es minimo a proposito: el historial reciente de cada parametro y
    los contadores de persistencia. Nada se escribe a disco.
    """

    def __init__(self, linea_base=None, estaciones=None, umbrales=None,
                 candidatos=None):
        self.lb = linea_base if linea_base is not None else cargar_linea_base()
        self.est = estaciones if estaciones is not None else cargar_estaciones()
        self.esc = umbrales if umbrales is not None else cargar_escala_conagua()
        self.cand = candidatos if candidatos is not None else cargar_candidatos()
        self.reciente = defaultdict(
            lambda: deque(maxlen=VENTANA_RECIENTE + BRECHA_GUARDA))
        self.congelado = defaultdict(int)
        self.ultimo = {}
        self.racha = defaultdict(int)
        self.folio = defaultdict(int)

    # ---------------------------------------------------------- clasificacion
    def clase_conagua(self, cp, valor):
        """Devuelve (clase, veces_el_limite) de la escala oficial."""
        tramos = self.esc.get(cp)
        if not tramos or valor is None:
            return None, None
        clase = None
        for nombre, mn, mx in tramos:
            if (mn is None or valor > mn) and (mx is None or valor <= mx):
                clase = nombre
                break
        # El limite de referencia es el umbral de la clase Contaminada. Para el
        # oxigeno disuelto la escala es inversa -menos oxigeno es peor-, asi que
        # el umbral es el extremo superior de esa clase y la razon se invierte.
        inversa = cp in ('OD',)
        lim = next((mx if inversa else mn for nombre, mn, mx in tramos
                    if nombre == 'Contaminada'), None)
        veces = None
        if lim:
            veces = round(lim / valor if inversa and valor > 0 else valor / lim, 3)
        return clase, veces

    # ------------------------------------------------------------- evaluacion
    def evaluar(self, paquete):
        ce = paquete['c_estacion']
        est = self.est.get(ce, {})
        sitio = est.get('c_sitio')
        salida = {
            'version': VERSION, 'c_estacion': ce,
            'fecha_hora': paquete['fecha_hora'], 'parametros': [],
            'indice_deterioro': None, 'semaforo_publico': None,
            'avisos_tecnicos': [], 'alertas': [],
        }
        candidatos = {}          # los que pasan el umbral: disparan
        senales = {}             # todos los que tienen z: alimentan la firma
        valores = {}             # el valor crudo, para leer el pH en su escala
        refs = {}                # mediana reciente: permite razonar en razones
        excedencias = []

        for lec in paquete['lecturas']:
            cp, v = lec['c_parametro'], lec['valor']
            base = self.lb.get((sitio, cp), {})
            clave = (ce, cp)
            item = {
                'c_parametro': cp, 'valor': v, 'clase_conagua': None,
                'veces_el_limite': None, 'posicion_en_banda': 'sin_linea_base',
                'z_robusto': None,
                'n_linea_base': int(base['n']) if base.get('n') else None,
            }

            # --- capa 1: salud del sensor, antes que nada
            tecnico = self._revisar_sensor(cp, v, clave, salida)
            if tecnico:
                self.racha[clave] = 0
                salida['parametros'].append(item)
                continue

            hist = self.reciente[clave]

            # --- capa 2: desviacion respecto de la historia del sitio
            z_h = None
            if base.get('n') and int(base['n']) >= N_MINIMO_BANDA:
                p10, p90 = base.get('p10'), base.get('p90')
                if p10 is not None and p90 is not None:
                    item['posicion_en_banda'] = (
                        'bajo_p10' if v < p10 else
                        'sobre_p90' if v > p90 else 'normal')
                z_h = z_robusto(v, base.get('mediana'), base.get('mad'))
                if z_h is not None:
                    item['z_robusto'] = round(z_h, 2)

            clase, veces = self.clase_conagua(cp, v)
            item['clase_conagua'] = clase
            item['veces_el_limite'] = veces
            if veces is not None:
                excedencias.append(veces)

            # --- capa 3: escalon respecto de las ultimas horas
            z_e = None
            if len(hist) >= VENTANA_RECIENTE + BRECHA_GUARDA:
                ref = list(hist)[:VENTANA_RECIENTE]
                med_r = st.median(ref)
                mad_r = st.median([abs(x - med_r) for x in ref])
                z_e = z_robusto(v, med_r, mad_r)
                refs[cp] = med_r

            # El disparador es el ESCALON, no la banda historica. La banda
            # viaja en el veredicto como contexto y gradua la gravedad, pero no
            # dispara: estas series estan muy sesgadas a la derecha, asi que la
            # media queda muy por encima de la mediana y en un dia normal
            # varios parametros se ven altos de forma permanente contra el z
            # robusto historico. Usarlo de disparador daba 35 alertas en el dia
            # de control, mas que la regla ingenua que veniamos a mejorar.
            valores[cp] = v
            if z_e is not None:
                senales[cp] = z_e
                if abs(z_e) >= Z_ESCALON:
                    candidatos[cp] = (z_e, 1 if z_e > 0 else -1, 'escalon')

            hist.append(v)
            salida['parametros'].append(item)

        # --- capa 4: coherencia y persistencia
        self._decidir(paquete, salida, candidatos, senales, valores, refs, sitio)

        if excedencias:
            peor = max(excedencias)
            salida['indice_deterioro'] = round(min(100.0, 100 * peor / 5.0), 1)
            salida['semaforo_publico'] = (
                'Rojo' if peor > 1 else 'Amarillo' if peor > 0.6 else 'Verde')
        return salida

    # ------------------------------------------------- capa 1, salud del sensor
    def _revisar_sensor(self, cp, v, clave, salida):
        if v is None:
            salida['avisos_tecnicos'].append({
                'tipo': 'sin_reporte', 'c_parametro': cp,
                'detalle': 'la sonda no entrego valor'})
            self.congelado[clave] = 0
            return True

        lo, hi = RANGO_FISICO.get(cp, (None, None))
        if lo is not None and not (lo <= v <= hi):
            salida['avisos_tecnicos'].append({
                'tipo': 'valor_imposible', 'c_parametro': cp,
                'detalle': '{} fuera del rango fisico del sensor ({} a {})'
                           .format(v, lo, hi)})
            return True

        prev = self.ultimo.get(clave)
        self.ultimo[clave] = v
        if prev is not None and v == prev:
            self.congelado[clave] += 1
        else:
            self.congelado[clave] = 0
        if self.congelado[clave] >= LECTURAS_CONGELADAS:
            salida['avisos_tecnicos'].append({
                'tipo': 'lectura_congelada', 'c_parametro': cp,
                'detalle': '{} lecturas consecutivas con el valor {}'
                           .format(self.congelado[clave] + 1, v)})
            return True

        tope = SALTO_IMPOSIBLE.get(cp)
        if prev is not None and tope and abs(v - prev) > tope:
            salida['avisos_tecnicos'].append({
                'tipo': 'salto_imposible', 'c_parametro': cp,
                'detalle': 'cambio de {:.2f} entre dos lecturas de 15 min, '
                           'maximo creible {}'.format(abs(v - prev), tope)})
            return True

        hist = self.reciente[clave]
        if len(hist) >= DERIVA_LECTURAS:
            xs = list(hist)[-DERIVA_LECTURAS:]
            difs = [b - a for a, b in zip(xs, xs[1:])]
            if difs and all(d > 0 for d in difs) or difs and all(d < 0 for d in difs):
                salida['avisos_tecnicos'].append({
                    'tipo': 'posible_deriva', 'c_parametro': cp,
                    'detalle': '{} lecturas con tendencia monotona; puede ser '
                               'descalibracion de la sonda'.format(DERIVA_LECTURAS)})
                # no se suprime el parametro: la deriva es una sospecha, no una falla
        return False

    # ----------------------------------------- capa 4, coherencia y persistencia
    def _decidir(self, paquete, salida, candidatos, senales, valores, refs, sitio):
        ce = paquete['c_estacion']
        # Coherencia OBLIGATORIA: se exigen dos parametros. Una descarga real
        # mueve varios a la vez con una firma fisica; una sonda rota mueve uno.
        # Esta es la regla que evita confundir un sensor averiado con un evento,
        # y la que mas falsas alarmas quita.
        if len(candidatos) < 2:
            self.racha[ce] = 0
            return
        maxz = max(abs(z) for z, _, _ in candidatos.values())
        # con senal fuerte o tres parametros movidos no se hace esperar tanto
        necesaria = (PERSISTENCIA_CORTA
                     if (maxz >= Z_FUERTE or len(candidatos) >= 3)
                     else PERSISTENCIA)
        self.racha[ce] += 1
        if self.racha[ce] < necesaria:
            return
        self.racha[ce] = 0

        disparador = max(candidatos.items(), key=lambda kv: abs(kv[1][0]))
        cp, (z, direccion, origen) = disparador
        item = next((p for p in salida['parametros'] if p['c_parametro'] == cp), {})

        # La gravedad NO sale de la clase de CONAGUA. En estos sitios la linea
        # base ya excede todos los criterios, asi que el umbral fijo los
        # calificaria todos como criticos. Sale del tamano de la desviacion.
        az = abs(z)
        nivel = ('Critica' if az >= Z_FUERTE else
                 'Preventiva' if az >= 4.5 else 'Informativa')

        self.folio[ce] += 1
        folio = 'AL-{}-{}-{:02d}'.format(
            paquete['fecha_hora'][:10].replace('-', ''),
            ce.replace('EST-', '').replace('-', ''), self.folio[ce])

        salida['alertas'].append({
            'version': VERSION, 'c_alerta': folio, 'c_estacion': ce,
            'c_sitio': sitio, 'fecha_hora': paquete['fecha_hora'],
            'nivel': nivel, 'c_parametro': cp, 'valor': item.get('valor'),
            'regla': ('desviacion_linea_base' if origen == 'historico'
                      else 'cambio_brusco'),
            'criterio_aplicado': 'LINEA_BASE_SITIO',
            'lecturas_consecutivas': necesaria,
            'fuente_probable': self._fuente_probable(senales, valores, refs, sitio),
            'medidas_sugeridas': [], 'estado': 'Abierta', 'responsable': None,
        })

    # -------------------------------------------------------- fuente probable
    def _fuente_probable(self, senales, valores, refs, sitio=None):
        """Firma de la descarga a partir de los 5 parametros de campo.

        Se razona en RAZONES contra la mediana reciente, no en z. El z sirve
        para detectar que algo cambio, no para clasificar que fue: depende del
        ruido de base, asi que una subida del 35 % en la conductividad puede dar
        z = 8 si el ruido es estrecho, y con eso se clasificaba una descarga
        organica como industrial. Lo que distingue a la industrial es que la
        conductividad se multiplique de verdad, no que su z sea alto.

        Tampoco se puntua "pH fuera del intervalo 6 a 9": en estos sitios el pH
        ya esta normalmente por debajo de 6, asi que ese criterio fijo esta
        cumplido de forma permanente y no distingue nada. Es el mismo error que
        el semaforo.

        Con sensores no hay DQO ni DBO, asi que la razon DQO/DBO -el mejor
        discriminador que existe entre municipal e industrial- no esta
        disponible en tiempo real. Queda para el analisis historico.
        """
        def razon(cp):
            v, r = valores.get(cp), refs.get(cp)
            if v is None or not r:
                return None
            z = senales.get(cp)
            if z is None or abs(z) < Z_SENAL:   # no se movio lo suficiente
                return 1.0
            return v / r

        r_cond, r_od, r_turb = razon('COND'), razon('OD'), razon('TURB')
        z_ph = senales.get('PH') or 0.0
        ph = valores.get('PH')

        puntajes = {'descarga_industrial': 0.0,
                    'aguas_residuales_municipales': 0.0,
                    'escurrimiento_o_arrastre': 0.0}
        evidencia = []

        if r_turb and r_turb >= 1.5 and r_cond and r_cond <= 0.85:
            puntajes['escurrimiento_o_arrastre'] += 0.7
            evidencia.append('turbiedad x{:.1f} con conductividad a la baja '
                             '(x{:.2f}): firma de arrastre, no de descarga'
                             .format(r_turb, r_cond))
        if r_cond and r_cond >= 2.0:
            puntajes['descarga_industrial'] += 0.5
            evidencia.append('conductividad x{:.1f}'.format(r_cond))
        elif r_cond and r_cond >= 1.1:
            puntajes['aguas_residuales_municipales'] += 0.3
            puntajes['descarga_industrial'] += 0.05
            evidencia.append('conductividad x{:.2f}, alza moderada'.format(r_cond))
        if abs(z_ph) >= Z_FUERTE:
            puntajes['descarga_industrial'] += 0.3
            evidencia.append('pH desplazado con fuerza (z {:.0f})'.format(z_ph))
        if r_od and r_od <= 0.7:
            puntajes['aguas_residuales_municipales'] += 0.4
            evidencia.append('oxigeno disuelto a x{:.2f}: consumo de materia '
                             'organica'.format(r_od))
        if r_turb and r_turb >= 1.5 and r_cond and r_cond >= 1.0:
            puntajes['aguas_residuales_municipales'] += 0.2
            evidencia.append('turbiedad x{:.1f}'.format(r_turb))
        if ph is not None and not (6.0 <= ph <= 9.0):
            evidencia.append('pH en {:.1f}, fuera de 6 a 9, que en este sitio '
                             'es lo habitual'.format(ph))

        tipo, p = max(puntajes.items(), key=lambda kv: kv[1])
        if p <= 0:
            return {'tipo': 'indeterminada', 'puntaje': 0.0,
                    'evidencia': evidencia or ['ningun indicador reconocible'],
                    'candidatos_aguas_arriba': []}
        segundo = sorted(puntajes.values())[-2]
        if segundo > 0 and p - segundo < 0.15:
            tipo = 'mixta'
        return {'tipo': tipo, 'puntaje': round(min(1.0, p), 2),
                'evidencia': evidencia,
                'candidatos_aguas_arriba': self._candidatos(sitio, tipo)}

    def _candidatos(self, sitio, tipo):
        """Establecimientos del DENUE aguas arriba del sitio cuyo giro es
        compatible con la fuente. Son sospechosos para inspeccion: el DENUE no
        dice que descarguen. REPDA sigue pendiente."""
        por_tipo = self.cand.get(sitio, {})
        if tipo == 'mixta':
            fuentes = [por_tipo.get('industrial', [])[:3], por_tipo.get('organica', [])[:3]]
            return [c for lote in fuentes for c in lote]
        clave = TIPO_A_GIRO.get(tipo)
        return list(por_tipo.get(clave, [])[:5]) if clave else []


# ------------------------------------------------------------------- cargadores
TIPO_A_GIRO = {'descarga_industrial': 'industrial',
               'aguas_residuales_municipales': 'organica'}


def cargar_candidatos(ruta=None):
    """{c_sitio: {tipo de giro: [candidatos]}} del DENUE (scripts/95)."""
    ruta = ruta or os.path.join(FIX, 'candidatos_denue.json')
    if not os.path.exists(ruta):
        return {}
    with open(ruta, encoding='utf-8') as f:
        return json.load(f)['sitios']


def cargar_linea_base(ruta=None):
    ruta = ruta or os.path.join(FIX, 'linea_base.json')
    with open(ruta, encoding='utf-8') as f:
        filas = json.load(f)['linea_base']
    return {(r['c_sitio'], r['c_parametro']): r for r in filas}


def cargar_estaciones(ruta=None):
    ruta = ruta or os.path.join(FIX, 'estaciones.json')
    with open(ruta, encoding='utf-8') as f:
        return {e['c_estacion']: e for e in json.load(f)['estaciones']}


def cargar_escala_conagua(ruta=None):
    """Lee umbral.csv y devuelve {codigo_corto: [(clase, min, max), ...]}."""
    ruta = ruta or os.path.join(PROC, 'umbral.csv')
    # umbral.csv nombra los parametros como los titula CONAGUA en sus escalas
    equiv = {
        'OXIGENO DISUELTO _porcentaje': 'OD_PCT', 'SST': 'SST',
        'DBO5': 'DBO5', 'DQO': 'DQO', 'COLI_FEC_superficiales': 'CF',
        'E_COLI': 'ECOLI', 'ENTEROCOCOS FECALES': 'ENTEROC',
        'TOXICIDAD': 'TOX',
    }
    salida = defaultdict(list)
    if not os.path.exists(ruta):
        return salida
    with open(ruta, encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            if r['c_escala'] != 'CONAGUA_SUP':
                continue
            cp = equiv.get(r['c_parametro'].strip())
            if not cp:
                continue
            mn = float(r['min']) if r['min'] not in ('', None) else None
            mx = float(r['max']) if r['max'] not in ('', None) else None
            salida[cp].append((r['categoria'], mn, mx))
    # El oxigeno disuelto llega como porcentaje de saturacion y la estacion lo
    # mide en mg/L. La escala en mg/L no esta en umbral.csv, asi que se declara
    # aqui el limite de la clase Contaminada de uso comun: 4 mg/L.
    salida['OD'] = [('Excelente', 6.0, None), ('Buena calidad', 5.0, 6.0),
                    ('Aceptable', 4.0, 5.0), ('Contaminada', 2.0, 4.0),
                    ('Fuertemente contaminada', None, 2.0)]
    return salida
