# Fase 1: ingredientes por porcion para cada plato del catalogo (BORRADOR "estimado", pendiente de aprobacion).
# Entrada: datos/catalogo_fase0.json. Salidas: datos/ingredientes.json, datos/recetas_f1.json, datos/fase1_reporte.md
# Formato de receta: "id cantidad unidad; id cantidad unidad; id" (sin cantidad = basico "al gusto").
# Unidades: g, ml, u. Porcion: adulto (desayuno/almuerzo), nino (lonchera), vaso 250 ml, litro (refrescos), licuado (jarra ~1 L).
import json, os, re, sys
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda f: os.path.join(BASE, "datos", f)

# id|Nombre|Grupo de compra|Unidad de compra|basico(1/0)|peso aprox. de 1 unidad en g (opcional)
MAESTRO = """
zanahoria|Zanahoria|Verduras|kg|0
espinaca|Espinaca|Verduras|atado|0
brocoli|Brócoli|Verduras|kg|0
coliflor|Coliflor|Verduras|kg|0
lechuga|Lechuga|Verduras|u|0|400
tomate|Tomate|Verduras|kg|0|120
cebolla|Cebolla roja|Verduras|kg|0|150
cebolla_china|Cebolla china|Verduras|atado|0
pepino|Pepino|Verduras|u|0|200
apio|Apio|Verduras|atado|0
zapallo|Zapallo|Verduras|kg|0
choclo|Choclo (mazorca)|Verduras|u|0|250
vainita|Vainita|Verduras|kg|0
arveja|Arveja verde (desgranada)|Verduras|kg|0
caigua|Caigua|Verduras|kg|0|75
olluco|Olluco|Verduras|kg|0
pimiento|Pimiento|Verduras|u|0|150
aji_amarillo|Ají amarillo|Verduras|kg|0
aji_panca|Ají panca (pasta)|Abarrotes|frasco|0
repollo|Col / repollo|Verduras|kg|0
betarraga|Betarraga|Verduras|kg|0
culantro|Culantro|Verduras|atado|0
albahaca|Albahaca|Verduras|atado|0
kion|Kion|Verduras|kg|0
limon|Limón|Verduras|kg|0|40
ajo|Ajo|Básicos|cabeza|1
maiz_morado|Maíz morado|Abarrotes|kg|0
hierba_luisa|Hierba luisa|Verduras|atado|0
manzanilla|Manzanilla|Abarrotes|paquete|0
papa|Papa blanca|Tubérculos|kg|0
papa_amarilla|Papa amarilla|Tubérculos|kg|0
camote|Camote|Tubérculos|kg|0
chuno|Chuño|Tubérculos|kg|0
manzana|Manzana|Frutas|kg|0|150
platano|Plátano de seda|Frutas|u|0|120
platano_freir|Plátano de freír|Frutas|u|0|200
mandarina|Mandarina|Frutas|kg|0|90
pina|Piña|Frutas|u|0|1500
mango|Mango|Frutas|u|0|350
uva|Uva|Frutas|kg|0
arandano|Arándano|Frutas|bandeja|0
fresa|Fresa|Frutas|kg|0
pera|Pera|Frutas|kg|0|170
durazno|Durazno|Frutas|kg|0|120
granadilla|Granadilla|Frutas|u|0|100
aguaymanto|Aguaymanto|Frutas|bandeja|0
papaya|Papaya|Frutas|kg|0
higo|Higo|Frutas|kg|0|60
carambola|Carambola|Frutas|kg|0|100
maracuya|Maracuyá|Frutas|kg|0|80
palta|Palta|Frutas|u|0|200
tamarindo|Tamarindo|Frutas|kg|0
guanabana|Guanábana (pulpa)|Frutas|kg|0
pollo|Pollo (pechuga o pierna)|Carnes y pescados|kg|0
alitas|Alitas de pollo|Carnes y pescados|kg|0
res|Carne de res (bistec / guiso)|Carnes y pescados|kg|0
carne_molida|Carne molida|Carnes y pescados|kg|0
cerdo|Cerdo (chuleta)|Carnes y pescados|kg|0
patita|Patita de cerdo|Carnes y pescados|kg|0
costillar|Costillar de cerdo|Carnes y pescados|kg|0
morcilla|Morcilla|Carnes y pescados|kg|0
atun_lata|Atún en lata|Carnes y pescados|lata|0|140
lomo_atun|Lomo de atún|Carnes y pescados|kg|0
pescado|Pescado fresco (tilapia, jurel o bonito)|Carnes y pescados|kg|0
cabeza_pescado|Cabeza de pescado (para chilcano)|Carnes y pescados|u|0|300
huevo|Huevo|Lácteos y huevos|docena|0|55
huevo_codorniz|Huevo de codorniz|Lácteos y huevos|docena|0|12
queso_fresco|Queso fresco|Lácteos y huevos|kg|0
queso_mozzarella|Queso mozzarella|Lácteos y huevos|kg|0
queso_parmesano|Queso parmesano|Lácteos y huevos|paquete|0
leche|Leche|Lácteos y huevos|litro|0
leche_evaporada|Leche evaporada|Lácteos y huevos|lata|0
leche_condensada|Leche condensada|Lácteos y huevos|lata|0
yogurt|Yogurt|Lácteos y huevos|litro|0
mantequilla|Mantequilla|Lácteos y huevos|paquete|0
arroz|Arroz|Menestras y granos|kg|0
lenteja|Lenteja|Menestras y granos|kg|0
frijol_canario|Frijol canario|Menestras y granos|kg|0
frejol_castilla|Fréjol Castilla|Menestras y granos|kg|0
garbanzo|Garbanzo|Menestras y granos|kg|0
arveja_seca|Arveja seca|Menestras y granos|kg|0
quinua|Quinua|Menestras y granos|kg|0
avena|Avena|Menestras y granos|kg|0
cebada|Cebada perlada|Menestras y granos|kg|0
granola|Granola / cereal|Menestras y granos|bolsa|0
haba_seca|Haba seca|Menestras y granos|kg|0
soya|Soya en grano|Menestras y granos|kg|0
almendra|Almendras|Menestras y granos|bolsa|0
mani|Maní|Menestras y granos|kg|0
ajonjoli|Ajonjolí|Menestras y granos|bolsa|0
semillas7|Mezcla de 7 semillas|Menestras y granos|bolsa|0
maca|Maca en polvo|Menestras y granos|bolsa|0
cereales_molidos|Cereales molidos|Menestras y granos|bolsa|0
linaza|Linaza|Menestras y granos|bolsa|0
tallarin|Tallarín|Fideos|paquete|0
fideo_corto|Fideo corto / chino|Fideos|paquete|0
fideo_municion|Fideo munición|Fideos|paquete|0
pan_frances|Pan francés|Panadería|u|0|45
pan_molde|Pan de molde|Panadería|paquete|0
galleta_soda|Galleta de soda|Panadería|paquete|0
harina|Harina de trigo|Abarrotes|kg|0
pan_rallado|Pan rallado|Abarrotes|paquete|0
aceite|Aceite|Básicos|botella|1
sal|Sal|Básicos|bolsa|1
azucar|Azúcar|Básicos|kg|1
canela|Canela|Básicos|paquete|1
vainilla|Esencia de vainilla|Básicos|frasco|1
oregano|Orégano|Básicos|paquete|1
comino|Comino|Básicos|paquete|1
mermelada|Mermelada|Abarrotes|frasco|0
mayonesa|Mayonesa|Abarrotes|frasco|0
ketchup|Ketchup|Abarrotes|frasco|0
crema_choco_mani|Crema de choco maní|Abarrotes|frasco|0
chocolate_polvo|Chocolate en polvo|Abarrotes|bolsa|0
sillao|Sillao (salsa de soya)|Abarrotes|frasco|0
vinagre|Vinagre|Abarrotes|botella|0
pasas|Pasas|Abarrotes|bolsa|0
palillo|Palillo (cúrcuma)|Abarrotes|paquete|0
"""

