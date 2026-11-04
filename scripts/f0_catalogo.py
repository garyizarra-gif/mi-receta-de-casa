# Fase 0 - paso 2: catalogo de platos unicos con marcas + control de cobertura.
# Entrada: datos/menus_crudos.json. Salidas: datos/menus_limpios.json, datos/catalogo_fase0.json, datos/fase0_reporte.md
import json, re, os, unicodedata, difflib
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda f: os.path.join(BASE, "datos", f)

def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip()

# harina: a=arroz f=fideo p=pan h=harina(panqueque/pizza/crepa)   pescado: V=visible C=camuflado
def P(i, n, pat, h="", pe="", me=False, ve=False, ca=False, pr=""):
    return dict(id=i, nombre=n, patron=pat, harina=list(h), pescado={"V": "visible", "C": "camuflado", "": "ninguno"}[pe],
                menestra=me, verdura=ve, camote=ca, proteina=pr)

DESAYUNOS = [
 P("D01", "Omelet de zanahoria con atún y palta", r"omelet de zanahoria con atun", "", "C", ve=True, pr="huevo, atún"),
 P("D02", "Omelet de zanahoria y espinaca", r"omelet de zanahoria y espinaca|omelet de zanahoria , espinaca|omelet de espinaca y zanahoria|pan con omelet de zanahoria|omelet de huevo con espinaca", "", ve=True, pr="huevo"),
 P("D03", "Omelet de huevo con queso", r"omelet de (huevo con queso|queso con huevo|huevo y queso)|pan con omelet de huevo y queso", "", pr="huevo, queso"),
 P("D04", "Tortilla de brócoli con queso", r"tortilla de brocoli", "", ve=True, pr="huevo, queso"),
 P("D05", "Tortilla de verduras (zanahoria, espinaca)", r"tortilla de (verduras|zanahoria|espinaca)", "", ve=True, pr="huevo"),
 P("D06", "Tortilla de queso con papa", r"tortilla de queso con papa", "", pr="huevo, queso"),
 P("D07", "Tortilla de lenteja", r"tortilla de lenteja", "", me=True, pr="lenteja, huevo"),
 P("D08", "Tortilla de atún con palta", r"tortilla con atun", "", "C", pr="huevo, atún"),
 P("D09", "Morcilla con camote", r"morcilla", "p", ca=True, pr="morcilla"),
 P("D10", "Avena con manzana", r"^avena con manzana", "", pr=""),
 P("D11", "Papa con huevo y crema (huancaína / pimentón / qapchi = queso, leche y galleta)", r"papa con huevo|huevo con papa|huevo sancochado con papa|sancochado con papa", "", pr="huevo"),
 P("D12", "Papa con queso y huevo (cebollita china)", r"papa con queso", "", pr="huevo, queso"),
 P("D13", "Arroz a la cubana", r"arroz a la cubana", "a", pr="huevo"),
 P("D14", "Pizza de papa", r"pizza (casera )?de papa|papa pizza", "", pr="queso, huevo"),
 P("D15", "Pan con guacamole de palta", r"guacamole", "p", pr=""),
 P("D16", "Pan con crema de palta", r"pan con crema de palta", "p", pr=""),
 P("D17", "Pan rebosado con huevo (cebolla, papa/choclo)", r"pan rebosado", "p", pr="huevo"),
 P("D18", "Papa frita con huevo rebosado", r"papa frita con huevo rebosado", "", pr="huevo"),
 P("D19", "Coliflor rebosado con arroz y huevo", r"coliflor rebosado", "a", ve=True, pr="huevo"),
 P("D20", "Arroz con atún", r"arroz con atun|atun con arroz", "a", "C", pr="atún"),
 P("D21", "Papa con atún (sancochada o frita)", r"papa (frita |sancochada )?con atun|atun rebosado", "", "V", pr="atún"),
 P("D22", "Atún con espinaca y papa", r"espinaca con atun|atun con espinaca", "", "V", ve=True, pr="atún"),
 P("D23", "Palta con atún y pan", r"palta con atun", "p", "V", pr="atún"),
 P("D24", "Pan con atún (cebolla, tomate)", r"pan con atun", "p", "C", pr="atún"),
 P("D25", "Pollo deshilachado con apio y mayonesa (pan)", r"pollo deshilachado con apio", "p", ve=True, pr="pollo"),
 P("D26", "Chuño con queso", r"chuno con", "", pr="queso"),
 P("D27", "Quinua con manzana", r"quinua (entera )?con manzana", "", pr=""),
 P("D28", "Pan con camote", r"pan con camote", "p", ca=True, pr="huevo"),
 P("D29", "Panqueque de zanahoria con queso y palta", r"panqueque de zanahoria", "h", ve=True, pr="queso, pollo"),
 P("D30", "Arroz chaufa con pollito y huevo", r"arroz chaufa", "a", pr="pollo, huevo"),
 P("D31", "Pan con huevo y queso", r"pan con huevo y queso", "p", pr="huevo, queso"),
 P("D32", "Avena con leche y papas fritas con atún rebosado", r"avena con leche con papas fritas", "", "V", pr="atún"),
]
DES_BEB = [
 P("db1", "Leche de soya", r"leche de soya|agua de soya|con soya"),
 P("db2", "Leche de almendras", r"leche de almendra"),
 P("db3", "Leche de ajonjolí con maní", r"ajonjoli|leche de mani"),
 P("db4", "Leche de habas", r"leche de haba|leche con haba"),
 P("db5", "Leche de quinua / agua de quinua tostada", r"leche de quinua|agua de quinua"),
 P("db6", "Leche de maca", r"leche de maca|maca con leche"),
 P("db7", "Leche de 7 semillas", r"7 semillas"),
 P("db8", "Leche de vaca / chocolate con leche", r"leche de vaca|chocolate con leche|leche y chocolate|\bleche\b(?! de | con haba)"),
 P("db9", "Avena (con leche, con chocolate)", r"avena"),
 P("db10", "Agua de chocolate", r"agua de chocolate"),
 P("db11", "Leche de cereales molidos", r"molido de cereales"),
]
ALMUERZOS = [
 P("A01", "Patita con maní", r"patita con mani", pr="patita (cerdo)"),
 P("A02", "Olluco con queso", r"olluco con queso", ve=True, pr="queso"),
 P("A03", "Olluquito con carne y choclo", r"olluquito", ve=True, pr="res"),
 P("A04", "Ají de gallina", r"aji de gallina", "p", pr="pollo"),
 P("A05", "Lomo saltado", r"lomo saltado", "a", ve=True, pr="res"),
 P("A06", "Puca picante (sin chicharrón)", r"pica picante|puca picante", "a"),
 P("A07", "Lomo de atún", r"lomo de atun", "", "V", pr="atún"),
 P("A08", "Tallarín verde con papa a la huancaína", r"tallarin verde", "f", ve=True, pr="queso"),
 P("A09", "Locro de zapallo", r"locro de zapallo", ve=True, pr="res/huevo"),
 P("A10", "Guiso de caigua con pollo", r"guiso de caigua", ve=True, pr="pollo"),
 P("A11", "Caigua rellena", r"caigua rellena", ve=True, pr="carne"),
 P("A12", "Sopa de menestrón", r"menestron", "f", me=True, ve=True),
 P("A13", "Frijol canario con bisteck", r"frijol canario", me=True, pr="res"),
 P("A14", "Fréjol Castilla con chuleta o pollo", r"(frejol|frijol) castilla", me=True, pr="cerdo/pollo"),
 P("A15", "Lentejas con pollo o carne", r"lentejas|lentejita", me=True, pr="pollo/cerdo"),
 P("A16", "Garbanzo con carne picada y espinaca", r"garbanzo", me=True, ve=True, pr="res"),
 P("A17", "Sudado de pescado", r"sudado de pescado", "", "V", ve=True, pr="pescado"),
 P("A18", "Pescado frito con arroz y papa", r"pescado frito|tilapia frita", "a", "V", pr="pescado"),
 P("A19", "Estofado de pollo y choclo", r"estofado de pollo", pr="pollo"),
 P("A20", "Tallarín saltado", r"tallarin saltado", "f", ve=True, pr="pollo"),
 P("A21", "Teccte de arvejas", r"teccte", me=True),
 P("A22", "Sopa de pollo (papita, choclo, queso)", r"sopa de pollo", "f", ve=True, pr="pollo"),
 P("A23", "Tallarín rojo con atún", r"tallarin rojo", "f", "C", pr="atún"),
 P("A24", "Guiso de quinua con queso y chuleta frita", r"guiso de quinua", pr="cerdo, queso"),
 P("A25", "Arroz con pollo", r"arroz con pollo", "a", ve=True, pr="pollo"),
 P("A26", "Asado de pollo", r"asado de pollo", pr="pollo"),
 P("A27", "Lomito de pollo con alverjita", r"lomito de pollo", ve=True, pr="pollo"),
 P("A28", "Guiso de vainita con pollo o carne", r"guiso de vainita", ve=True, pr="pollo/res"),
 P("A29", "Vainita saltada", r"vainita saltada", ve=True),
 P("A30", "Alverjita verde con pollo asado", r"(alverjita|arverjita|alverja|arverja)s? (verde )?con pollo", ve=True, pr="pollo"),
 P("A31", "Sopa de chuño con carne y choclo", r"sopa de chuno", pr="res"),
 P("A32", "Seco de pollo", r"seco de pollo", "a", pr="pollo"),
 P("A33", "Guiso de coliflor con carne", r"guiso de coliflor", ve=True, pr="res"),
 P("A34", "Costillar frito con papas doradas", r"costillar", "a", pr="cerdo"),
 P("A35", "Tallarín con atún", r"tallarin con atun", "f", "C", pr="atún"),
 P("A36", "Tallarín con pollo, arvejita y huancaína", r"tallarin con pollo", "f", ve=True, pr="pollo"),
 P("A37", "Puré con asado", r"pure con asado", pr="res"),
 P("A38", "Escabeche de pollo", r"escabeche de pollo", ve=True, pr="pollo"),
 P("A39", "Quinua con chuleta", r"quinua con chuleta", pr="cerdo"),
 P("A40", "Pollo dorado con papas fritas y arroz", r"pollo dorado", "a", pr="pollo"),
 P("A41", "Pollo al sillao con camotes", r"pollo al sillas|pollo al sillao", ca=True, pr="pollo"),
 P("A42", "Ensalada rusa con alitas broaster", r"ensalada rusa", ve=True, pr="pollo"),
 P("A43", "Caldo de gallina (con sopa munición)", r"caldo de (pollo|gallina)", "f", pr="pollo"),
 P("A44", "Apanado con papas fritas y arroz", r"apanado con papas", "a", pr="pollo/carne"),
 P("A45", "Cau cau de pollo", r"cau cau", pr="pollo"),
 P("A46", "Arverjita verde con pescado (texto cortado)", r"con pescado", "", "V", ve=True, pr="pescado"),
]
BOCADOS = [
 P("L01", "Tortilla con queso y orégano", r"tortilla con queso", pr="huevo, queso"),
 P("L02", "Pollo deshilachado/dorado con papitas", r"pollo (deshilachado )?dorado|pollo dorado deshilachado|pollo deshilachado dorado", pr="pollo"),
 P("L03", "Pan con pollo (plancha o con apio y mayonesa)", r"pan (tostada |tostado )?con pollo|pollito a la plancha|tostado con pollo", "p", pr="pollo"),
 P("L04", "Pan con bisteck / carne molida", r"pan con (carne molida|bisteck)", "p", pr="res"),
 P("L05", "Huevo de codorniz", r"codorniz", pr="huevo"),
 P("L06", "Arroz chaufa con pollito", r"arroz chaufa", "a", pr="pollo, huevo"),
 P("L07", "Choclo con queso y papita", r"choclo con queso", pr="queso"),
 P("L08", "Pan con queso (o queso pizza)", r"pan con queso|queso pizza|con queso y pancito|pan tostado con queso", "p", pr="queso"),
 P("L09", "Panqueque / crepa (mermelada, maní, plátano, arándanos...)", r"panqueque|crepa", "h"),
 P("L10", "Mazamorra (quinua, arroz con leche, piña, mango)", r"mazamorra"),
 P("L11", "Arroz con atún revuelto", r"arroz con atun", "a", "C", pr="atún"),
 P("L12", "Omelet de huevo (queso, zanahoria, atún)", r"omelet", ve=True, pr="huevo"),
 P("L13", "Tortilla de zanahoria con crema de choco maní", r"tortilla de zanahoria", ve=True, pr="huevo"),
 P("L14", "Hamburguesa (con huevo frito)", r"hamburguesa", "p", pr="res"),
 P("L15", "Bisteck con papitas doradas", r"bisteck con papit|papita amarilla sancochada con bisteck", pr="res"),
 P("L16", "Apanado (con arroz o con pan y papitas)", r"apanado", "a", pr="pollo/carne"),
 P("L17", "Pan con guacamole / pan con palta", r"pan con guacamole|pan con palta|pan con crema de palta", "p"),
 P("L18", "Pan con atún y cebollita", r"pan con atun", "p", "C", pr="atún"),
 P("L19", "Pan con huevo frito", r"pan con huevo frito", "p", pr="huevo"),
 P("L20", "Milanesa de pollo con pan y lechuga", r"milanesa", "p", ve=True, pr="pollo"),
 P("L21", "Choclo rebosado con huevo", r"choclo rebosado", pr="huevo"),
 P("L22", "Yogurt con cereal / granola / quinua", r"yogurt|yogur", pr="yogurt"),
 P("L23", "Ensalada de frutas con granola", r"ensalada de frutas"),
 P("L24", "Batido de leche con arándanos", r"batido", pr="leche"),
 P("L25", "Arroz con huevo frito", r"arroz con huevo frito", "a", pr="huevo"),
 P("L26", "Pan tostado con mermelada o crema de queso", r"pan (tostada |tostado |blanco tostado )?con (mermelada|crema de queso)", "p"),
 P("L27", "Fresas con leche condensada", r"leche condensada"),
 P("L28", "Papa con apanado", r"papa con apanado", pr="pollo/carne"),
]
FRUTAS = {"uva": "Uva", "mandarina": "Mandarina", "pina": "Piña", "mango": "Mango", "platano": "Plátano", "arandano": "Arándano",
          "fresa": "Fresa", "manzana": "Manzana", "pera": "Pera", "durazno": "Durazno", "granadilla": "Granadilla",
          "aguaymanto": "Aguaymanto", "papaya": "Papaya", "higo": "Higo", "carambola": "Carambola"}
