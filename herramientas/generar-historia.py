"""Genera la composición HyperFrames de un reel "historia de marca" (formato Gymshark v5).

Uso:  python herramientas/generar-historia.py reels/<slug>/composicion/vN reels/<slug>/historia.json

Formato (fijado por el creador):
- B-roll de la marca (videos y fotos) a pantalla completa de inicio a fin.
- El creador recortado (sin fondo) en la esquina inferior derecha al 50 %, nunca en plano completo y nunca volteado.
- Subtítulos encima de su cabeza (centro y = 880); en los tramos de `subtitulos_altos`, a y = 600.
- Tarjeta blanca del hook (marca + dato), como en la referencia de Bloom. Sin contadores, títulos ni gráficos.

historia.json:
{
  "duracion": 53.03,                                   # = duración del clip (ffprobe)
  "hook": {"fin": 4.61, "marca": "Gymshark", "dato": "$40.000 en solo 30 minutos"},
  "fondos": [                                          # contiguos de 0 a duracion, sin huecos
    {"id": "hook-logo", "archivo": "v1.mp4", "inicio": 0, "fin": 4.61, "desde": 0, "velocidad": 0.92},
    {"id": "ben", "archivo": "2-ben-gshq.jpg", "inicio": 4.61, "fin": 6.80}
  ],
  "subtitulos": [[0.01, 1.30, "Esta marca pasó de vender"], ...],
  "subtitulos_altos": [[0, 4.61]],                     # tramos con un logo o texto del B-roll a la altura de 880
  "sin_partir": ["e-commerce"]                         # palabras con guion que no se parten entre líneas
}
Los archivos de los fondos se buscan en reels/<slug>/assets/ (cualquier subcarpeta).
El recorte del creador debe estar en reels/<slug>/recorte/clip-recorte.webm.
"""
import json, re, shutil, sys
from pathlib import Path

P = Path(sys.argv[1])
H = json.loads(Path(sys.argv[2]).read_text(encoding="utf8"))
R = P.parent.parent  # reels/<slug>
RAIZ = R.parent.parent
def _carpeta_perfil():
    # Misma regla que herramientas/perfiles.mjs: reel.json → perfil; sin reel.json, "andres".
    rj = R / "reel.json"
    pid = json.loads(rj.read_text(encoding="utf8")).get("perfil") if rj.exists() else "andres"
    idx = RAIZ / "perfiles" / "indice.json"
    lista = json.loads(idx.read_text(encoding="utf8"))["perfiles"] if idx.exists() else [{"id": "andres", "ruta": "marca"}]
    p = next((x for x in lista if x["id"] == pid), None)
    if not p:
        raise SystemExit(f"✗ No existe el perfil «{pid}».")
    return RAIZ / p["ruta"]

BRAND = json.loads((_carpeta_perfil() / "brand.json").read_text(encoding="utf8"))
DUR = H["duracion"]
FONT = BRAND["fuentes"]["subtitulos"]["familia"]
W8 = BRAND["fuentes"]["subtitulos"]["peso"]
SHADOW = "0 3px 10px rgba(0,0,0,.45), 0 0 28px rgba(0,0,0,.3)"
STROKE = f'-webkit-text-stroke: {BRAND["subtitulos"]["contorno_px"] * 2}px {BRAND["colores"]["contorno"]}; paint-order: stroke fill;'
IMG = {".jpg", ".jpeg", ".png", ".webp"}
VID = {".mp4", ".mov", ".webm", ".m4v"}
SUB_Y_ESQUINA = 880  # encima de la cabeza del creador (≈ 1065)
SUB_Y_ALTO = 600     # sobre un logo o texto del B-roll a la altura de 880
ESQUINA = {"origin": "1080px 1920px", "scale": 0.5}

def falla(msg):
    sys.exit(f"✗ {msg}")

# ---------- assets ----------
(P / "compositions").mkdir(parents=True, exist_ok=True)
(P / "assets/img").mkdir(parents=True, exist_ok=True)
(P / "assets/video").mkdir(parents=True, exist_ok=True)
disponibles = {f.name: f for f in (R / "assets").rglob("*") if f.is_file()}
recorte = R / "recorte/clip-recorte.webm"
if not recorte.exists():
    falla(f"falta {recorte} (npx --yes hyperframes@0.9.5 remove-background entrada/clip.mp4 -o recorte/clip-recorte.webm)")
shutil.copy2(recorte, P / "assets/clip-recorte.webm")