# id | cantidades. Para platos N** (nuevos) se define abajo el nombre y marcas.
DESAYUNO = """
D01|huevo 2 u; zanahoria 40 g; atun_lata 40 g; palta 40 g; aceite; sal
D02|huevo 2 u; zanahoria 40 g; espinaca 30 g; aceite; sal
D03|huevo 2 u; queso_fresco 30 g; aceite; sal
D04|huevo 2 u; brocoli 60 g; queso_fresco 30 g; aceite; sal
D05|huevo 2 u; zanahoria 30 g; espinaca 30 g; aceite; sal
D06|huevo 2 u; queso_fresco 30 g; papa 100 g; cebolla_china 5 g; aceite; sal
D07|lenteja 40 g; huevo 1 u; cebolla 20 g; aceite; sal
D08|huevo 2 u; atun_lata 40 g; palta 40 g; aceite; sal
D09|morcilla 80 g; camote 120 g; pan_frances 1 u; aceite
D10|avena 40 g; manzana 150 g; canela
D11|papa 150 g; huevo 1 u; queso_fresco 30 g; aji_amarillo 15 g; leche_evaporada 20 ml; galleta_soda 5 g; aceite; sal
D12|papa 150 g; queso_fresco 40 g; huevo 1 u; cebolla_china 10 g; aceite; sal
D13|arroz 60 g; huevo 1 u; platano_freir 100 g; aceite; sal
D14|papa 150 g; harina 20 g; queso_mozzarella 40 g; huevo 1 u; tomate 30 g; oregano; aceite; sal
D15|pan_frances 1 u; palta 60 g; cebolla 10 g; limon 10 g; sal
D16|pan_frances 1 u; palta 60 g; limon 10 g; sal
D17|pan_frances 1 u; huevo 1 u; cebolla 20 g; papa 80 g; aceite; sal
D18|papa 150 g; huevo 1 u; harina 10 g; aceite 30 ml; sal
D19|coliflor 100 g; huevo 1 u; harina 10 g; arroz 60 g; aceite 30 ml; sal
D20|arroz 60 g; atun_lata 50 g; cebolla 20 g; tomate 20 g; aceite; sal
D21|papa 150 g; atun_lata 50 g; cebolla 15 g; limon 10 g; sal
D22|atun_lata 50 g; espinaca 40 g; papa 150 g; cebolla 15 g; aceite; sal
D23|palta 60 g; atun_lata 50 g; pan_frances 1 u; limon 10 g
D24|pan_frances 1 u; atun_lata 50 g; cebolla 15 g; tomate 20 g; mayonesa 10 g
D25|pollo 80 g; apio 20 g; mayonesa 15 g; pan_frances 1 u; sal
D26|chuno 60 g; queso_fresco 40 g; sal
D27|quinua 40 g; manzana 150 g; canela
D28|pan_frances 1 u; camote 120 g; huevo 1 u
D29|harina 40 g; huevo 1 u; zanahoria 40 g; leche 50 ml; queso_mozzarella 30 g; palta 40 g; pollo 40 g; aceite; sal
D30|arroz 80 g; pollo 60 g; huevo 1 u; cebolla_china 10 g; sillao 10 ml; kion 3 g; ajo; aceite
D31|pan_frances 1 u; huevo 1 u; queso_fresco 30 g; aceite
D32|avena 40 g; leche 150 ml; papa 120 g; atun_lata 50 g; huevo 1 u; harina 10 g; aceite 40 ml; sal
"""
BEB_DES = """
db1|soya 25 g
db2|almendra 25 g
db3|ajonjoli 10 g; mani 20 g
db4|haba_seca 25 g
db5|quinua 20 g
db6|leche 250 ml; maca 8 g
db7|semillas7 25 g
db8|leche 250 ml; chocolate_polvo 10 g
db9|avena 25 g; leche 100 ml
db10|chocolate_polvo 20 g
db11|cereales_molidos 25 g
"""
ALMUERZO = """
A01|patita 200 g; mani 30 g; papa 150 g; aji_amarillo 10 g; cebolla 40 g; ajo; aceite; sal
A02|olluco 200 g; queso_fresco 50 g; cebolla 30 g; aji_amarillo 10 g; leche_evaporada 30 ml; ajo; aceite; sal
A03|olluco 200 g; res 100 g; choclo 0.5 u; cebolla 30 g; aji_panca 10 g; tomate 40 g; ajo; aceite; sal
A04|pollo 120 g; pan_molde 25 g; aji_amarillo 25 g; leche_evaporada 50 ml; queso_parmesano 10 g; cebolla 30 g; papa 150 g; ajo; aceite; sal
A05|res 120 g; cebolla 60 g; tomate 60 g; aji_amarillo 10 g; papa 150 g; arroz 70 g; sillao 10 ml; vinagre 10 ml; culantro 5 g; aceite 60 ml; ajo; sal
A06|papa 250 g; mani 40 g; aji_panca 15 g; cebolla 40 g; arroz 70 g; ajo; aceite; sal
A07|lomo_atun 150 g; cebolla 40 g; tomate 50 g; limon 20 g; ajo; aceite; sal
A08|tallarin 100 g; albahaca 20 g; espinaca 60 g; queso_fresco 30 g; leche_evaporada 50 ml; queso_parmesano 10 g; ajo; aceite; sal
A09|zapallo 200 g; papa 80 g; arveja 30 g; cebolla 30 g; ajo; aceite; sal
A10|caigua 150 g; pollo 120 g; papa 100 g; cebolla 30 g; tomate 40 g; aji_amarillo 10 g; culantro 5 g; ajo; aceite; sal
A11|caigua 150 g; carne_molida 80 g; huevo 0.5 u; cebolla 30 g; tomate 30 g; pasas 5 g; pan_molde 12 g; aceite; sal
A12|fideo_corto 30 g; frijol_canario 30 g; zapallo 40 g; zanahoria 30 g; papa 60 g; choclo 0.25 u; repollo 30 g; apio 10 g; cebolla 20 g; queso_parmesano 5 g; albahaca 3 g; ajo; aceite; sal
A13|frijol_canario 70 g; res 120 g; cebolla 30 g; culantro 5 g; ajo; aceite; comino; sal
A14|frejol_castilla 70 g; cerdo 120 g; cebolla 30 g; ajo; comino; aceite; sal
A15|lenteja 70 g; pollo 120 g; cebolla 30 g; zanahoria 30 g; culantro 5 g; ajo; comino; aceite; sal
A16|garbanzo 60 g; carne_molida 100 g; espinaca 80 g; cebolla 30 g; tomate 30 g; ajo; aceite; sal
A17|pescado 150 g; cebolla 50 g; tomate 60 g; aji_amarillo 10 g; culantro 5 g; limon 20 g; ajo; aceite; sal
A18|pescado 150 g; harina 15 g; aceite 60 ml; limon 20 g; arroz 70 g; papa 120 g; sal
A19|pollo 150 g; papa 120 g; choclo 0.5 u; zanahoria 40 g; arveja 20 g; tomate 50 g; cebolla 40 g; ajo; comino; aceite; sal
A20|tallarin 100 g; pollo 80 g; brocoli 40 g; cebolla 30 g; tomate 30 g; pimiento 30 g; sillao 10 ml; kion 3 g; ajo; aceite; sal
A21|arveja_seca 70 g; cebolla 30 g; aji_amarillo 10 g; culantro 5 g; ajo; aceite; sal
A22|pollo 100 g; papa 80 g; fideo_corto 25 g; choclo 0.25 u; zanahoria 30 g; queso_fresco 20 g; cebolla 20 g; apio 10 g; culantro 5 g; ajo; sal
A23|tallarin 100 g; atun_lata 60 g; tomate 100 g; cebolla 30 g; zanahoria 20 g; ajo; oregano; aceite; sal
A24|quinua 50 g; cerdo 120 g; queso_fresco 40 g; cebolla 30 g; zanahoria 30 g; arveja 20 g; leche_evaporada 30 ml; ajo; aceite; sal
A25|arroz 80 g; pollo 120 g; arveja 20 g; zanahoria 20 g; pimiento 20 g; culantro 30 g; cebolla 30 g; aji_amarillo 10 g; ajo; aceite; sal
A26|pollo 150 g; papa 100 g; zanahoria 30 g; cebolla 30 g; ajo; vinagre 10 ml; comino; aceite; sal
A27|pollo 120 g; arveja 70 g; zanahoria 40 g; cebolla 30 g; ajo; aceite; sal
A28|vainita 150 g; pollo 100 g; papa 100 g; cebolla 30 g; tomate 40 g; ajo; aceite; sal
A29|vainita 150 g; cebolla 40 g; tomate 50 g; sillao 5 ml; ajo; aceite; sal
A30|arveja 80 g; pollo 150 g; zanahoria 30 g; cebolla 30 g; papa 100 g; culantro 5 g; ajo; aceite; sal
A31|chuno 50 g; res 80 g; choclo 0.5 u; papa 80 g; cebolla 20 g; ajo; sal
A32|pollo 150 g; culantro 40 g; arveja 20 g; zanahoria 20 g; cebolla 40 g; aji_amarillo 10 g; arroz 70 g; ajo; aceite; sal
A33|coliflor 150 g; res 100 g; papa 100 g; cebolla 30 g; tomate 50 g; aji_panca 10 g; ajo; aceite; sal
A34|costillar 200 g; papa 150 g; arroz 70 g; aceite 50 ml; comino; sal
A35|tallarin 100 g; atun_lata 60 g; tomate 80 g; cebolla 30 g; ajo; aceite; sal
A36|tallarin 100 g; pollo 80 g; arveja 30 g; queso_fresco 30 g; aji_amarillo 15 g; leche_evaporada 30 ml; galleta_soda 5 g; ajo; aceite; sal
A37|papa 200 g; leche 50 ml; mantequilla 10 g; res 150 g; cebolla 30 g; zanahoria 30 g; ajo; aceite; sal
A38|pollo 150 g; cebolla 100 g; aji_amarillo 20 g; vinagre 30 ml; camote 80 g; huevo 1 u; lechuga 20 g; ajo; aceite; sal
A39|quinua 50 g; cerdo 120 g; cebolla 30 g; zanahoria 20 g; ajo; aceite; sal
A40|pollo 150 g; papa 150 g; arroz 70 g; aceite 60 ml; ajo; comino; sal
A41|pollo 150 g; camote 150 g; sillao 15 ml; kion 5 g; cebolla_china 15 g; ajo; aceite; sal
A42|alitas 200 g; papa 100 g; zanahoria 40 g; betarraga 40 g; arveja 20 g; mayonesa 20 g; harina 30 g; aceite 60 ml; sal
A43|pollo 150 g; fideo_municion 25 g; papa 80 g; huevo 1 u; cebolla_china 15 g; apio 10 g; kion 3 g; culantro 5 g; ajo; sal
A44|pollo 120 g; huevo 0.5 u; pan_rallado 30 g; harina 10 g; papa 150 g; arroz 70 g; aceite 70 ml; sal
A45|pollo 120 g; papa 100 g; arveja 20 g; aji_amarillo 15 g; palillo 2 g; cebolla 30 g; ajo; aceite; sal
A46|arveja 80 g; pescado 150 g; zanahoria 30 g; cebolla 30 g; papa 100 g; ajo; aceite; sal
"""
LONCHERA = """
L01|huevo 1 u; queso_fresco 20 g; oregano; aceite; sal
L02|pollo 60 g; papa 80 g; aceite 20 ml; ketchup 10 g; ajo; sal
L03|pan_frances 1 u; pollo 50 g; apio 10 g; mayonesa 10 g
L04|pan_frances 1 u; carne_molida 50 g; lechuga 10 g; aceite; sal
L05|huevo_codorniz 3 u
L06|arroz 50 g; pollo 40 g; huevo 0.5 u; cebolla_china 5 g; sillao 5 ml; aceite
L07|choclo 0.5 u; queso_fresco 25 g; papa_amarilla 60 g
L08|pan_frances 1 u; queso_fresco 25 g
L09|harina 30 g; huevo 0.5 u; leche 60 ml; mermelada 15 g; aceite
L10|leche 100 ml; quinua 20 g; azucar 10 g; canela
L11|arroz 50 g; atun_lata 30 g; huevo 1 u; cebolla 10 g; aceite; sal
L12|huevo 1 u; zanahoria 15 g; queso_fresco 10 g; aceite; sal
L13|huevo 1 u; zanahoria 30 g; crema_choco_mani 10 g; aceite
L14|carne_molida 70 g; pan_frances 1 u; huevo 1 u; cebolla 10 g; aceite; sal
L15|res 70 g; papa 80 g; aceite 30 ml; sal
L16|pollo 70 g; huevo 0.5 u; pan_rallado 15 g; harina 5 g; arroz 40 g; aceite 40 ml; sal
L17|pan_frances 1 u; palta 40 g
L18|pan_frances 1 u; atun_lata 35 g; cebolla 10 g; mayonesa 8 g
L19|pan_frances 1 u; huevo 1 u; aceite
L20|pollo 70 g; pan_frances 1 u; huevo 0.5 u; pan_rallado 15 g; lechuga 15 g; aceite 40 ml; sal
L21|choclo 0.5 u; huevo 0.5 u; harina 10 g; ketchup 10 g; aceite 30 ml
L22|yogurt 150 ml; granola 20 g
L23|manzana 50 g; pina 40 g; platano 0.5 u; granola 15 g
L24|leche 200 ml; arandano 50 g; azucar 5 g
L25|arroz 60 g; huevo 1 u; aceite 20 ml; sal
L26|pan_frances 1 u; mermelada 15 g
L27|fresa 80 g; leche_condensada 20 g
L28|papa 80 g; pollo 60 g; huevo 0.5 u; pan_rallado 15 g; aceite 40 ml; sal
"""
ACOMP = """
AC01|Arroz blanco|arroz 70 g; ajo; aceite; sal
AC02|Papa sancochada|papa 150 g; sal
AC03|Papa a la huancaína|papa 120 g; queso_fresco 30 g; aji_amarillo 15 g; leche_evaporada 20 ml; galleta_soda 5 g; aceite; sal
AC04|Ensalada de lechuga, tomate y cebolla|lechuga 40 g; tomate 50 g; cebolla 20 g; limon 10 g; aceite; sal
AC05|Ensalada de pepino con lechuga y cebolla|pepino 60 g; lechuga 40 g; cebolla 20 g; limon 10 g; sal
AC06|Ensalada de col y zanahoria|repollo 50 g; zanahoria 30 g; limon 10 g; sal
AC07|Ensalada mixta|lechuga 30 g; tomate 40 g; zanahoria 20 g; pepino 30 g; limon 10 g; sal
AC08|Papas fritas|papa 150 g; aceite 50 ml; sal
AC09|Ensalada de cebolla|cebolla 40 g; limon 20 g; aji_amarillo 5 g; sal
AC10|Camote sancochado|camote 150 g
AC11|Ensalada de pepino y tomate|pepino 60 g; tomate 50 g; limon 10 g; sal
AC12|Pan francés (solo)|pan_frances 1 u
"""
FRUTAS = """
f_uva|uva 80 g
f_mandarina|mandarina 100 g
f_pina|pina 80 g
f_mango|mango 80 g
f_platano|platano 1 u
f_arandano|arandano 40 g
f_fresa|fresa 80 g
f_manzana|manzana 120 g
f_pera|pera 120 g
f_durazno|durazno 100 g
f_granadilla|granadilla 1 u
f_aguaymanto|aguaymanto 30 g
f_papaya|papaya 100 g
f_higo|higo 60 g
f_carambola|carambola 80 g
"""
REFRESCOS = """
r01|cebada 40 g; limon 40 g; azucar 30 g; canela
r02|manzana 300 g; azucar 20 g; canela
r03|manzanilla 5 g; azucar 20 g
r04|maiz_morado 150 g; pina 100 g; manzana 150 g; limon 80 g; azucar 80 g; canela
r05|maracuya 200 g; azucar 50 g
r06|pina 250 g; azucar 40 g
r07|mango 350 g; azucar 30 g
r08|carambola 300 g; azucar 40 g
r09|linaza 20 g; limon 120 g; azucar 40 g
r10|hierba_luisa 10 g; azucar 20 g
r11|platano 2 u; leche 500 ml; azucar 20 g
r12|fresa 200 g; leche 500 ml; azucar 30 g
r13|limon 240 g; azucar 80 g
r14|tamarindo 100 g; azucar 80 g
r15|guanabana 250 g; azucar 60 g
"""
LICUADOS = """
c01|papaya 300 g; platano 2 u; leche 500 ml; huevo 1 u; canela; vainilla
c02|platano 3 u; leche 500 ml; huevo 1 u; canela; vainilla
"""
# Platos NUEVOS propuestos por Claude (pescado camuflado, verduras, menestras): id|categoria|nombre|marcas|receta
# marcas: harina(a,f,p,h) pescado(V/C/-) menestra(M) verdura(Vd) camote(Ca)
NUEVOS = """
N01|almuerzo|Chilcano de pescado (con la cabeza)|-|V|-|Vd|-|cabeza_pescado 0.25 u; papa 80 g; cebolla_china 15 g; kion 5 g; aji_amarillo 5 g; culantro 10 g; limon 20 g; ajo; sal
N02|almuerzo|Albóndigas de pescado en salsa de tomate|-|C|-|Vd|-|pescado 100 g; pan_rallado 20 g; huevo 0.5 u; zanahoria 20 g; cebolla 30 g; tomate 60 g; ajo; aceite; sal
N03|almuerzo|Hamburguesa de pescado con papa|-|C|-|-|-|pescado 100 g; papa 60 g; huevo 0.5 u; pan_rallado 15 g; cebolla 20 g; culantro 5 g; aceite 30 ml; sal
N04|almuerzo|Causa de atún con palta|-|C|-|-|-|papa_amarilla 200 g; atun_lata 50 g; palta 40 g; mayonesa 15 g; limon 20 g; aji_amarillo 15 g; aceite; sal
N05|almuerzo|Croquetas de pescado|-|C|-|-|-|pescado 100 g; papa 80 g; huevo 0.5 u; pan_rallado 20 g; cebolla_china 10 g; aceite 50 ml; sal
N06|almuerzo|Arroz chaufa con pescado|a|C|-|-|-|arroz 80 g; pescado 80 g; huevo 1 u; cebolla_china 15 g; sillao 10 ml; kion 5 g; ajo; aceite; sal
N07|desayuno|Panqueque salado de atún|h|C|-|-|-|harina 40 g; huevo 1 u; leche 50 ml; atun_lata 40 g; cebolla_china 5 g; aceite; sal
N08|desayuno|Tortilla de camote y queso|-|-|-|-|Ca|huevo 2 u; camote 100 g; queso_fresco 30 g; aceite; sal
N09|almuerzo|Sopa de lentejas con verduras|-|-|M|Vd|-|lenteja 60 g; zanahoria 30 g; papa 80 g; zapallo 40 g; cebolla 20 g; culantro 5 g; ajo; comino; aceite; sal
N10|lonchera|Tortilla de atún (lonchera)|-|C|-|-|-|huevo 1 u; atun_lata 30 g; cebolla_china 5 g; aceite; sal
"""
REVISAR = {  # platos que el usuario pidio dejar TENTATIVOS (receta de casa desconocida)
    "A21": "Tentativo: no conozco la receta de la casa (teccte de arvejas).",
    "A46": "Tentativo: texto cortado en el menú original ('arverjita verde con pescado …'); lleva arveja.",
}
# Listas de ingredientes CONFIRMADAS por el usuario (las cantidades siguen siendo estimadas).
CONFIRMADOS = {"A06", "A09", "A09B", "A09H", "A38"}
# Variantes: id|plato base|nombre|ingredientes que se SUMAN al plato base
VARIANTES = """
A09B|A09|Locro de zapallo con bistec|res 100 g
A09H|A09|Locro de zapallo con huevo frito|huevo 1 u; aceite 20 ml
"""

