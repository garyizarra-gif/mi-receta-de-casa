# Fase 2: copia los datos aprobados a app/data/ y genera los iconos de la PWA.
# Entrada: datos/ingredientes.json, datos/recetas_f1.json. Salida: app/data/*.json, app/icons/*.png
import json, os, shutil
from PIL import Image, ImageDraw
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(BASE, "app")
os.makedirs(os.path.join(APP, "data"), exist_ok=True)
os.makedirs(os.path.join(APP, "icons"), exist_ok=True)

shutil.copyfile(os.path.join(BASE, "datos", "ingredientes.json"), os.path.join(APP, "data", "ingredientes.json"))
shutil.copyfile(os.path.join(BASE, "datos", "plantillas.json"), os.path.join(APP, "data", "plantillas.json"))
# platos: se quitan campos internos que la app no usa
platos = json.load(open(os.path.join(BASE, "datos", "recetas_f1.json"), encoding="utf-8"))
json.dump(platos, open(os.path.join(APP, "data", "platos.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

def icono(tam, ruta, margen=0.0):
    img = Image.new("RGB", (tam, tam), (47, 125, 79))           # verde
    d = ImageDraw.Draw(img)
    c = tam / 2
    m = tam * margen
    r = tam * 0.34
    d.ellipse([c - r, c - r, c + r, c + r], fill=(255, 250, 240))             # plato
    r2 = r * 0.62
    d.ellipse([c - r2, c - r2, c + r2, c + r2], outline=(47, 125, 79), width=max(2, tam // 64))
    # tenedor y cuchara simples a los lados
    w = tam // 40
    d.rounded_rectangle([c - r - tam * 0.12 - w, c - r * 0.8, c - r - tam * 0.12 + w, c + r * 0.8], radius=w, fill=(255, 250, 240))
    d.rounded_rectangle([c + r + tam * 0.12 - w, c - r * 0.8, c + r + tam * 0.12 + w, c + r * 0.8], radius=w, fill=(255, 250, 240))
    img.save(ruta)

icono(192, os.path.join(APP, "icons", "icon-192.png"))
icono(512, os.path.join(APP, "icons", "icon-512.png"))
print("platos", len(platos), "-> app/data/platos.json; iconos listos")