# ---------- fondos ----------
fondos = sorted(H["fondos"], key=lambda f: f["inicio"])
t = 0.0
for f in fondos:
    if abs(f["inicio"] - t) > 0.011:
        falla(f'hueco o solape antes de "{f["id"]}" ({t} → {f["inicio"]}): el fondo debe cubrir todo el video')
    t = f["fin"]
if abs(t - DUR) > 0.011:
    falla(f"los fondos terminan en {t} y el clip dura {DUR}")

html, js = [], []
for f in fondos:
    fid, arch, a, b = f["id"], f["archivo"], f["inicio"], f["fin"]
    if arch not in disponibles:
        falla(f'no encuentro "{arch}" en {R / "assets"}')
    ext = Path(arch).suffix.lower()
    d = round(b - a, 3)
    if ext in IMG:
        shutil.copy2(disponibles[arch], P / "assets/img" / arch)
        html.append(f'    <div id="f-{fid}" class="clip fondo" data-start="{a}" data-duration="{d}">\n'
                    f'      <div id="f-{fid}-kb" class="kb"><img src="assets/img/{arch}" data-var-src="foto_{fid.replace("-", "_")}" alt="" /></div>\n    </div>')
        js.append(f'  tl.fromTo("#f-{fid}-kb", {{scale: 1.0}}, {{scale: 1.07, duration: {d}, ease: "none"}}, {a});')
    elif ext in VID:
        shutil.copy2(disponibles[arch], P / "assets/video" / arch)
        rate = f' data-playback-rate="{f["velocidad"]}"' if f.get("velocidad") else ""
        html.append(f'    <div id="f-{fid}" class="fondo-wrap">\n'
                    f'      <video id="f-{fid}-v" class="clip fondo" src="assets/video/{arch}" muted playsinline '
                    f'data-start="{a}" data-duration="{d}" data-media-start="{f.get("desde", 0)}"{rate}></video>\n    </div>')
    else:
        falla(f'"{arch}": formato no soportado')

(P / "compositions/fondos.html").write_text(f"""<template>
  <style>
    #root {{ position: absolute; inset: 0; }}
    .fondo-wrap {{ position: absolute; inset: 0; }}
    .fondo {{ position: absolute; inset: 0; width: 1080px; height: 1920px; overflow: hidden; object-fit: cover; background: #000; }}
    .kb {{ position: absolute; inset: 0; transform-origin: 50% 40%; }}
    .kb img {{ width: 100%; height: 100%; object-fit: cover; display: block; }}
  </style>
  <div id="root" data-composition-id="fondos" data-width="1080" data-height="1920" data-layout-allow-overlap>
{chr(10).join(html)}
  </div>
  <script>
  const tl = gsap.timeline({{ paused: true }});
{chr(10).join(js)}
  window.__timelines["fondos"] = tl;
  </script>
</template>
""", encoding="utf8")

# ---------- tarjeta del hook (visible desde el fotograma 0: es la miniatura) ----------
hk = H["hook"]
(P / "compositions/graficos.html").write_text(f"""<template>
  <style>
    #root {{ position: absolute; inset: 0; }}
    #g0 {{ position: absolute; left: 60px; width: 880px; top: 250px; height: 200px; display: flex; justify-content: center;
          font-family: "{FONT}", sans-serif; font-weight: {W8}; text-align: center; }}
    #g0-card {{ background: #fff; color: #0b0b0d; border-radius: 26px; padding: 22px 40px 24px; box-shadow: 0 10px 30px rgba(0,0,0,.35); }}
    #g0-card .marca {{ font-size: 60px; line-height: 1.05; }}
    #g0-card .dato {{ font-size: 46px; line-height: 1.15; margin-top: 6px; }}
  </style>
  <div id="root" data-composition-id="graficos" data-width="1080" data-height="1920">
    <div id="g0" class="clip" data-start="0" data-duration="{hk["fin"]}">
      <div id="g0-card"><div class="marca" data-var-text="hook_marca">{hk["marca"]}</div><div class="dato" data-var-text="hook_dato">{hk["dato"]}</div></div>
    </div>
  </div>
  <script>
  const tl = gsap.timeline({{ paused: true }});
  window.__timelines["graficos"] = tl;
  </script>
</template>
""", encoding="utf8")

# ---------- subtítulos ----------
s = BRAND["subtitulos"]
grupos = H["subtitulos"]
altos = H.get("subtitulos_altos", [])
def alto(a):
    return any(x <= a < y for x, y in altos)

