"""Inspecciona los archivos crudos descargados: hojas, columnas y tamanos.
Uso: python -I scripts/01_inspeccionar_crudos.py <archivo> [<archivo> ...]
No modifica nada; solo lee.
"""
import sys, os

def ver_xlsx(p):
    import openpyxl
    wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
    for ws in wb.worksheets:
        print(f"  [hoja] {ws.title}  dims={ws.calculate_dimension()}")
        for i, row in enumerate(ws.iter_rows(min_row=1, max_row=3, values_only=True)):
            vals = [str(v)[:28] for v in row[:18]]
            print(f"    r{i+1}: {vals}")
    wb.close()

def ver_xlsb(p):
    from pyxlsb import open_workbook
    with open_workbook(p) as wb:
        for name in wb.sheets:
            print(f"  [hoja] {name}")
            with wb.get_sheet(name) as sh:
                for i, row in enumerate(sh.rows()):
                    print(f"    r{i+1}: {[str(c.v)[:28] for c in row[:18]]}")
                    if i >= 2:
                        break

for p in sys.argv[1:]:
    print(f"=== {os.path.basename(p)}  ({os.path.getsize(p):,} bytes)")
    try:
        (ver_xlsb if p.lower().endswith('.xlsb') else ver_xlsx)(p)
    except Exception as e:
        print("  ERROR:", type(e).__name__, e)
