// Valida una versión de la composición antes de renderizar.
// Reglas: check de HyperFrames sin errores, ningún texto en las 4 bandas prohibidas, subtítulos ≤ lineas_max
// de la zona segura, duración ≤ clip, subtítulos ≥ 4 fotogramas, sin dispensas de zona.
// Uso: node herramientas/validar.mjs <slug> <vN>    |    node herramientas/validar.mjs --dir <proyecto>
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { HF, RAIZ, asegurarDir, bandasProhibidas, ejecutar, falla, info, marca, rutaReel } from "./lib.mjs";

const args = process.argv.slice(2);
let proyecto, salidaInforme, slugReel;
if (args[0] === "--dir") {
  proyecto = args[1];
  salidaInforme = join(proyecto, "validacion.md");
} else {
  const [slug, version] = args;
  slugReel = slug;
  if (!/^v\d+$/.test(version || "")) falla("Uso: validar.mjs <slug> <vN>");
  proyecto = join(rutaReel(slug), "composicion", version);
  salidaInforme = join(asegurarDir(join(rutaReel(slug), "qa", version)), "validacion.md");
}
if (!existsSync(join(proyecto, "index.html"))) falla(`No hay index.html en ${proyecto}.`);

const brand = marca(slugReel); // perfil del reel (con --dir: --perfil o el activo)
const zona = brand.zona_segura;
const W = 1080, H = 1920;
const html = [join(proyecto, "index.html"), ...listarHtml(join(proyecto, "compositions"))]
  .map((p) => ({ p, s: readFileSync(p, "utf8") }));
const raiz = html[0].s;
const duracion = Number(/id="root"[^>]*data-duration="([\d.]+)"/s.exec(raiz)?.[1] ?? NaN);
const fps = brand.video?.fps ?? 30;

function listarHtml(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listarHtml(join(dir, e.name)) : e.name.endsWith(".html") ? [join(dir, e.name)] : []);
}

function check(extra = []) {
  const r = ejecutar("npx", ["--yes", HF, "check", `"${proyecto}"`, "--json", ...extra], { shell: true });
  try {
    return JSON.parse(r.stdout);
  } catch {
    falla(`hyperframes check no devolvió JSON: ${r.stderr.split("\n").slice(-3).join(" ")}`, 1);
  }
}

const reglas = [];
const regla = (nombre, pasa, detalle = "") => reglas.push({ nombre, pasa, detalle });

// 1. Check general
const general = check();
const errores = ["lint", "runtime", "layout", "motion", "contrast"].flatMap((k) =>
  (general[k]?.findings ?? general[k]?.issues ?? []).filter((f) => f.severity === "error").map((f) => `${k}: ${f.code} ${f.selector ?? ""} — ${f.message ?? ""}`));
regla("check de HyperFrames sin errores", general.ok && errores.length === 0, errores.slice(0, 10).join("\n"));

// 2–5. Bandas prohibidas. --caption-zone solo mide en vertical, así que se declara
// una banda del lienzo entero: devuelve la caja de cada texto visible y aquí se cruza con cada banda.
const pasos = Math.min(80, Math.max(8, Math.ceil(duracion / 0.25)));
const seek = Array.from({ length: pasos }, (_, i) => ((i + 0.5) / pasos).toFixed(4)).join(",");
const cajas = (check(["--no-contrast", "--no-collapse-static", `--caption-zone "x0=0;y0=0;x1=1;y1=1;severity=warning;seek=${seek}"`]).layout?.findings ?? [])
  .filter((f) => f.code === "caption_zone_collision" && f.rect);
for (const b of bandasProhibidas(zona, W, H)) {
  const choques = cajas.filter(({ rect: r }) => r.left < b.x1 - 1 && r.right > b.x0 + 1 && r.top < b.y1 - 1 && r.bottom > b.y0 + 1);
  const unicos = [...new Map(choques.map((f) => [f.selector, f])).values()];
  regla(`zona segura: nada de texto en la banda ${b.nombre}`, unicos.length === 0,
    unicos.map((f) => `${f.selector} "${f.text}" en ${f.time}s (y ${Math.round(f.rect.top)}–${Math.round(f.rect.bottom)}, x ${Math.round(f.rect.left)}–${Math.round(f.rect.right)})`).join("\n"));
}

