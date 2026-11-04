# Fase 0 - paso 1: extrae el texto de las dos fuentes y separa cada menu diario.
# Solo lectura sobre los originales. Salida: datos/menus_crudos.json
import zipfile, re, json, os, pdfplumber
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCX = os.path.join(BASE, "RECETAS DE LA SEMANA.docx")
PDF  = os.path.join(BASE, "RELACION DE COMIDA PARA COCINAR DE LUNES A VIERNES.pdf")

def lineas_docx():
    x = zipfile.ZipFile(DOCX).read("word/document.xml").decode("utf8")
    for p in re.findall(r"<w:p[ >].*?</w:p>", x, flags=re.S):
        yield "".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", p, flags=re.S))

def lineas_pdf():
    for pg in pdfplumber.open(PDF).pages:
        for l in (pg.extract_text() or "").split("\n"):
            yield l

STAMP = re.compile(r"^\[\d{1,2}:\d{2}[^\]]*\]\s*Roger Ir:\s*")
DIA = re.compile(r"^\W*(lunes|martes|mi[eé]rcoles|jueves|viernes)\W*$", re.I)
CLAVE = re.compile(r"^\W*(desayuno|lonchera|almuerzo)\s*:?\s*(.*)$", re.I)
EMO = re.compile(r"[\U0001F300-\U0001FAFF]")

def parsear(fuente, lineas):
    menus, cur = [], None
    ult = None  # (menu, clave)
    emoji = None
    def nuevo(dia=None):
        nonlocal cur
        cur = {"fuente": fuente, "dia": dia, "emoji": emoji, "desayuno": "", "lonchera": "", "almuerzo": ""}
        menus.append(cur)
    for raw in lineas:
        l = STAMP.sub("", raw.strip())
        if not l or l.startswith("RELACION DE COMIDA"): continue
        m = EMO.search(l)
        d = DIA.match(l)
        if d:
            if m: emoji = m.group(0)
            nuevo(d.group(1).lower().replace("é","e")); ult = None; continue
        k = CLAVE.match(l)
        if k:
            clave = k.group(1).lower()
            if cur is None or cur[clave]:
                nuevo(None)
            cur[clave] = k.group(2).strip(); ult = clave; continue
        if re.match(r"^para mañana", l, re.I):  # mensaje sin dia
            nuevo(None); l = re.sub(r"^para mañana:\s*", "", l, flags=re.I)
            k2 = CLAVE.match(l)
            if k2: cur[k2.group(1).lower()] = k2.group(2).strip(); ult = k2.group(1).lower()
            continue
        if cur is not None and ult:  # linea de continuacion
            cur[ult] = (cur[ult] + " " + l).strip()
    return menus

menus = parsear("docx", lineas_docx()) + parsear("pdf", lineas_pdf())
# separar "para mi mama"
for i, m in enumerate(menus, 1):
    m["n"] = i
    m["nota_mama"] = ""
    for c in ("desayuno","lonchera","almuerzo"):
        t = m[c]
        s = re.split(r"\.?\s*Para m[ií] m[aá]m[aá]\s*:?\s*", t, maxsplit=1, flags=re.I)
        if len(s) == 2:
            m[c], m["nota_mama"] = s[0].strip(" .,"), (m["nota_mama"] + " " + s[1]).strip()
        m[c] = re.sub(r"\s+(?:y|con)\s+fodge\b", "", m[c], flags=re.I)  # "fodge" fue un error de digitacion (confirmado por el usuario)
        m[c] = re.sub(r"\s+", " ", m[c]).strip(" .,")
json.dump(menus, open(os.path.join(BASE, "datos", "menus_crudos.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(menus), "menus")
inc = [m["n"] for m in menus if not (m["desayuno"] and m["lonchera"] and m["almuerzo"])]
print("incompletos (falta alguna comida):", inc)