def parse(s):
    out = []
    for part in s.split(";"):
        t = part.split()
        if not t: continue
        out.append(dict(id=t[0], cant=float(t[1]) if len(t) > 1 else None, unidad=t[2] if len(t) > 2 else None))
    return out

maestro = {}
for l in MAESTRO.strip().splitlines():
    f = l.split("|")
    maestro[f[0]] = dict(id=f[0], nombre=f[1], grupo=f[2], compra=f[3], basico=f[4] == "1",
                         peso_unidad_g=float(f[5]) if len(f) > 5 and f[5] else None)

# Tamano aproximado de UNA unidad de compra (g o ml) para los que no son kg/u: sirve para decir "2 latas" en vez de "280 g". Son estimados.
TAM_COMPRA = {"espinaca": 250, "cebolla_china": 150, "apio": 200, "culantro": 100, "albahaca": 50, "hierba_luisa": 50,
    "leche_evaporada": 400, "leche_condensada": 400, "arandano": 125, "aguaymanto": 125,
    "aji_panca": 200, "mermelada": 300, "mayonesa": 200, "ketchup": 200, "crema_choco_mani": 350, "sillao": 150,
    "tallarin": 500, "fideo_corto": 250, "fideo_municion": 250, "pan_molde": 500, "galleta_soda": 40, "pan_rallado": 200,
    "queso_parmesano": 100, "mantequilla": 200, "palillo": 50, "manzanilla": 25,
    "granola": 400, "almendra": 100, "ajonjoli": 100, "semillas7": 250, "maca": 100, "cereales_molidos": 250, "linaza": 200,
    "chocolate_polvo": 200, "pasas": 100, "vinagre": 500}
