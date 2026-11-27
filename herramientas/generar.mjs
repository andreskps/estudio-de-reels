// Genera la composición HyperFrames de una versión a partir de su edicion.json + el brand.json del perfil del reel.
// (`--perfil <id>` fuerza otro perfil; sin él manda reels/<slug>/reel.json, y los reels antiguos son de "andres").
// Es el generador único: el Estudio y los agentes editan edicion.json, nunca el HTML a mano.
// Uso: node herramientas/generar.mjs <slug> <vN>
//
// edicion.json (todos los tiempos en segundos; ver herramientas/edicion.esquema.md):
// {
//   "duracion": 53.03,
//   "recorte": false,                         // true → usa reels/<slug>/recorte/clip-recorte.webm como capa del creador
//   "encuadre": [{"inicio":0,"escala":0.5,"origen":"1080px 1920px","x":0,"y":0}],   // cortes secos del creador
//   "zooms":    [{"inicio":40,"fin":40.8,"escala":1.04,"origen":"50% 40%"}],         // punch-in suave
//   "fondos":   [{"id":"ben","archivo":"2-ben.jpg","inicio":4.6,"fin":6.8,"desde":0,"velocidad":1,"kenburns":true}],
//   "subtitulos": [{"inicio":0.01,"fin":1.3,"texto":"Esta marca","pos":"normal|alto","tamano":68}],
//   "posiciones_subtitulo": {"normal":1240,"alto":600},
//   "sin_partir": ["e-commerce"],
//   "tarjetas": [{"id":"hook","inicio":0,"fin":4.6,"titulo":"Gymshark","texto":"$40.000","y":250,"estilo":"blanca|oscura"}],
//   "motion":   [{"id":"m1","archivo":"flecha.webm","inicio":3,"fin":5,"x":0,"y":0,"ancho":1080}],
//   "efectos":  [{"id":"efx-1","receta":"flash-corte","inicio":12.4,"fin":12.65,"params":{},"tecnica":"flash-corte"}],   // recetas de herramientas/efectos.mjs
//   "audio":    {"musica": {"archivo":"tema.mp3","volumen":0.1,"desde":0} | null}
// }
import { copyFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, isAbsolute, join, relative } from "node:path";
import { RAIZ, asegurarDir, falla, marca, rutaPerfil, rutaReel } from "./lib.mjs";
import { normalizarEdicion, revisarEdicion } from "./reglas.mjs";
import { construirEfectos } from "./efectos.mjs";

const [slug, version] = process.argv.slice(2);
if (!/^v\d+$/.test(version || "")) falla("Uso: generar.mjs <slug> <vN>");
const R = rutaReel(slug);
const P = join(R, "composicion", version);
const rutaEd = join(P, "edicion.json");
if (!existsSync(rutaEd)) falla(`No existe ${relative(RAIZ, rutaEd)}.`);

const brand = marca(slug);
const E = normalizarEdicion(JSON.parse(readFileSync(rutaEd, "utf8")), brand);
const problemas = revisarEdicion(E, brand);
const graves = problemas.filter((p) => p.nivel === "error");
if (graves.length) falla("edicion.json tiene errores:\n  " + graves.map((p) => p.mensaje).join("\n  "));

const DUR = E.duracion;
const S = brand.subtitulos;
const FONT = brand.fuentes.subtitulos.familia;
const W8 = brand.fuentes.subtitulos.peso;
const TF = brand.fuentes.titulos ?? brand.fuentes.subtitulos;
const SHADOW = "0 3px 10px rgba(0,0,0,.45), 0 0 28px rgba(0,0,0,.3)";
const STROKE = `-webkit-text-stroke: ${S.contorno_px * 2}px ${brand.colores.contorno}; paint-order: stroke fill;`;
const IMG = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const VID = new Set([".mp4", ".mov", ".webm", ".m4v"]);
const AUD = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg"]);

const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const r3 = (n) => Math.round(n * 1000) / 1000;
const idSeguro = (s) => String(s).replace(/[^\w-]/g, "-");

