# Fase 3: traduce los menus de WhatsApp a plantillas de semana con ids de plato del catalogo.
# Entrada: datos/menus_limpios.json, datos/catalogo_fase0.json (patrones), datos/recetas_f1.json.
# Salidas: datos/plantillas.json, datos/fase3_plantillas_reporte.md
# Una comida = {platos, bebidas, frutas, acomp, nota}; `nota` guarda el texto original del menu.
import json, os, re, unicodedata
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda f: os.path.join(BASE, "datos", f)
DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes"]

def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip()

cat = json.load(open(D("catalogo_fase0.json"), encoding="utf-8"))
recetas = {r["id"]: r for r in json.load(open(D("recetas_f1.json"), encoding="utf-8"))}
menus = json.load(open(D("menus_limpios.json"), encoding="utf-8"))

def ids_en(lista, texto):
    """ids cuyo patron aparece en el texto; si el span de uno esta dentro del de otro, gana el mas largo."""
    hits = []
    for p in lista:
        m = re.search(p["patron"], texto)
        if m: hits.append((p["id"], m.start(), m.end()))
    out = []
    for i, a, b in hits:
        if any((a2 <= a and b <= b2 and (b2 - a2) > (b - a)) for j, a2, b2 in hits if j != i): continue
        out.append(i)
    return out

def tiene(ids, ingrediente):
    return any(i["id"] == ingrediente for pid in ids for i in recetas[pid]["ingredientes"])

def harina(ids, h):
    return any(h in (recetas[pid]["marcas"] or {}).get("harina", []) for pid in ids)

# Casos donde el patron automatico se equivoca: {n_menu: {comida: ids}} (decision documentada)
OVERRIDE = {
    77: {"almuerzo": ["A15", "A18"]},   # "Lentejas o frejol Castillas con tilapia frita": se toma lentejas + pescado frito
}
NOTAS_OVERRIDE = {77: "Dice 'lentejas o fréjol Castilla': se eligió lentejas."}

def quitar(texto, patrones):
    for p in patrones:
        texto = re.sub(p, " ", texto)
    return texto

def comida(n, tipo, original):
    t = norm(original)
    c = dict(platos=[], bebidas=[], frutas=[], acomp=[], nota=original)
    if not t: return c
    if tipo == "desayuno":
        c["platos"] = ids_en(cat["desayunos"], t)
        for gana, pierde in (("D14", "D12"), ("D09", "D28")):   # un plato contiene al otro: se queda el especifico
            if gana in c["platos"] and pierde in c["platos"]: c["platos"].remove(pierde)
        c["bebidas"] = ids_en(cat["bebidas_desayuno"], t)
        if "D10" in c["platos"] and "db9" in c["bebidas"] and not re.search(r"(leche de [a-z0-9 ]+ con avena|y avena|con avena)", t):
            c["bebidas"].remove("db9")          # la avena ya es el plato (avena con manzana)
        if "db8" in c["bebidas"] and len(c["bebidas"]) > 1 and not re.search(r"(leche$|con leche$|y leche$|leche y chocolate|chocolate con leche|leche de vaca|con leche con|leche y)", t):
            c["bebidas"].remove("db8")
    elif tipo == "lonchera":
        c["platos"] = ids_en(cat["loncheras"], t)
        refs = ids_en(cat["refrescos"], t)
        c["bebidas"] = refs
        resto = quitar(t, [r["patron"] for r in cat["refrescos"] if r["id"] in refs])
        c["frutas"] = [f["id"] for f in cat["frutas"] if re.search(f["patron"], resto)]
    else:  # almuerzo
        c["platos"] = ids_en(cat["almuerzos"], t)
        c["bebidas"] = ids_en(cat["refrescos"], t)
    if n in OVERRIDE and tipo in OVERRIDE[n]: c["platos"] = list(OVERRIDE[n][tipo])
    # acompanamientos que el plato no trae incluidos
    if tipo in ("desayuno", "almuerzo"):
        p = c["platos"]
        if re.search(r"\barroz\b", t) and not harina(p, "a"): c["acomp"].append("AC01")
        if tipo == "desayuno" and re.search(r"\b(pan|pancito)\b", t) and not harina(p, "p"): c["acomp"].append("AC12")
        if re.search(r"papa a la huancaina", t) and "A36" not in p: c["acomp"].append("AC03")
        if re.search(r"(papa|papita)s? sancochada", t) and not tiene(p, "papa"): c["acomp"].append("AC02")
        if re.search(r"(papas|papitas) (fritas|doradas)", t) and not tiene(p, "papa"): c["acomp"].append("AC08")
        if "ensalada rusa" in t: pass                                   # ya viene dentro del plato A42
        elif "ensalada de pepino con tomate" in t: c["acomp"].append("AC11")
        elif "ensalada de pepino" in t: c["acomp"].append("AC05")
        elif "ensalada de col" in t: c["acomp"].append("AC06")
        elif "ensalada mixta" in t: c["acomp"].append("AC07")
        elif "ensalada de cebolla" in t and "lechuga" not in t: c["acomp"].append("AC09")
        elif "ensalada" in t or (tipo == "almuerzo" and "lechuga" in t): c["acomp"].append("AC04")   # ensalada comun
    return c

