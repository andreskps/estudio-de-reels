// Convierte una versión hecha con un generar-vN.py (HTML) en una versión nueva con edicion.json.
// No toca la versión de origen: crea vN+1, escribe su edicion.json y la genera con generar.mjs.
// Uso: node herramientas/migrar-a-edicion.mjs <slug> <vN>
// Lo que entiende: subtítulos (.subtitulo + clases de posición), fondos de imagen/video (.fondo, .pagina),
// tarjetas (#gN con .marca/.dato), recorte del creador y los tl.set("#persona", …) del encuadre.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { RAIZ, ejecutar, falla, nuevaVersion, rutaReel } from "./lib.mjs";

const [slug, version] = process.argv.slice(2);
if (!/^v\d+$/.test(version || "")) falla("Uso: migrar-a-edicion.mjs <slug> <vN>");
const P = join(rutaReel(slug), "composicion", version);
if (!existsSync(join(P, "index.html"))) falla(`No hay index.html en ${version}.`);
const leer = (f) => (existsSync(join(P, f)) ? readFileSync(join(P, f), "utf8") : "");
const comp = existsSync(join(P, "compositions")) ? readdirSync(join(P, "compositions")).filter((f) => f.endsWith(".html")) : [];
const idx = leer("index.html");
const attr = (tag, a) => /\s/.test(tag) ? new RegExp(String.raw`\s${a}="([^"]*)"`).exec(tag)?.[1] : undefined;
const texto = (h) => h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const n = (v, d = 0) => (v == null || v === "" ? d : Number(v));
const rutaAsset = (src) => relative(RAIZ, join(P, src)).replaceAll("\\", "/");

const E = { duracion: n(/id="root"[^>]*data-duration="([\d.]+)"/s.exec(idx)?.[1]), recorte: idx.includes("clip-recorte.webm"),
  encuadre: [], zooms: [], fondos: [], subtitulos: [], posiciones_subtitulo: {}, sin_partir: [], tarjetas: [], motion: [], audio: { musica: null } };

// Encuadre del creador
for (const m of idx.matchAll(/tl\.set\("#persona",\s*\{([^}]*)\},\s*([\d.]+)\)/g)) {
  const o = m[1], g = (k) => new RegExp(String.raw`(?:^|[\s,])${k}:\s*"?([^",]+)"?`).exec(o)?.[1];
  E.encuadre.push({ inicio: n(m[2]), escala: n(g("scale"), 1), origen: g("transformOrigin") ?? "50% 50%", x: n(g("x")), y: n(g("y")) });
}

for (const f of comp) {
  const s = leer(`compositions/${f}`);
  // Subtítulos y sus posiciones
  const base = /\.subtitulo\s*\{[^}]*top:\s*(\d+)px/s.exec(s);
  if (base) E.posiciones_subtitulo.normal = n(base[1]) + 110;
  for (const m of s.matchAll(/\.subtitulo\.([\w-]+)\s*\{[^}]*top:\s*(\d+)px/g)) E.posiciones_subtitulo[m[1]] = n(m[2]) + 110;
  const tamClase = Object.fromEntries([...s.matchAll(/\.subtitulo\.([\w-]+)\s+span\s*\{[^}]*font-size:\s*(\d+)px/g)].map((m) => [m[1], n(m[2])]));
  for (const m of s.matchAll(/<div[^>]*class="clip subtitulo([^"]*)"[^>]*>([\s\S]*?)<\/div>/g)) {
    const tag = m[0].slice(0, m[0].indexOf(">") + 1);
    const clases = m[1].trim().split(/\s+/).filter(Boolean);
    const pos = clases.find((c) => E.posiciones_subtitulo[c] != null || /alto|arriba|hook/.test(c)) ?? "normal";
    const tam = clases.map((c) => tamClase[c]).find(Boolean);
    const a = n(attr(tag, "data-start")), d = n(attr(tag, "data-duration"));
    for (const w of m[2].matchAll(/<span class="nw">([^<]+)<\/span>/g)) if (!E.sin_partir.includes(w[1])) E.sin_partir.push(w[1]);
    E.subtitulos.push({ inicio: a, fin: Math.round((a + d) * 1000) / 1000, texto: texto(m[2]), pos, ...(tam ? { tamano: tam } : {}) });
  }
  // Fondos: videos con clase fondo
  for (const m of s.matchAll(/<video[^>]*class="clip fondo"[^>]*>/g)) {
    const t = m[0], a = n(attr(t, "data-start")), d = n(attr(t, "data-duration"));
    E.fondos.push({ id: (attr(t, "id") ?? "").replace(/^f-|-v$/g, ""), archivo: rutaAsset(attr(t, "src")), inicio: a, fin: Math.round((a + d) * 1000) / 1000,
      desde: n(attr(t, "data-media-start")), ...(attr(t, "data-playback-rate") ? { velocidad: n(attr(t, "data-playback-rate")) } : {}) });
  }
  // Fondos: imágenes dentro de un .clip.fondo o .clip.pagina
  for (const m of s.matchAll(/<div[^>]*class="clip (?:fondo|pagina)[^"]*"[^>]*>[\s\S]*?<img[^>]*?\ssrc="([^"]+)"/g)) {
    const t = m[0].slice(0, m[0].indexOf(">") + 1), a = n(attr(t, "data-start")), d = n(attr(t, "data-duration"));
    E.fondos.push({ id: (attr(t, "id") ?? "").replace(/^(f|pg)-/, ""), archivo: rutaAsset(m[1]), inicio: a, fin: Math.round((a + d) * 1000) / 1000, kenburns: /kb/.test(m[0]) });
  }
  // Tarjetas tipo hook (.marca / .dato)
  for (const m of s.matchAll(/<div id="(g\d+)" class="clip[^"]*"[^>]*>[\s\S]*?class="marca"[^>]*>([^<]*)<[\s\S]*?class="dato"[^>]*>([^<]*)</g)) {
    const t = m[0].slice(0, m[0].indexOf(">") + 1), a = n(attr(t, "data-start")), d = n(attr(t, "data-duration"));
    const y = n(new RegExp(String.raw`#${m[1]}\s*\{[^}]*top:\s*(\d+)px`).exec(s)?.[1], 250);
    E.tarjetas.push({ id: m[1], inicio: a, fin: Math.round((a + d) * 1000) / 1000, titulo: texto(m[2]), texto: texto(m[3]), y, estilo: "blanca" });
  }
}
E.fondos.sort((a, b) => a.inicio - b.inicio);
E.subtitulos.sort((a, b) => a.inicio - b.inicio);
if (!E.subtitulos.length) console.log("  ⚠ no encontré subtítulos con class=\"clip subtitulo\"");

const { version: nueva, dir } = nuevaVersion(slug, version);
writeFileSync(join(dir, "edicion.json"), JSON.stringify(E, null, 2) + "\n");
console.log(`edicion.json → ${relative(RAIZ, dir)} (${E.subtitulos.length} subtítulos, ${E.fondos.length} fondos, ${E.tarjetas.length} tarjetas, ${E.encuadre.length} encuadres)`);
const r = ejecutar(process.execPath, [join(RAIZ, "herramientas", "generar.mjs"), slug, nueva]);
process.stdout.write(r.stdout); process.stderr.write(r.stderr);
process.exit(r.status ?? 1);