REFRESCOS = [
 ("r01", "Agua de cebada", r"cebada"), ("r02", "Agua de manzana", r"agua de manzana\b|manzana licuada|manzana rallada"),
 ("r03", "Agua de manzanilla", r"manzanilla"), ("r04", "Chicha morada", r"chicha"),
 ("r05", "Refresco / agua de maracuyá", r"maracuya"), ("r06", "Agua de piña", r"agua de pina"),
 ("r07", "Agua de mango", r"agua de mango"), ("r08", "Agua de carambola", r"carambola"),
 ("r09", "Agua de linaza y limón", r"linaza"), ("r10", "Agua de hierbas", r"hierbas"),
 ("r11", "Jugo de plátano con leche", r"jugo de platano( con leche)?"), ("r12", "Jugo de leche con fresa", r"jugo de leche( con fresas?)?"),
 ("r13", "Limonada (NUEVO, pedido por ti)", r"$^"), ("r14", "Agua de tamarindo (NUEVO)", r"$^"), ("r15", "Agua de guanábana (NUEVO)", r"$^"),
]
CENA = [
 ("c01", "Licuado de papaya con plátano, 1 huevo, canela y vainilla (NUEVO)"),
 ("c02", "Licuado de plátano (seda/morado/común) con leche, 1 huevo, canela y vainilla (NUEVO)"),
]

