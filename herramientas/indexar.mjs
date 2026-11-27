// Indexa la biblioteca de medios: biblioteca/{broll,videos,inspiracion,motion,audio} y, por referencia
// (sin moverlos), los assets de los reels, sus referencias y los clips de entrada.
// Genera miniatura y hoja de contacto (videos) en biblioteca/.cache/ y conserva lo que el creador
// o un agente escribió (etiquetas, descripción, licencia, favorito).
// Uso: node herramientas/indexar.mjs            (todo)
//      node herramientas/indexar.mjs --forzar   (rehace miniaturas)
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative, sep } from "node:path";
import { RAIZ, asegurarDir, ejecutar } from "./lib.mjs";
import { listaPerfiles } from "./perfiles.mjs";

export const TIPOS = ["broll", "videos", "inspiracion", "motion", "audio"];
const BIB = join(RAIZ, "biblioteca");
const CACHE = join(BIB, ".cache");
const IMG = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const VID = new Set([".mp4", ".mov", ".webm", ".m4v"]);
const AUD = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg"]);
const forzar = process.argv.includes("--forzar");

// Carpetas de la biblioteca (virtuales: el archivo no se mueve). Por defecto, según de dónde viene.
const Mayus = (x) => x.charAt(0).toUpperCase() + x.slice(1);
const nombreTema = (slug) => Mayus(slug.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-/g, " "));
const rel = (p) => relative(RAIZ, p).split(sep).join("/");
const idDe = (ruta) => createHash("sha1").update(ruta).digest("hex").slice(0, 12);
const clase = (ext) => (VID.has(ext) ? "video" : IMG.has(ext) ? "imagen" : AUD.has(ext) ? "audio" : null);

function recorrer(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) recorrer(p, acc);
    else if (clase(extname(e.name).toLowerCase())) acc.push(p);
  }
  return acc;
}

// ---------- fuentes ----------
for (const t of TIPOS) asegurarDir(join(BIB, t));
asegurarDir(CACHE);
const fuentes = [];
for (const t of TIPOS) for (const p of recorrer(join(BIB, t))) {
  const sub = relative(join(BIB, t), p).split(sep).slice(0, -1);
  const carpeta = sub.length ? sub.join("/") : /^learner-/.test(basename(p)) ? "Learner" : "";
  fuentes.push({ p, tipo: t, origen: "biblioteca", etiquetas: sub, carpeta });
}
const reels = join(RAIZ, "reels");
for (const slug of existsSync(reels) ? readdirSync(reels) : []) {
  const R = join(reels, slug);
  if (!statSync(R).isDirectory()) continue;
  const tema = slug.replace(/^\d{4}-\d{2}-\d{2}-/, "");
  for (const d of readdirSync(R).filter((d) => /^assets/.test(d)))
    for (const p of recorrer(join(R, d))) {
      const ext = extname(p).toLowerCase();
      const sub = relative(join(R, d), p).split(sep).slice(0, -1);
      fuentes.push({ p, tipo: AUD.has(ext) ? "audio" : "broll", origen: `reel:${slug}`, etiquetas: [tema, ...sub], carpeta: [nombreTema(slug), ...sub.map(Mayus)].join("/") });
    }
  for (const p of recorrer(join(R, "referencia"))) fuentes.push({ p, tipo: "inspiracion", origen: `reel:${slug}`, etiquetas: [tema, "referencia"], carpeta: nombreTema(slug) });
  for (const p of recorrer(join(R, "entrada"))) fuentes.push({ p, tipo: "videos", origen: `reel:${slug}`, etiquetas: [tema, "a-roll"], carpeta: nombreTema(slug) });
}
// Assets de cada perfil de marca (por referencia). El perfil "andres" (marca/) conserva origen "marca" y sus carpetas.
for (const perfil of listaPerfiles()) {
  const origen = perfil.id === "andres" ? "marca" : `perfil:${perfil.id}`;
  const suf = perfil.id === "andres" ? "" : ` (${perfil.nombre})`;
  for (const p of recorrer(join(perfil.dir, "mis-reels"))) fuentes.push({ p, tipo: "inspiracion", origen, etiquetas: ["mis-reels"], carpeta: `Mis reels${suf}`, perfil });
  for (const p of recorrer(join(perfil.dir, "musica"))) fuentes.push({ p, tipo: "audio", origen, etiquetas: ["música"], carpeta: `Música${suf}`, perfil });
  for (const p of recorrer(join(perfil.dir, "sfx"))) fuentes.push({ p, tipo: "audio", origen, etiquetas: ["sfx"], carpeta: `SFX${suf}`, perfil });
}

