import sys, openpyxl, collections
p = sys.argv[1]
wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
ws = wb['CAPSUP 12-2025'] if 'CAPSUP 12-2025' in wb.sheetnames else wb.worksheets[0]
rows = ws.iter_rows(values_only=True)
hdr = list(next(rows))
print("COLUMNAS:", len(hdr))
for i,c in enumerate(hdr): print(f"  {i:2d} {c}")
cue = collections.Counter(); est = collections.Counter(); n=0
idx_c = hdr.index('CUENCA'); idx_e = hdr.index('ESTADO')
for r in rows:
    n+=1
    if r[idx_e] in ('PUEBLA','TLAXCALA'):
        cue[r[idx_c]] += 1; est[r[idx_e]] += 1
print(f"\nfilas totales={n}  Puebla/Tlaxcala={sum(est.values())} {dict(est)}")
print("\nCUENCAS en Pue/Tlax:")
for k,v in cue.most_common(40): print(f"  {v:5d}  {k}")
print("\n--- Escalas Superficial ---")
for r in wb['Escalas Superficial '].iter_rows(values_only=True) if 'Escalas Superficial ' in wb.sheetnames else []:
    print("  ", [str(x)[:70] if x else '' for x in r])
wb.close()
