// Hojas de contacto de los reels propios de un perfil (<perfil>/mis-reels/ → <perfil>/analisis/<video>/), para «Afinar con mis reels».
// Uso: node herramientas/hojas-mis-reels.mjs --perfil <id>
// Solo lee mis-reels/ (originales); escribe en analisis/. Si la hoja de un video ya existe, no la rehace.
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative, sep } from "node:path";
import { RAIZ, falla, hojasDeContacto, info, perfil } from "./lib.mjs";

const VID = new Set([".mp4", ".mov", ".m4v", ".webm"]);
const p = perfil(null);
const dir = join(p.dir, "mis-reels");
const videos = existsSync(dir) ? readdirSync(dir).filter((f) => VID.has(extname(f).toLowerCase())) : [];
if (!videos.length) falla(`No hay videos en ${relative(RAIZ, dir).split(sep).join("/")}/. Sube 1–3 reels tuyos primero.`);
const resumen = [];
for (const v of videos.slice(0, 5)) {
  const destino = join(p.dir, "analisis", basename(v, extname(v)).replace(/[^\w-]+/g, "_"));
  const i = info(join(dir, v));
  if (!existsSync(join(destino, "hoja-01.jpg"))) hojasDeContacto(join(dir, v), destino, { paso: i.duracion > 40 ? 1 : 0.5 });
  const hojas = readdirSync(destino).filter((f) => /^hoja-\d+\.jpg$/.test(f)).map((f) => relative(RAIZ, join(destino, f)).split(sep).join("/"));
  resumen.push({ video: relative(RAIZ, join(dir, v)).split(sep).join("/"), duracion: i.duracion, ancho: i.ancho, alto: i.alto, hojas, fotogramas: relative(RAIZ, join(destino, "fotogramas")).split(sep).join("/") });
  console.log(`✔ ${v}: ${hojas.length} hoja(s) · ${Math.round(i.duracion)} s`);
}
writeFileSync(join(p.dir, "analisis", "mis-reels.json"), JSON.stringify(resumen, null, 2) + "\n");
console.log(`ok · ${resumen.length} reel(s) del perfil «${p.id}»`);