// ---------- índice ----------
const rutaIndice = join(BIB, "indice.json");
const previo = existsSync(rutaIndice) ? JSON.parse(readFileSync(rutaIndice, "utf8")).items ?? {} : {};
const items = {};

function sonda(p) {
  const r = ejecutar("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", p]);
  if (r.status !== 0) return {};
  try {
    const d = JSON.parse(r.stdout);
    const v = d.streams.find((s) => s.codec_type === "video");
    const [n, den] = (v?.avg_frame_rate || "0/1").split("/").map(Number);
    return { duracion: Number(d.format.duration) || null, ancho: v?.width ?? null, alto: v?.height ?? null,
      fps: den ? Math.round((n / den) * 100) / 100 : null, audio: d.streams.some((s) => s.codec_type === "audio"),
      alfa: /yuva|rgba|argb|bgra/.test(v?.pix_fmt ?? "") || /prores_4444|qtrle|png/.test(v?.codec_name ?? "") };
  } catch { return {}; }
}
const ff = (args) => ejecutar("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]).status === 0;

let nuevos = 0, fallos = 0;
for (const f of fuentes) {
  const ruta = rel(f.p);
  const id = idDe(ruta);
  if (items[id]) continue;
  const ext = extname(f.p).toLowerCase();
  const st = statSync(f.p);
  const ant = previo[id];
  const cambio = !ant || ant.tamano !== st.size || forzar;
  const it = {
    id, tipo: ant?.tipo_manual ? ant.tipo : f.tipo, tipo_manual: ant?.tipo_manual ?? false,
    clase: clase(ext), ruta, nombre: basename(f.p), ext, origen: f.origen, tamano: st.size,
    modificado: st.mtime.toISOString(), agregado: ant?.agregado ?? new Date().toISOString(),
    etiquetas: [...new Set([...(ant?.etiquetas ?? []), ...f.etiquetas.map((e) => e.toLowerCase())])].filter(Boolean),
    descripcion: ant?.descripcion ?? "", licencia: ant?.licencia ?? (f.origen === "biblioteca" ? "" : `ver ${f.perfil ? relative(RAIZ, join(f.perfil.dir, "LICENCIAS.md")).split(sep).join("/") : "LICENCIAS.md del perfil del reel"}`),
    carpeta: ant?.carpeta ?? f.carpeta ?? "", fuente: ant?.fuente ?? "", favorito: ant?.favorito ?? false, usado_en: ant?.usado_en ?? [],
    ...(cambio ? sonda(f.p) : { duracion: ant.duracion, ancho: ant.ancho, alto: ant.alto, fps: ant.fps, audio: ant.audio, alfa: ant.alfa }),
    miniatura: ant?.miniatura ?? null, hoja: ant?.hoja ?? null,
  };
  const mini = join(CACHE, `${id}.jpg`), hoja = join(CACHE, `${id}-hoja.jpg`);
  if (cambio || !existsSync(mini)) {
    let ok = false;
    if (it.clase === "imagen") ok = ff(["-i", f.p, "-vf", "scale=360:-2", "-frames:v", "1", mini]);
    else if (it.clase === "video") {
      const t = Math.min(1, (it.duracion ?? 2) * 0.1);
      ok = ff(["-ss", String(t), "-i", f.p, "-vf", "scale=360:-2", "-frames:v", "1", mini]);
      if (it.duracion) {
        const paso = Math.max(0.25, it.duracion / 8);
        ff(["-i", f.p, "-vf", `fps=1/${paso},scale=240:-2,tile=4x2:padding=4`, "-frames:v", "1", hoja]);
      }
    } else if (it.clase === "audio") ok = ff(["-i", f.p, "-filter_complex", "showwavespic=s=360x120:colors=#9aa4ff", "-frames:v", "1", mini]);
    ok ? nuevos++ : fallos++;
  }
  it.miniatura = existsSync(mini) ? rel(mini) : null;
  it.hoja = existsSync(hoja) ? rel(hoja) : null;
  items[id] = it;
}

writeFileSync(rutaIndice, JSON.stringify({ actualizado: new Date().toISOString(), items }, null, 1) + "\n");
const porTipo = Object.fromEntries(TIPOS.map((t) => [t, Object.values(items).filter((i) => i.tipo === t).length]));
console.log(`ok · ${Object.keys(items).length} items (${Object.entries(porTipo).map(([k, v]) => `${k} ${v}`).join(", ")}) · ${nuevos} miniaturas nuevas${fallos ? ` · ${fallos} sin miniatura` : ""}`);