menus = json.load(open(D("menus_crudos.json"), encoding="utf-8"))
vistos, limpios = {}, []
for m in menus:
    key = (norm(m["desayuno"]), norm(m["lonchera"]), norm(m["almuerzo"]))
    est = []
    if not all(key):
        est.append("incompleto")
    elif key in vistos:
        est.append("duplicado_exacto_de_%d" % vistos[key])
    else:
        vistos[key] = m["n"]
        for o in limpios:
            ok = (norm(o["desayuno"]), norm(o["lonchera"]), norm(o["almuerzo"]))
            if all(ok) and not any(e.startswith("duplicado") for e in o["estado"]) and \
               difflib.SequenceMatcher(None, " ".join(key), " ".join(ok)).ratio() > .93:
                est.append("casi_igual_a_%d" % o["n"]); break
    limpios.append(dict(m, estado=est))
json.dump(limpios, open(D("menus_limpios.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
utiles = [m for m in limpios if not any(e.startswith("duplicado") for e in m["estado"])]

def contar(cat, campo):
    res, sin = [dict(p, veces=0) for p in cat], []
    for m in utiles:
        t = norm(m[campo])
        if not t:
            continue
        hit = False
        for r in res:
            if re.search(r["patron"], t):
                r["veces"] += 1; hit = True
        if not hit:
            sin.append((m["n"], m[campo]))
    return res, sin

des, des_sin = contar(DESAYUNOS, "desayuno")
alm, alm_sin = contar(ALMUERZOS, "almuerzo")
lon, lon_sin = contar(BOCADOS, "lonchera")
bebd, _ = contar(DES_BEB, "desayuno")
fr = [dict(id="f_" + k, nombre=v, patron=k, veces=sum(1 for m in utiles if re.search(k, norm(m["lonchera"])))) for k, v in FRUTAS.items()]
ref = [dict(id=i, nombre=n, nuevo="NUEVO" in n, patron=pat,
            veces=sum(1 for m in utiles if re.search(pat, norm(m["lonchera"]) + " " + norm(m["almuerzo"])))) for i, n, pat in REFRESCOS]
cat = dict(desayunos=des, bebidas_desayuno=bebd, almuerzos=alm, loncheras=lon, frutas=fr, refrescos=ref,
           cena_apoyo=[dict(id=i, nombre=n) for i, n in CENA])
json.dump(cat, open(D("catalogo_fase0.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

M = lambda b: "sí" if b else ""
def tabla(items, cols):
    out = ["| " + " | ".join(c[0] for c in cols) + " |", "|" + "---|" * len(cols)]
    for it in items:
        out.append("| " + " | ".join(str(c[1](it)) for c in cols) + " |")
    return "\n".join(out)
plato_cols = [("ID", lambda x: x["id"]), ("Plato", lambda x: x["nombre"]), ("Veces", lambda x: x["veces"]),
  ("Harina", lambda x: ",".join(x["harina"])), ("Pescado", lambda x: "" if x["pescado"] == "ninguno" else x["pescado"]),
  ("Menestra", lambda x: M(x["menestra"])), ("Verdura", lambda x: M(x["verdura"])), ("Camote", lambda x: M(x["camote"])),
  ("Proteína", lambda x: x["proteina"])]
nd = sum(1 for m in limpios if any(e.startswith("duplicado") for e in m["estado"]))
ni = [m["n"] for m in limpios if "incompleto" in m["estado"]]
srt = lambda c: sorted(c, key=lambda x: -x["veces"])
R = ["# Fase 0 – Menús limpios y catálogo de platos únicos\n",
 f"Menús diarios leídos: **{len(limpios)}** · duplicados exactos descartados: **{nd}** · incompletos: **{len(ni)}** (n.º {ni}) · menús útiles: **{len(utiles)}**\n",
 "Harina: a=arroz, f=fideo, p=pan, h=harina (panqueque/pizza/crepa). Pescado: visible o camuflado. *Todas las marcas son propuestas por aprobar.*\n",
 f"## Desayunos – platos principales ({len(des)})\n", tabla(srt(des), plato_cols),
 f"\n## Desayunos – bebidas ({len(bebd)})\n", tabla(bebd, [("ID", lambda x: x["id"]), ("Bebida", lambda x: x["nombre"]), ("Veces", lambda x: x["veces"])]),
 f"\n## Almuerzos ({len(alm)})\n", tabla(srt(alm), plato_cols),
 f"\n## Loncheras – bocados ({len(lon)})\n", tabla(srt(lon), plato_cols),
 "\n## Loncheras – frutas\n", tabla(srt(fr), [("Fruta", lambda x: x["nombre"]), ("Veces", lambda x: x["veces"])]),
 "\n## Refrescos (almuerzo y lonchera)\n", tabla(ref, [("ID", lambda x: x["id"]), ("Refresco", lambda x: x["nombre"]), ("Veces en tus menús", lambda x: x["veces"])]),
 "\n## Cena de apoyo (licuados)\n", "\n".join(f"- {n}" for _, n in CENA),
 "\n## Control de cobertura (comidas que ningún patrón reconoció)\n",
 f"- Desayunos sin clasificar: {des_sin}", f"- Almuerzos sin clasificar: {alm_sin}", f"- Loncheras sin clasificar: {lon_sin}"]
open(D("fase0_reporte.md"), "w", encoding="utf-8").write("\n".join(R))
print("utiles", len(utiles), "dup", nd, "inc", ni)
print("SIN CLASIFICAR desayuno:", des_sin)
print("SIN CLASIFICAR almuerzo:", alm_sin)
print("SIN CLASIFICAR lonchera:", lon_sin)
print("0 veces:", [r["id"] for c in (des, alm, lon, bebd) for r in c if r["veces"] == 0])