for _k, _v in TAM_COMPRA.items():
    maestro[_k]["peso_unidad_g"] = float(_v)

cat = json.load(open(D("catalogo_fase0.json"), encoding="utf-8"))
nombres = {}; marcas = {}
for k in ("desayunos", "bebidas_desayuno", "almuerzos", "loncheras"):
    for p in cat[k]:
        nombres[p["id"]] = p["nombre"]
        marcas[p["id"]] = dict(harina=p["harina"], pescado=p["pescado"], menestra=p["menestra"], verdura=p["verdura"], camote=p["camote"], proteina=p["proteina"])
for k in ("frutas", "refrescos"):
    for p in cat[k]: nombres[p["id"]] = p["nombre"]
for p in cat["cena_apoyo"]: nombres[p["id"]] = p["nombre"]

def _m(h="", ve=False, ca=False):
    return dict(harina=list(h), pescado="ninguno", menestra=False, verdura=ve, camote=ca, proteina="")
marcas.update({"AC01": _m("a"), "AC02": _m(), "AC03": _m(), "AC04": _m(ve=True), "AC05": _m(ve=True), "AC06": _m(ve=True),
               "AC07": _m(ve=True), "AC08": _m(), "AC09": _m(ve=True), "AC10": _m(ca=True), "AC11": _m(ve=True), "AC12": _m("p")})