// ---------- búsqueda de archivos ----------
let catalogo;
function indexar(dir, acc) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) indexar(p, acc);
    else if (!acc.has(e.name)) acc.set(e.name, p);
  }
  return acc;
}
function buscar(archivo) {
  if (!archivo) falla("un elemento no tiene 'archivo'");
  for (const c of [isAbsolute(archivo) ? archivo : join(RAIZ, archivo), join(R, archivo), join(P, archivo)])
    if (existsSync(c) && statSync(c).isFile()) return c;
  catalogo ??= indexar(join(R, "assets"), indexar(join(R, "assets-pdp"), indexar(join(RAIZ, "biblioteca"), new Map())));
  const p = catalogo.get(basename(archivo));
  if (!p) falla(`no encuentro "${archivo}" (busqué en la raíz, reels/${slug}/assets* y biblioteca/)`);
  return p;
}
function copiarAsset(archivo, sub) {
  const origen = buscar(archivo);
  const dest = join(asegurarDir(join(P, "assets", sub)), basename(origen));
  if (!existsSync(dest) || statSync(dest).size !== statSync(origen).size) copyFileSync(origen, dest);
  return `assets/${sub}/${basename(origen)}`;
}

// ---------- clip y recorte ----------
if (!existsSync(join(P, "clip.mp4"))) {
  const entrada = join(R, "entrada");
  const v = existsSync(entrada) && readdirSync(entrada).find((f) => VID.has(extname(f).toLowerCase()));
  if (!v) falla(`no hay clip.mp4 en ${version} ni video en entrada/`);
  copyFileSync(join(entrada, v), join(P, "clip.mp4"));
}
if (E.recorte) {
  const rec = join(R, "recorte", "clip-recorte.webm");
  if (!existsSync(rec)) falla(`recorte: true pero falta ${relative(RAIZ, rec)} (npx --yes hyperframes@0.9.5 remove-background entrada/clip.mp4 -o recorte/clip-recorte.webm)`);
  asegurarDir(join(P, "assets"));
  copyFileSync(rec, join(P, "assets", "clip-recorte.webm"));
}
asegurarDir(join(P, "compositions"));

// Fuente propia del perfil (fuentes.*.archivo): se copia a assets/fonts/ y se declara con @font-face
// en cada archivo que la usa. Las fuentes incluidas en HyperFrames (Montserrat, Inter…) no lo necesitan.
const caras = new Map();
for (const f of [brand.fuentes.subtitulos, TF]) {
  if (!f?.archivo || caras.has(f.familia + f.archivo)) continue;
  const origen = rutaPerfil(slug, f.archivo);
  if (!existsSync(origen)) falla(`la fuente ${f.archivo} no está en la carpeta del perfil`);
  const dest = join(asegurarDir(join(P, "assets", "fonts")), basename(origen));
  if (!existsSync(dest) || statSync(dest).size !== statSync(origen).size) copyFileSync(origen, dest);
  caras.set(f.familia + f.archivo, `    @font-face { font-family: "${f.familia}"; src: url('assets/fonts/${basename(origen)}'); font-weight: 100 900; font-display: block; }`);
}
const CARAS = caras.size ? [...caras.values()].join("\n") + "\n" : "";

function escena(id, estilo, cuerpo, js = [], extraRoot = "") {
  return `<template>
  <style>
    #root { position: absolute; inset: 0; }
${CARAS}${estilo}
  </style>
  <div id="root" data-composition-id="${id}" data-width="1080" data-height="1920"${extraRoot}>
${cuerpo.join("\n")}
  </div>
  <script>
  const tl = gsap.timeline({ paused: true });
${js.join("\n")}
  window.__timelines["${id}"] = tl;
  </script>
</template>
`;
}

// ---------- fondos / B-roll ----------
{
  const html = [], js = [];
  for (const f of E.fondos) {
    const fid = idSeguro(f.id), a = f.inicio, d = r3(f.fin - f.inicio);
    const ext = extname(f.archivo).toLowerCase();
    const ajuste = f.ajuste === "contain" ? "contain" : "cover";
    if (IMG.has(ext)) {
      const src = copiarAsset(f.archivo, "img");
      html.push(`    <div id="f-${fid}" class="clip fondo" data-start="${a}" data-duration="${d}">
      <div id="f-${fid}-kb" class="kb"><img src="${src}" alt="" style="object-fit: ${ajuste}" /></div>
    </div>`);
      if (f.kenburns !== false) js.push(`  tl.fromTo("#f-${fid}-kb", {scale: 1.0}, {scale: 1.07, duration: ${d}, ease: "none"}, ${a});`);
    } else if (VID.has(ext)) {
      const src = copiarAsset(f.archivo, "video");
      const rate = f.velocidad && f.velocidad !== 1 ? ` data-playback-rate="${f.velocidad}"` : "";
      html.push(`    <div id="f-${fid}" class="fondo-wrap">
      <video id="f-${fid}-v" class="clip fondo" src="${src}" muted playsinline data-start="${a}" data-duration="${d}" data-media-start="${f.desde ?? 0}"${rate} style="object-fit: ${ajuste}"></video>
    </div>`);
    } else falla(`fondo "${f.id}": formato ${ext} no soportado`);
  }
  writeFileSync(join(P, "compositions", "fondos.html"), escena("fondos", `    .fondo-wrap { position: absolute; inset: 0; }
    .fondo { position: absolute; inset: 0; width: 1080px; height: 1920px; overflow: hidden; object-fit: cover; background: #000; }
    .kb { position: absolute; inset: 0; transform-origin: 50% 40%; }
    .kb img { width: 100%; height: 100%; object-fit: cover; display: block; }`, html, js, " data-layout-allow-overlap"));
}

