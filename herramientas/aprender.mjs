// Learner, paso 1: corta un video de referencia en "momentos" (alrededor de cada corte de escena) para que un agente
// los mire y diga qué técnica hay en cada uno. No interpreta nada: solo prepara clips y tiras de fotogramas.
// Uso: node herramientas/aprender.mjs <ruta-del-video> <id-fuente>
// Salida: biblioteca/.cache/learner/<id>/  momentos.json, mNN.mp4 (clip con audio), mNN.jpg (tira de 6 fotogramas), mNN-mini.jpg
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { RAIZ, falla, ffmpeg, info } from "./lib.mjs";

const [rutaArg, id] = process.argv.slice(2);
if (!rutaArg || !/^[\w-]+$/.test(id ?? "")) falla("Uso: aprender.mjs <ruta-del-video> <id-fuente>");
const video = isAbsolute(rutaArg) ? rutaArg : join(RAIZ, rutaArg);
if (!existsSync(video)) falla(`No existe ${rutaArg}`);
const OUT = join(RAIZ, "biblioteca", ".cache", "learner", id);
mkdirSync(OUT, { recursive: true });
const rel = (p) => relative(RAIZ, p).split("\\").join("/");
const r2 = (n) => Math.round(n * 100) / 100;

const datos = info(video);
const D = datos.duracion;
console.log(`· ${rel(video)}: ${datos.ancho}×${datos.alto}, ${D.toFixed(2)} s`);

// Cortes de escena (umbral bajo para no perder flashes ni cortes rápidos).
const r = ffmpeg(["-i", video, "-vf", "select='gt(scene,0.25)',showinfo", "-an", "-f", "null", "-"]);
const cortes = [...r.stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => r2(Number(m[1]))).filter((t) => t > 0.2 && t < D - 0.2);
console.log(`· ${cortes.length} cortes de escena`);

// Momentos: grupos de cortes cercanos (< 0,9 s = ráfaga) con 0,6 s de margen. Sin cortes: ventanas cada 4 s.
let grupos = [];
for (const c of cortes) {
  const g = grupos.at(-1);
  // ráfaga: cortes a menos de 0,9 s, pero un momento no pasa de ~4 s (si no, la tira queda muy espaciada)
  if (g && c - g.at(-1) < 0.9 && c - g[0] < 4) g.push(c); else grupos.push([c]);
}
if (!grupos.length) for (let t = 1; t < D - 1; t += 4) grupos.push([t]);
// Máximo 28 momentos: se unen los grupos más cercanos entre sí.
while (grupos.length > 28) {
  let k = 0, min = Infinity;
  for (let i = 0; i < grupos.length - 1; i++) { const d = grupos[i + 1][0] - grupos[i].at(-1); if (d < min) { min = d; k = i; } }
  grupos.splice(k, 2, [...grupos[k], ...grupos[k + 1]]);
}
const momentos = grupos.map((g, i) => {
  const inicio = r2(Math.max(0, g[0] - 0.6)), fin = r2(Math.min(D, g.at(-1) + 0.6));
  return { id: `m${String(i + 1).padStart(2, "0")}`, inicio, fin, cortes: g };
});

const vertical = datos.alto >= datos.ancho;
for (const m of momentos) {
  const d = r2(m.fin - m.inicio);
  const base = join(OUT, m.id);
  ffmpeg(["-y", "-ss", String(m.inicio), "-t", String(d), "-i", video, "-vf", "scale=-2:640", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
    "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", `${base}.mp4`]);
  // 6 fotogramas repartidos en el momento (12 en dos filas si dura más de 2,5 s), en una tira.
  const filas = d > 2.5 ? 2 : 1;
  ffmpeg(["-y", "-ss", String(m.inicio), "-t", String(d), "-i", video, "-vf", `fps=${((6 * filas + 0.5) / d).toFixed(3)},scale=${vertical ? "-2:360" : "360:-2"},tile=6x${filas}`, "-frames:v", "1", "-q:v", "4", `${base}.jpg`]);
  ffmpeg(["-y", "-ss", String(r2(m.cortes[0])), "-i", video, "-vf", "scale=-2:480", "-frames:v", "1", "-q:v", "4", `${base}-mini.jpg`]);
  Object.assign(m, { clip: rel(`${base}.mp4`), tira: rel(`${base}.jpg`), miniatura: rel(`${base}-mini.jpg`) });
}

const planos = [0, ...cortes, D].map((t, i, a) => (i ? t - a[i - 1] : null)).filter((x) => x != null);
const resumen = {
  video: rel(video), ...datos,
  cortes, plano_medio_s: r2(D / (cortes.length + 1)), plano_mas_corto_s: r2(Math.min(...planos)),
  momentos,
};
writeFileSync(join(OUT, "momentos.json"), JSON.stringify(resumen, null, 1));
console.log(`✓ ${momentos.length} momentos en ${rel(OUT)}/momentos.json (plano medio ${resumen.plano_medio_s} s)`);