recetas = []
def add(txt, categoria, porcion, base="por_persona", nombre_en_linea=False):
    for l in txt.strip().splitlines():
        f = l.split("|")
        if nombre_en_linea: i, n, r = f[0], f[1], f[2]
        else: i, r = f[0], f[1]; n = nombres[i]
        es_nuevo = "NUEVO" in n                                  # el catalogo marca asi los platos pedidos por el usuario
        n = re.sub(r"\s*\(NUEVO[^)]*\)", "", n).strip()
        recetas.append(dict(id=i, categoria=categoria, nombre=n, base=base, porcion=porcion, ingredientes=parse(r),
                            marcas=marcas.get(i), estado="estimado", nuevo=es_nuevo, revisar=REVISAR.get(i),
                            lista_confirmada=i in CONFIRMADOS))
add(DESAYUNO, "desayuno", "adulto")
add(BEB_DES, "bebida_desayuno", "vaso 250 ml")
add(ALMUERZO, "almuerzo", "adulto")
add(LONCHERA, "lonchera", "niño")
add(ACOMP, "acompanamiento", "adulto", nombre_en_linea=True)
add(FRUTAS, "fruta_lonchera", "niño")
add(REFRESCOS, "refresco", "1 litro (4 vasos)", base="por_litro")
add(LICUADOS, "licuado_cena", "1 jarra (~1 litro)", base="por_licuado")
for l in NUEVOS.strip().splitlines():
    i, c, n, h, pe, me, ve, ca, r = l.split("|")
    recetas.append(dict(id=i, categoria=c, nombre=n, base="por_persona", porcion="niño" if c == "lonchera" else "adulto",
        ingredientes=parse(r), marcas=dict(harina=[] if h == "-" else list(h), pescado={"V": "visible", "C": "camuflado", "-": "ninguno"}[pe],
        menestra=me == "M", verdura=ve == "Vd", camote=ca == "Ca", proteina=""), estado="estimado", nuevo=True, revisar=None,
        lista_confirmada=False))