// ---------- motion graphics (videos con alfa o imágenes encima del creador) ----------
{
  const html = [];
  for (const m of E.motion) {
    const mid = idSeguro(m.id), a = m.inicio, d = r3(m.fin - m.inicio);
    const ext = extname(m.archivo).toLowerCase();
    const caja = `left: ${m.x ?? 0}px; top: ${m.y ?? 0}px; width: ${m.ancho ?? 1080}px;`;
    if (IMG.has(ext)) {
      html.push(`    <img id="m-${mid}" class="clip motion" src="${copiarAsset(m.archivo, "motion")}" alt="" data-start="${a}" data-duration="${d}" style="${caja}" />`);
    } else if (VID.has(ext)) {
      html.push(`    <video id="m-${mid}" class="clip motion" src="${copiarAsset(m.archivo, "motion")}" muted playsinline data-start="${a}" data-duration="${d}" data-media-start="${m.desde ?? 0}" style="${caja}"></video>`);
    } else falla(`motion "${m.id}": formato ${ext} no soportado`);
  }
  writeFileSync(join(P, "compositions", "motion.html"), escena("motion", `    .motion { position: absolute; height: auto; display: block; }`, html, [], " data-layout-allow-overlap"));
}

// ---------- tarjetas ----------
{
  const html = [], js = [];
  for (const t of E.tarjetas) {
    const tid = idSeguro(t.id), a = t.inicio, d = r3(t.fin - t.inicio);
    const oscura = t.estilo === "oscura";
    html.push(`    <div id="t-${tid}" class="clip tarjeta${oscura ? " oscura" : ""}" data-start="${a}" data-duration="${d}" style="top: ${t.y}px">
      <div id="t-${tid}-card" class="card">${t.titulo ? `<div class="titulo">${esc(t.titulo)}</div>` : ""}${t.texto ? `<div class="texto">${esc(t.texto)}</div>` : ""}</div>
    </div>`);
    if (a > 0) js.push(`  tl.fromTo("#t-${tid}-card", {opacity: 0, y: 10}, {opacity: 1, y: 0, duration: 0.2, ease: "power2.out"}, ${a});`);
  }
  const zl = brand.zona_segura.izquierda, zr = brand.zona_segura.derecha;
  writeFileSync(join(P, "compositions", "tarjetas.html"), escena("tarjetas", `    .tarjeta { position: absolute; left: ${zl}px; width: ${1080 - zl - zr}px; display: flex; justify-content: center;
      font-family: "${TF.familia}", sans-serif; font-weight: ${TF.peso}; text-align: center; }
    .tarjeta .card { background: #fff; color: #0b0b0d; border-radius: 26px; padding: 22px 40px 24px; box-shadow: 0 10px 30px rgba(0,0,0,.35); max-width: 100%; }
    .tarjeta.oscura .card { background: ${brand.colores.fondo_tarjeta}; color: ${brand.colores.principal}; }
    .tarjeta .titulo { font-size: 60px; line-height: 1.05; }
    .tarjeta .texto { font-size: 46px; line-height: 1.15; margin-top: 6px; }`, html, js));
}