// 6. Duración ≤ clip
const src = /<video[^>]*\ssrc="([^"]+)"/s.exec(raiz)?.[1];
if (src && existsSync(join(proyecto, src))) {
  const clip = info(join(proyecto, src)).duracion;
  regla("duración de la composición ≤ duración del clip", duracion <= clip + 0.05, `composición ${duracion}s, clip ${clip.toFixed(2)}s`);
} else {
  regla("duración de la composición ≤ duración del clip", false, "no se encontró el <video> del clip en index.html");
}

// 7. Subtítulos ≥ 4 fotogramas
const cortos = html.flatMap(({ p, s }) =>
  [...s.matchAll(/<[^>]*class="[^"]*\bsubtitulo\b[^"]*"[^>]*>/g)]
    .map((m) => ({ id: /\sid="([^"]+)"/.exec(m[0])?.[1], d: Number(/data-duration="([\d.]+)"/.exec(m[0])?.[1]) }))
    .filter((x) => x.d * fps < 4).map((x) => `${x.id} (${x.d}s) en ${p.slice(proyecto.length + 1)}`));
regla("cada subtítulo dura al menos 4 fotogramas", cortos.length === 0, cortos.join("\n"));

// 8. Máximo de líneas por subtítulo (brand.subtitulos.lineas_max): mide cada grupo en su punto medio
const lineasMax = brand.subtitulos?.lineas_max ?? 2;
const altoLinea = (brand.subtitulos?.tamano_base_px ?? 68) * 1.12;
const grupos = html.flatMap(({ s }) =>
  [...s.matchAll(/<[^>]*class="[^"]*\bsubtitulo\b[^"]*"[^>]*>/g)].map((m) => ({
    id: /\sid="([^"]+)"/.exec(m[0])?.[1],
    a: Number(/data-start="([\d.]+)"/.exec(m[0])?.[1]),
    d: Number(/data-duration="([\d.]+)"/.exec(m[0])?.[1]),
  })).filter((g) => g.id && g.d > 0));
const largos = new Map();
for (let i = 0; i < grupos.length; i += 20) {
  const lote = grupos.slice(i, i + 20);
  const seekL = lote.map((g) => Math.min(0.9999, (g.a + g.d / 2) / duracion).toFixed(5)).join(",");
  const hall = (check(["--no-contrast", "--no-collapse-static", `--caption-zone "x0=0;y0=0;x1=1;y1=1;severity=warning;seek=${seekL}"`]).layout?.findings ?? [])
    .filter((f) => f.code === "caption_zone_collision" && f.rect);
  for (const f of hall) {
    const id = /#([\w-]+)/.exec(f.selector ?? "")?.[1];
    if (!lote.some((g) => g.id === id)) continue;
    const lineas = Math.round((f.rect.bottom - f.rect.top) / altoLinea);
    if (lineas > lineasMax && (!largos.has(id) || largos.get(id).lineas < lineas)) largos.set(id, { lineas, text: f.text });
  }
}
regla(`cada subtítulo ocupa como mucho ${lineasMax} líneas`, largos.size === 0,
  [...largos].map(([id, x]) => `${id} "${x.text}" (${x.lineas} líneas)`).join("\n"));

// 9. Sin dispensas de zona segura
const dispensas = html.filter(({ s }) => s.includes("data-layout-allow-caption-zone")).map(({ p }) => p.slice(proyecto.length + 1));
regla("sin data-layout-allow-caption-zone (no se dispensa la zona segura)", dispensas.length === 0, dispensas.join(", "));

const pasan = reglas.filter((r) => r.pasa).length;
const resumen = `Pasa ${pasan} de ${reglas.length} reglas.`;
const md = [`# Validación — ${relative(RAIZ, proyecto).replaceAll("\\", "/")}`, "", resumen, "",
  ...reglas.map((r, i) => `${i + 1}. ${r.pasa ? "✓" : "✗"} ${r.nombre}${r.detalle && !r.pasa ? "\n   " + r.detalle.replaceAll("\n", "\n   ") : ""}`)].join("\n");
writeFileSync(salidaInforme, md + "\n");
console.log(md);
process.exit(pasan === reglas.length ? 0 : 2);
