// Entrega y QA de una versión renderizada:
// normaliza el audio (brand.audio, por defecto −14 LUFS / −1.5 dBTP) → salida/final-vN.mp4
// y crea hojas de contacto con la zona segura dibujada → qa/vN/.
// Uso: node herramientas/qa.mjs <slug> <vN>   (espera salida/render-vN.mp4)
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { asegurarDir, bandasProhibidas, falla, ffmpeg, hojasDeContacto, info, marca, rutaReel } from "./lib.mjs";

const [slug, version] = process.argv.slice(2);
if (!/^v\d+$/.test(version || "")) falla("Uso: qa.mjs <slug> <vN>");
const dir = rutaReel(slug);
const render = join(dir, "salida", `render-${version}.mp4`);
const final = join(dir, "salida", `final-${version}.mp4`);
if (!existsSync(render)) falla(`No existe salida/render-${version}.mp4. Renderiza primero.`);
if (existsSync(final)) falla(`salida/final-${version}.mp4 ya existe; las versiones no se sobrescriben. Usa /ajustar.`);

const brand = marca(slug);
const { lufs = -14, true_peak = -1.5 } = brand.audio ?? {};
const datos = info(render);

function medir(video, filtro) {
  const r = ffmpeg(["-i", video, "-af", filtro, "-vn", "-f", "null", "-"]);
  const m = r.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/s);
  return m ? JSON.parse(m[0]) : null;
}

if (datos.audio) {
  const objetivo = `I=${lufs}:TP=${true_peak}:LRA=11`;
  const m = medir(render, `loudnorm=${objetivo}:print_format=json`);
  const filtro = `loudnorm=${objetivo}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  ffmpeg(["-i", render, "-c:v", "copy", "-af", filtro, "-ar", "48000", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", final]);
} else {
  ffmpeg(["-i", render, "-c", "copy", "-movflags", "+faststart", final]);
}

const qa = asegurarDir(join(dir, "qa", version));
const zona = brand.zona_segura;
const cajas = bandasProhibidas(zona, datos.ancho, datos.alto)
  .map((b) => `drawbox=x=${b.x0}:y=${b.y0}:w=${b.x1 - b.x0}:h=${b.y1 - b.y0}:color=red@0.28:t=fill`).join(",");
hojasDeContacto(final, qa, { paso: 0.5, filtroExtra: cajas });

let audio = "sin audio";
if (datos.audio) {
  const m = medir(final, `loudnorm=I=${lufs}:TP=${true_peak}:print_format=json`);
  audio = `${Number(m.input_i).toFixed(1)} LUFS, pico ${Number(m.input_tp).toFixed(1)} dBTP (objetivo ${lufs} / ${true_peak})`;
}
const hojas = readdirSync(qa).filter((n) => n.startsWith("hoja-"));
const md = [`# QA — ${slug} ${version}`, "", `- Archivo: salida/final-${version}.mp4`,
  `- ${datos.ancho}×${datos.alto}, ${datos.fps} fps, ${datos.duracion.toFixed(2)} s`, `- Audio: ${audio}`,
  `- Hojas de contacto (rojo = fuera de zona segura): ${hojas.map((h) => `qa/${version}/${h}`).join(", ")}`].join("\n");
writeFileSync(join(qa, "qa.md"), md + "\n");
console.log(md);