for l in VARIANTES.strip().splitlines():
    i, b, n, extra = l.split("|")
    base = next(r for r in recetas if r["id"] == b)
    recetas.append(dict(base, id=i, nombre=n, ingredientes=base["ingredientes"] + parse(extra), variante_de=b,
                        revisar=None, lista_confirmada=i in CONFIRMADOS))

# ---- verificaciones
err = []
ids = {r["id"] for r in recetas}
esperados = set(nombres)
falta = esperados - ids
if falta: err.append("platos del catalogo SIN receta: %s" % sorted(falta))
for r in recetas:
    for ing in r["ingredientes"]:
        if ing["id"] not in maestro: err.append("%s usa ingrediente inexistente '%s'" % (r["id"], ing["id"]))
        elif ing["cant"] is None and not maestro[ing["id"]]["basico"]: err.append("%s: '%s' sin cantidad y no es basico" % (r["id"], ing["id"]))
        elif ing["cant"] is not None and ing["unidad"] not in ("g", "ml", "u"): err.append("%s: unidad rara %s" % (r["id"], ing))
if len(ids) != len(recetas): err.append("ids de receta duplicados")
if err:
    print("\n".join(err)); sys.exit(1)
usados = {ing["id"] for r in recetas for ing in r["ingredientes"]}
sin_uso = sorted(set(maestro) - usados)