// ---------- subtítulos ----------
// Palabra resaltada (subtitulos.resaltado.modo = "palabra"): la de `resaltar` en el subtítulo o, si no hay, la más larga.
const RES = S.resaltado?.modo === "palabra" ? { color: S.resaltado.color ?? brand.colores.acento, escala: S.resaltado.escala ?? 1 } : null;
function palabraClave(texto) {
  const ps = String(texto).split(/\s+/).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).filter((w) => w.length >= 4);
  return ps.reduce((a, w) => (w.length > a.length ? w : a), "");
}
function resaltar(html, palabra) {
  if (!palabra) return html;
  const w = esc(palabra).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(new RegExp(`(^|[\\s>¿¡"(«])(${w})(?=$|[\\s<.,;:!?)"»…])`, "u"), '$1<span class="res">$2</span>');
}
{
  const divs = [], js = [], subs = E.subtitulos;
  const Y = E.posiciones_subtitulo;
  subs.forEach((g, i) => {
    const sig = i + 1 < subs.length ? subs[i + 1].inicio : DUR;
    const b = Math.min(g.fin, sig, DUR), a = g.inicio, d = r3(b - a);
    let txt = esc(g.texto);
    for (const w of E.sin_partir) txt = txt.replaceAll(esc(w), `<span class="nw">${esc(w)}</span>`);
    if (RES) txt = resaltar(txt, g.resaltar ?? palabraClave(g.texto));
    const y = g.y ?? Y[g.pos] ?? Y.normal;
    const tam = g.tamano && g.tamano !== S.tamano_base_px ? `; font-size: ${g.tamano}px` : "";
    const nn = String(i).padStart(2, "0");
    divs.push(`    <div id="sub-${nn}" class="clip subtitulo" data-start="${a}" data-duration="${d}" style="top: ${y - 110}px"><span style="max-width: ${S.ancho_max_px}px${tam}">${txt}</span></div>`);
    if (i > 0) js.push(`  tl.fromTo("#sub-${nn} > span", {opacity: 0, y: 8}, {opacity: 1, y: 0, duration: 0.15, ease: "power2.out"}, ${a});`);
    if (i + 1 < subs.length) js.push(`  tl.to("#sub-${nn} > span", {opacity: 0, duration: 0.08, ease: "power2.in"}, ${r3(b - 0.08)});`);
  });
  writeFileSync(join(P, "compositions", "subtitulos.html"), escena("subtitulos", `    .subtitulo { position: absolute; left: 0; right: 0; height: 220px; display: flex; align-items: center; justify-content: center; overflow: visible; }
    .subtitulo .nw { white-space: nowrap; }
    .subtitulo > span { display: inline-block; text-align: center;
      font-family: "${FONT}", sans-serif; font-weight: ${W8}; font-size: ${S.tamano_base_px}px; line-height: 1.12;
      color: ${brand.colores.principal}; text-shadow: ${SHADOW}; ${STROKE}${S.mayusculas ? " text-transform: uppercase;" : ""}${S.caja ? ` background: ${brand.colores.fondo_tarjeta}; border-radius: 18px; padding: 8px 26px 12px;` : ""} }${RES ? `
    .subtitulo .res { color: ${RES.color}; display: inline-block; transform: scale(${RES.escala ?? 1}); }` : ""}`, divs, js));
}

// ---------- efectos (recetas aprendidas en el Learner; herramientas/efectos.mjs) ----------
let FX;
try { FX = construirEfectos(E.efectos); } catch (e) { falla(e.message); }
if (E.efectos.length) {
  writeFileSync(join(P, "compositions", "efectos.html"), escena("efectos", `    .efx-full { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; }
    .efx-texto { position: absolute; left: 0; right: 0; display: flex; align-items: center; justify-content: center; }
    .efx-texto > span { display: inline-block; text-align: center; max-width: 960px; font-family: "${TF.familia}", sans-serif; font-weight: ${TF.peso}; line-height: 1.05;
      color: ${brand.colores.principal}; text-shadow: ${SHADOW}; ${STROKE} }`, FX.capa.html, FX.capa.js, " data-layout-allow-overlap"));
}

// ---------- index ----------
const host = (cid, z, track, kind) => `      <div id="${cid}" data-composition-id="${cid}" data-composition-src="compositions/${cid}.html"
        data-start="0" data-duration="${DUR}" data-track-index="${track}" data-track-kind="${kind}"
        data-width="1080" data-height="1920" style="z-index: ${z}"></div>`;

const capaCreador = E.recorte
  ? `      <div id="tapa" style="position: absolute; inset: 0; z-index: 0; background: #0b0b0d"></div>
${host("fondos", 1, 1, "graphics")}
      <div id="persona" style="position: absolute; inset: 0; z-index: 2">
        <div id="zoom" style="position: absolute; inset: 0">
          <!-- nunca voltear: el creador se ve siempre como en su clip original -->
          <div id="fx" style="position: absolute; inset: 0">
          <video id="recorte" class="clip" src="assets/clip-recorte.webm" muted playsinline data-start="0" data-media-start="0"
            data-duration="${DUR}" data-track-index="2" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover"></video>
          </div>
        </div>
      </div>`
  : `${host("fondos", 3, 1, "graphics")}`;