divs, js = [], []
for i, (a, b, txt) in enumerate(grupos):
    nxt = grupos[i + 1][0] if i + 1 < len(grupos) else DUR
    b = min(b, nxt, DUR)
    d = round(b - a, 3)
    for w in H.get("sin_partir", []):
        txt = txt.replace(w, f'<span class="nw">{w}</span>')
    clase = " alto" if alto(a) else ""
    divs.append(f'    <div id="sub-{i:02d}" class="clip subtitulo{clase}" data-start="{a}" data-duration="{d}"><span>{txt}</span></div>')
    if i > 0:
        js.append(f'  tl.fromTo("#sub-{i:02d} > span", {{opacity: 0, y: 8}}, {{opacity: 1, y: 0, duration: 0.15, ease: "power2.out"}}, {a});')
    if i + 1 < len(grupos):
        js.append(f'  tl.to("#sub-{i:02d} > span", {{opacity: 0, duration: 0.08, ease: "power2.in"}}, {round(b - 0.08, 3)});')

(P / "compositions/subtitulos.html").write_text(f"""<template>
  <style>
    #root {{ position: absolute; inset: 0; }}
    .subtitulo {{
      position: absolute; left: 0; right: 0; top: {SUB_Y_ESQUINA - 110}px; height: 220px;
      display: flex; align-items: center; justify-content: center; overflow: visible;
    }}
    .subtitulo.alto {{ top: {SUB_Y_ALTO - 110}px; }}
    .subtitulo .nw {{ white-space: nowrap; }}
    .subtitulo span {{
      display: inline-block; max-width: {s["ancho_max_px"]}px; text-align: center;
      font-family: "{FONT}", sans-serif; font-weight: {W8}; font-size: {s["tamano_base_px"]}px; line-height: 1.12;
      color: {BRAND["colores"]["principal"]}; text-shadow: {SHADOW}; {STROKE}
    }}
  </style>
  <div id="root" data-composition-id="subtitulos" data-width="1080" data-height="1920">
{chr(10).join(divs)}
  </div>
  <script>
  const tl = gsap.timeline({{ paused: true }});
{chr(10).join(js)}
  window.__timelines["subtitulos"] = tl;
  </script>
</template>
""", encoding="utf8")

# ---------- index ----------
def host(cid, z, track, kind):
    return f"""      <div
        id="{cid}"
        data-composition-id="{cid}"
        data-composition-src="compositions/{cid}.html"
        data-start="0"
        data-duration="{DUR}"
        data-track-index="{track}"
        data-track-kind="{kind}"
        data-width="1080"
        data-height="1920"
        style="z-index: {z}"
      ></div>"""

idx = (P / "index.html").read_text(encoding="utf8")
body = f"""    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="{DUR}"
      data-width="1080"
      data-height="1920"
    >
      <div id="aroll-wrap" style="position: absolute; inset: 0; z-index: 0; overflow: hidden">
        <video
          id="a-roll"
          class="clip"
          src="clip.mp4"
          playsinline
          data-start="0"
          data-duration="{DUR}"
          data-track-index="0"
          data-has-audio="true"
          style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover"></video>
      </div>
{host("fondos", 1, 1, "graphics")}
      <div id="persona" style="position: absolute; inset: 0; z-index: 2">
        <!-- nunca voltear: el creador se ve siempre como en su clip original -->
        <video
          id="recorte"
          class="clip"
          src="assets/clip-recorte.webm"
          muted
          playsinline
          data-start="0"
          data-media-start="0"
          data-duration="{DUR}"
          data-track-index="2"
          style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover"></video>
      </div>
{host("graficos", 3, 3, "graphics")}
{host("subtitulos", 4, 4, "captions")}
    </div>

    <script>
      const tl = gsap.timeline({{ paused: true }});
      // El creador siempre en la esquina inferior derecha al 50 %
      tl.set("#persona", {{transformOrigin: "{ESQUINA["origin"]}", scale: {ESQUINA["scale"]}}}, 0);
      window.__timelines["main"] = tl;
    </script>
  </body>"""
idx = re.sub(r"    <div[^>]*\sid=\"root\".*</body>", lambda m: body, idx, flags=re.S)
idx = idx.replace('font-family: "Inter", sans-serif;', f'font-family: "{FONT}", sans-serif;')
(P / "index.html").write_text(idx, encoding="utf8")
print(f"ok · {len(fondos)} fondos · {len(grupos)} subtítulos · {DUR} s")
