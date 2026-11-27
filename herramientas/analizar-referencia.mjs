// Analiza la referencia y el clip de un reel: datos técnicos, cortes de escena,
// fotogramas cada 0,5 s y hojas de contacto para que Claude las mire.
// Uso: node herramientas/analizar-referencia.mjs <slug>
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { asegurarDir, falla, ffmpeg, hojasDeContacto, info, rutaReel } from "./lib.mjs";

const slug = process.argv[2];
const dir = rutaReel(slug);

function primerVideo(carpeta) {
  const p = join(dir, carpeta);
  if (!existsSync(p)) return null;
  const f = readdirSync(p).find((n) => /\.(mp4|mov|webm|m4v)$/i.test(n));
  return f ? join(p, f) : null;
}

function cortesDeEscena(video) {
  const r = ffmpeg(["-i", video, "-vf", "select='gt(scene,0.3)',showinfo", "-an", "-f", "null", "-"]);
  return [...r.stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(Number(m[1]).toFixed(2)));
}

const resumen = {};
for (const [clave, carpeta] of [["referencia", "referencia"], ["clip", "entrada"]]) {
  const video = primerVideo(carpeta);
  if (!video) {
    if (clave === "clip") falla(`No hay video en reels/${slug}/entrada/.`);
    console.log(`· Sin referencia en reels/${slug}/referencia/ (se usará solo la marca).`);
    continue;
  }
  const destino = asegurarDir(join(dir, "analisis", clave));
  const datos = info(video);
  const cortes = cortesDeEscena(video);
  hojasDeContacto(video, destino);
  const planoMedio = cortes.length ? datos.duracion / (cortes.length + 1) : datos.duracion;
  resumen[clave] = {
    archivo: video.slice(dir.length + 1).replaceAll("\\", "/"),
    ...datos,
    cortes_de_escena: cortes,
    plano_medio_s: Number(planoMedio.toFixed(2)),
    hojas: readdirSync(destino).filter((n) => n.startsWith("hoja-")).map((n) => `analisis/${clave}/${n}`),
  };
  console.log(`✓ ${clave}: ${datos.ancho}×${datos.alto} ${datos.fps} fps, ${datos.duracion.toFixed(2)} s, ${cortes.length} cortes, ${resumen[clave].hojas.length} hojas.`);
}

writeFileSync(join(dir, "analisis", "resumen.json"), JSON.stringify(resumen, null, 2));
console.log(`✓ reels/${slug}/analisis/resumen.json`);
