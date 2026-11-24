# -*- coding: utf-8 -*-
"""Descarga las fuentes crudas a datos/crudos/<ID>/ sin modificarlas.

Las URL de esta lista ya estan verificadas (ver datos/bitacora.md). Varias no
aparecen en el HTML de las paginas de CONAGUA: F01 estaba como anotacion de
hipervinculo dentro del PDF de transparencia y F08 detras del buscador con
JavaScript del INEGI.

Uso:
    python -I scripts/00_descargar_fuentes.py            # solo lo que falta
    python -I scripts/00_descargar_fuentes.py --forzar   # vuelve a descargar
    python -I scripts/00_descargar_fuentes.py F01 F05    # solo esas fuentes
"""
import os
import sys
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRUDOS = os.path.join(RAIZ, 'datos', 'crudos')
UA = 'Mozilla/5.0 (recoleccion de datos abiertos, HackaTec 2026)'

# (id_fuente, nombre de archivo local, url)
FUENTES = [
    ('F01', 'CalidaddelAgua.pdf',
     'https://files.conagua.gob.mx/transparencia/CalidaddelAgua.pdf'),
    ('F01', 'Resultados_Rio_Atoyac.xlsx',
     'https://files.conagua.gob.mx/conagua/GobiernoAbierto/Resultados_Rio_Atoyac.xlsx'),
    ('F01', 'Manual_Rio_Atoyac.docx',
     'https://files.conagua.gob.mx/conagua/GobiernoAbierto/Manual_Rio_Atoyac.docx'),
    ('F01', 'Calidad_Agua_Superficial.xlsx',
     'https://files.conagua.gob.mx/conagua/GobiernoAbierto/Calidad_Agua_Superficial.xlsx'),
    ('F02', 'Calidad_del_Agua_Superficial_p_2012-2025.xlsx',
     'https://www.gob.mx/cms/uploads/attachment/file/1084133/Calidad_del_Agua_Superficial_p_2012-2025.xlsx'),
    ('F02', 'Calidad_del_Agua_Superficial_a_2025.xlsx',
     'https://www.gob.mx/cms/uploads/attachment/file/1084132/Calidad_del_Agua_Superficial_a_2025.xlsx'),
    ('F03', 'Calidad_del_Agua_Superficial_p.zip',
     'https://files.conagua.gob.mx/conagua/generico/sequia/Calidad_del_Agua_Superficial_p.zip'),
    ('F03', 'Calidad_del_Agua_Superficial_a.zip',
     'https://files.conagua.gob.mx/conagua/generico/sequia/Calidad_del_Agua_Superficial_a.zip'),
    ('F05', 'RESULTADOS-PUEBLA.xlsb',
     'https://files.conagua.gob.mx/aguasnacionales/RESULTADOS-PUEBLA.xlsb'),
    ('F05', 'RESULTADOS-TLAXCALA.xlsx',
     'https://files.conagua.gob.mx/aguasnacionales/RESULTADOS-TLAXCALA.xlsx'),
    ('F06', 'Generalidades_Indicadores_de_calidad_del_agua_2025.pdf',
     'https://www.gob.mx/cms/uploads/attachment/file/1084347/Generalidades_Indicadores_de_calidad_del_agua_2025.pdf'),
    ('F07', 'NOM-001-SEMARNAT-2021.pdf',
     'https://platiica.economia.gob.mx/wp-content/uploads/sites/2/PDF_Normas_Publicas/001semarnat2021.pdf'),
    ('F08', '702825006881_RedHidrografica_Cuenca_R_Atoyac_RH_Balsas.zip',
     'https://www.inegi.org.mx/contenidos/productos/prod_serv/contenidos/espanol/'
     'bvinegi/productos/geografia/hidrogeolo/cuenca/702825006881_s.zip'),
    ('F12', 'denue_21_puebla_csv.zip',
     'https://www.inegi.org.mx/contenidos/masiva/denue/denue_21_csv.zip'),
    ('F12', 'denue_29_tlaxcala_csv.zip',
     'https://www.inegi.org.mx/contenidos/masiva/denue/denue_29_csv.zip'),
    ('F15', 'Diagnostico_Rio_Atoyac_2012-2024.pdf',
     'https://files.conagua.gob.mx/conagua/riosprioritarios/'
     'Diagn%C3%B3stico_R%C3%ADo_Atoyac_2012-2024.pdf'),
    ('F15', '2023_Diagnostico_rio_Atoyac_Pue_2012-2022.pdf',
     'https://www.gob.mx/cms/uploads/attachment/file/925318/'
     '2023_Diagn_stico_r_o_Atoyac_Pue_2012-2022.pdf'),
]

args = [a for a in sys.argv[1:]]
forzar = '--forzar' in args
pedidas = [a for a in args if not a.startswith('--')]

for fid, nombre, url in FUENTES:
    if pedidas and fid not in pedidas:
        continue
    destino = os.path.join(CRUDOS, fid, nombre)
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    if os.path.exists(destino) and not forzar:
        print('{} {} ya existe ({:,} bytes)'.format(fid, nombre,
                                                    os.path.getsize(destino)))
        continue
    print('{} descargando {} ...'.format(fid, nombre))
    pet = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(pet, timeout=600) as r, open(destino, 'wb') as f:
        f.write(r.read())
    print('   {:,} bytes'.format(os.path.getsize(destino)))

print('\nListo. Archivos en ' + CRUDOS)