json.dump(list(maestro.values()), open(D("ingredientes.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(recetas, open(D("recetas_f1.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# ---- reporte
def fmt(ing):
    n = maestro[ing["id"]]["nombre"].split(" (")[0]
    if ing["cant"] is None: return n + " (básico)"
    c = ("%g" % ing["cant"])
    return "%s %s %s" % (n, c, ing["unidad"])
TIT = [("desayuno", "Desayunos – plato principal (por adulto)"), ("bebida_desayuno", "Desayunos – bebida (por vaso de 250 ml)"),
       ("almuerzo", "Almuerzos (por adulto, sin acompañamiento salvo que el nombre lo diga)"), ("acompanamiento", "Acompañamientos de almuerzo y desayuno (por adulto)"),
       ("lonchera", "Loncheras – bocado (por niño)"), ("fruta_lonchera", "Loncheras – fruta (por niño)"),
       ("refresco", "Refrescos (por litro, 4 vasos)"), ("licuado_cena", "Cena de apoyo – licuados (por jarra, 1 huevo)")]
R = ["# Fase 1 – Ingredientes por porción (BORRADOR estimado)\n",
     "Todas las cantidades son **estimaciones mías** para **pedir tu corrección**; ninguna cuenta hasta que la apruebes. Agua no se cuenta. Los básicos (aceite, sal, ajo, comino, canela, vainilla, orégano) van 'al gusto' y se manejan en la lista 'ya tengo en casa'.\n",
     "Porciones: desayuno y almuerzo = **adulto**; lonchera = **niño**; refresco = **1 litro**; licuado = **1 jarra (~1 L)**. La cantidad es en crudo.\n",
     f"Recetas: **{len(recetas)}** ({sum(1 for r in recetas if r['nuevo'])} platos nuevos propuestos) · Ingredientes en el maestro: **{len(maestro)}**\n"]
for c, t in TIT:
    rs = [r for r in recetas if r["categoria"] == c]
    R.append(f"\n## {t} – {len(rs)}\n")
    R.append("| ID | Plato | Ingredientes | Nota |\n|---|---|---|---|")
    for r in rs:
        nota = ("**NUEVO** " if r["nuevo"] else "") + (("⚠ " + r["revisar"]) if r["revisar"] else "") + \
               ("✔ lista confirmada por ti" if r.get("lista_confirmada") else "") + (" (variante de %s)" % r["variante_de"] if r.get("variante_de") else "")
        R.append("| %s | %s | %s | %s |" % (r["id"], r["nombre"], " · ".join(fmt(i) for i in r["ingredientes"]), nota))
R.append("\n## Maestro de ingredientes por grupo de compra\n")
grupos = {}
for m in maestro.values(): grupos.setdefault(m["grupo"], []).append(m)
for g, ms in grupos.items():
    R.append(f"- **{g}** ({len(ms)}): " + ", ".join(f"{m['nombre']} [{m['compra']}]" for m in ms))
R.append("\nIngredientes definidos pero sin uso aún: " + (", ".join(sin_uso) if sin_uso else "ninguno"))
open(D("fase1_reporte.md"), "w", encoding="utf-8").write("\n".join(R))
print("recetas", len(recetas), "ingredientes", len(maestro), "sin uso:", sin_uso)