# ---- armar semanas por secuencia lunes -> viernes
validos = [m for m in menus if not any(e.startswith("duplicado") for e in m["estado"]) and m["dia"] in DIAS]
semanas, actual, prev = [], None, -1
for m in validos:
    idx = DIAS.index(m["dia"])
    if actual is None or idx <= prev:
        actual = dict(dias={}, emoji=None, menus=[]); semanas.append(actual)
    prev = idx
    actual["menus"].append(m["n"])
    actual["emoji"] = actual["emoji"] or m["emoji"]
    actual["dias"][m["dia"]] = {t: comida(m["n"], t, m[t]) for t in ("desayuno", "lonchera", "almuerzo")}
    if m["n"] in NOTAS_OVERRIDE: actual["dias"][m["dia"]]["almuerzo"]["nota"] += " [" + NOTAS_OVERRIDE[m["n"]] + "]"
    if m["nota_mama"]: actual["dias"][m["dia"]]["nota_mama"] = m["nota_mama"]

plantillas = []
for k, s in enumerate([x for x in semanas if len(x["dias"]) >= 2], 1):
    plantillas.append(dict(id="P%02d" % k, nombre=("Menú %d %s" % (k, s["emoji"] or "")).strip(), emoji=s["emoji"], dias=s["dias"], menus_origen=s["menus"]))
json.dump(plantillas, open(D("plantillas.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# ---- verificacion: todo id existe y pertenece a la categoria correcta
CAT_OK = {"platos": {"desayuno": "desayuno", "lonchera": "lonchera", "almuerzo": "almuerzo"},
          "bebidas": {"desayuno": "bebida_desayuno", "lonchera": "refresco", "almuerzo": "refresco"},
          "frutas": {"lonchera": "fruta_lonchera"}, "acomp": {"desayuno": "acompanamiento", "almuerzo": "acompanamiento"}}
err = []
for p in plantillas:
    for dia, comidas in p["dias"].items():
        for tipo, c in comidas.items():
            if tipo == "nota_mama": continue
            for campo in ("platos", "bebidas", "frutas", "acomp"):
                for i in c[campo]:
                    if i not in recetas: err.append(f"{p['id']} {dia} {tipo}: id inexistente {i}")
                    elif recetas[i]["categoria"] != CAT_OK[campo].get(tipo): err.append(f"{p['id']} {dia} {tipo}.{campo}: {i} es {recetas[i]['categoria']}")
if err: print("\n".join(err)); raise SystemExit(1)

# ---- reporte para revision humana
nombre = lambda i: recetas[i]["nombre"]
R = ["# Fase 3 – Plantillas de semana traducidas desde tus menús\n",
     f"Plantillas: **{len(plantillas)}** (semanas con 2 o más días). Los menús sin día (n.º {[m['n'] for m in menus if m['dia'] is None]}) no entran en ninguna plantilla.\n"]
sin_plato = []
for p in plantillas:
    R.append(f"\n## {p['id']} – {p['nombre']} ({len(p['dias'])} días; menús {p['menus_origen']})\n")
    R.append("| Día | Comida | Texto original | Plato(s) | Bebida(s) | Frutas | Acomp. |\n|---|---|---|---|---|---|---|")
    for dia, comidas in p["dias"].items():
        for tipo in ("desayuno", "lonchera", "almuerzo"):
            c = comidas[tipo]
            if c["nota"] and not c["platos"]: sin_plato.append((p["id"], dia, tipo, c["nota"]))
            R.append("| %s | %s | %s | %s | %s | %s | %s |" % (dia, tipo, c["nota"], "; ".join(nombre(i) for i in c["platos"]) or "—",
                     "; ".join(nombre(i) for i in c["bebidas"]), "; ".join(nombre(i) for i in c["frutas"]), "; ".join(nombre(i) for i in c["acomp"])))
R.append("\n## Comidas con texto pero SIN plato reconocido\n")
R.append("\n".join(f"- {a} {b} {c}: {d}" for a, b, c, d in sin_plato) or "ninguna")
open(D("fase3_plantillas_reporte.md"), "w", encoding="utf-8").write("\n".join(R))
print("plantillas", len(plantillas), "dias", sum(len(p["dias"]) for p in plantillas), "sin plato:", len(sin_plato))
