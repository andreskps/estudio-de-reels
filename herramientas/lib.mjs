// Utilidades compartidas por las herramientas del editor.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { resolverPerfil } from "./perfiles.mjs";

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const HF = "hyperframes@0.9.5";

export function falla(mensaje, codigo = 2) {
  // Dentro del servidor del Estudio, un fallo no debe tumbar el proceso.
  if (globalThis.FALLA_LANZA) throw new Error(mensaje);
  console.error(`✗ ${mensaje}`);
  process.exit(codigo);
}

export function rutaReel(slug) {
  if (!slug) falla("Falta el slug del reel (carpeta dentro de reels/).");
  const dir = join(RAIZ, "reels", slug);
  if (!existsSync(dir)) falla(`No existe reels/${slug}.`);
  return dir;
}

export function asegurarDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

// Perfil de marca. `--perfil <id>` en cualquier herramienta lo fuerza (se quita de argv para no
// desordenar los argumentos); si no, manda el reel.json del reel (ver perfiles.mjs → resolverPerfil).
const iPerfil = process.argv.indexOf("--perfil");
export const PERFIL_ARG = iPerfil > 1 ? process.argv.splice(iPerfil, 2)[1] : null;
export function perfil(slug, id = PERFIL_ARG) {
  try { return resolverPerfil({ raiz: RAIZ, slug: slug || undefined, id: id || undefined }); }
  catch (e) { falla(e.message); }
}
export const rutaPerfil = (slug, ...partes) => join(perfil(slug).dir, ...partes);

// brand.json del perfil del reel (o del perfil pedido / activo si no hay reel).
export function marca(slug, id) {
  const pf = perfil(slug, id ?? PERFIL_ARG);
  const p = join(pf.dir, "brand.json");
  if (!existsSync(p)) falla(`No existe ${relative(RAIZ, p).split(sep).join("/")} (perfil «${pf.id}»). Crea la marca con /marca o el asistente del Estudio.`);
  return JSON.parse(readFileSync(p, "utf8"));
}

export function ejecutar(cmd, args, { shell = false, cwd } = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell, cwd, maxBuffer: 256 * 1024 * 1024 });
  if (r.error) falla(`No se pudo ejecutar ${cmd}: ${r.error.message}`, 1);
  return r;
}

export function ffmpeg(args) {
  const r = ejecutar("ffmpeg", ["-hide_banner", "-y", ...args]);
  if (r.status !== 0) falla(`ffmpeg falló: ${r.stderr.split("\n").slice(-4).join(" ")}`, 1);
  return r;
}

export function info(video) {
  const r = ejecutar("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", video]);
  if (r.status !== 0) falla(`ffprobe no pudo leer ${video}.`);
  const d = JSON.parse(r.stdout);
  const v = d.streams.find((s) => s.codec_type === "video");
  const [n, den] = (v?.avg_frame_rate || "0/1").split("/").map(Number);
  return {
    duracion: Number(d.format.duration),
    ancho: v?.width,
    alto: v?.height,
    fps: den ? Math.round((n / den) * 100) / 100 : null,
    audio: d.streams.some((s) => s.codec_type === "audio"),
  };
}

// Bandas prohibidas como rectángulos en píxeles sobre el lienzo.
export function bandasProhibidas(zona, ancho = 1080, alto = 1920) {
  return [
    { nombre: "arriba", x0: 0, y0: 0, x1: ancho, y1: zona.arriba },
    { nombre: "abajo", x0: 0, y0: alto - zona.abajo, x1: ancho, y1: alto },
    { nombre: "derecha", x0: ancho - zona.derecha, y0: 0, x1: ancho, y1: alto },
    { nombre: "izquierda", x0: 0, y0: 0, x1: zona.izquierda, y1: alto },
  ];
}

// Fotogramas cada `paso` segundos y hojas de contacto de 6×3.
export function hojasDeContacto(video, destino, { paso = 0.5, filtroExtra = "" } = {}) {
  asegurarDir(join(destino, "fotogramas"));
  const fuente = process.platform === "win32" ? "fontfile='C\\:/Windows/Fonts/arial.ttf':" : "";
  const etiqueta = `drawtext=${fuente}text='%{pts\\:hms}':x=10:y=10:fontsize=36:fontcolor=white:box=1:boxcolor=black@0.6`;
  const base = `fps=1/${paso}${filtroExtra ? "," + filtroExtra : ""}`;
  ffmpeg(["-i", video, "-vf", `${base},scale=540:-2`, join(destino, "fotogramas", "f%04d.jpg")]);
  ffmpeg(["-i", video, "-vf", `${base},scale=270:-2,${etiqueta.replace("fontsize=36", "fontsize=22")},tile=6x3:padding=4`, join(destino, "hoja-%02d.jpg")]);
}

// Versiones: lista ordenada (v1, v2, …) y creación de vN+1 copiando la anterior sin cachés ni HTML generado.
// Nunca sobrescribe: si el destino existe, falla.
import { cpSync, readdirSync as _ls, writeFileSync as _w } from "node:fs";
export function versiones(slug) {
  const dir = join(rutaReel(slug), "composicion");
  if (!existsSync(dir)) return [];
  return _ls(dir).filter((v) => /^v\d+$/.test(v)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}
const NO_COPIAR = new Set([".hyperframes", ".thumbnails", ".waveform-cache", "node_modules", "compositions", "index.html", "edicion.json"]);
export function nuevaVersion(slug, desde) {
  const vs = versiones(slug);
  const nueva = `v${vs.length ? Number(vs.at(-1).slice(1)) + 1 : 1}`;
  const base = join(rutaReel(slug), "composicion");
  const destino = join(base, nueva);
  if (existsSync(destino)) falla(`${nueva} ya existe; no se sobrescribe.`);
  asegurarDir(destino);
  if (desde) {
    const origen = join(base, desde);
    for (const e of _ls(origen)) if (!NO_COPIAR.has(e)) cpSync(join(origen, e), join(destino, e), { recursive: true });
  }
  if (!existsSync(join(destino, "hyperframes.json"))) _w(join(destino, "hyperframes.json"), JSON.stringify({ paths: { blocks: "compositions", components: "compositions/components", assets: "assets" }, media: { autoProxy: true } }, null, 2));
  if (!existsSync(join(destino, "package.json"))) _w(join(destino, "package.json"), JSON.stringify({ private: true, type: "module", devDependencies: { hyperframes: "0.9.5" } }, null, 2));
  _w(join(destino, "meta.json"), JSON.stringify({ id: nueva, name: nueva, createdAt: new Date().toISOString(), desde: desde ?? null }, null, 2));
  return { version: nueva, dir: destino };
}