let musica = "";
if (E.audio?.musica?.archivo) {
  const m = E.audio.musica;
  if (!AUD.has(extname(m.archivo).toLowerCase())) falla(`música: formato ${extname(m.archivo)} no soportado`);
  musica = `      <audio id="musica" class="clip" src="${copiarAsset(m.archivo, "audio")}" data-start="0" data-duration="${DUR}" data-media-start="${m.desde ?? 0}" data-track-index="7" data-volume="${m.volumen ?? 0.1}" data-fade-out="1.5"></audio>`;
}
// SFX puntuales: audio.sfx = [{id, archivo, inicio, volumen?, duracion?}] (solo con licencia en marca/LICENCIAS.md)
for (const s of E.audio?.sfx ?? []) {
  if (!AUD.has(extname(s.archivo).toLowerCase())) falla(`sfx "${s.id}": formato ${extname(s.archivo)} no soportado`);
  const ini = +s.inicio;
  const d = Math.min(s.duracion ?? 0.3, DUR - ini);
  if (!(d > 0)) falla(`sfx "${s.id}": fuera de la duración`);
  musica += `\n      <audio id="sfx-${s.id}" class="clip" src="${copiarAsset(s.archivo, "audio")}" data-start="${ini}" data-duration="${d.toFixed(3)}" data-track-index="8" data-volume="${s.volumen ?? 0.25}"></audio>`;
}

const js = [];
const capa = E.recorte ? "#persona" : "#persona";
for (const e of E.encuadre)
  js.push(`      tl.set("${capa}", {transformOrigin: "${e.origen ?? "50% 50%"}", x: ${e.x ?? 0}, y: ${e.y ?? 0}, scale: ${e.escala ?? 1}}, ${e.inicio});`);
for (const z of E.zooms) {
  const d = r3(z.fin - z.inicio);
  js.push(`      tl.set("#zoom", {transformOrigin: "${z.origen ?? "50% 40%"}"}, ${z.inicio});`);
  // Entrada suave; nunca volver de golpe: si el zoom no llega al final, sale suave en `vuelta` s (0,6 por defecto).
  js.push(`      tl.fromTo("#zoom", {scale: 1}, {scale: ${z.escala ?? 1.04}, duration: ${d}, ease: "sine.inOut"}, ${z.inicio});`);
  const vuelta = Math.min(z.vuelta ?? 0.6, DUR - z.fin);
  if (vuelta > 0.01) js.push(`      tl.to("#zoom", {scale: 1, duration: ${r3(vuelta)}, ease: "sine.inOut"}, ${r3(z.fin)});`);
}
js.push(...FX.cuadro);

const aroll = E.recorte
  ? `      <video id="a-roll" class="clip" src="clip.mp4" playsinline data-start="0" data-duration="${DUR}" data-track-index="0" data-has-audio="true"
        style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0"></video>`
  : `      <div id="persona" style="position: absolute; inset: 0; z-index: 0; overflow: hidden">
        <div id="zoom" style="position: absolute; inset: 0">
          <!-- nunca voltear: el creador se ve siempre como en su clip original -->
          <div id="fx" style="position: absolute; inset: 0">
          <video id="a-roll" class="clip" src="clip.mp4" playsinline data-start="0" data-duration="${DUR}" data-track-index="0" data-has-audio="true"
            style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover"></video>
          </div>
        </div>
      </div>`;

const NL = "\n";
const index = `<!doctype html>
<html lang="es" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #000; }
${CARAS.replace(/^ {4}/gm, "      ")}      body { font-family: "${FONT}", sans-serif; }
    </style>
  </head>
  <body>
    <!-- Generado por herramientas/generar.mjs desde edicion.json: no editar a mano -->
    <div id="root" data-composition-id="main" data-start="0" data-duration="${DUR}" data-width="1080" data-height="1920">
${aroll}
${capaCreador}
${host("motion", 4, 3, "graphics")}
${E.efectos.length ? host("efectos", 5, 6, "graphics") + NL : ""}${host("tarjetas", 6, 4, "graphics")}
${host("subtitulos", 7, 5, "captions")}
${musica}
    </div>

    <script>
      const tl = gsap.timeline({ paused: true });
${js.join("\n")}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
writeFileSync(join(P, "index.html"), index);
for (const p of problemas.filter((p) => p.nivel !== "error")) console.log(`  ⚠ ${p.mensaje}`);
console.log(`ok · ${version} · ${E.subtitulos.length} subtítulos · ${E.fondos.length} fondos · ${E.tarjetas.length} tarjetas · ${E.zooms.length} zooms · ${E.motion.length} motion · ${E.efectos.length} efectos · ${DUR} s`);
