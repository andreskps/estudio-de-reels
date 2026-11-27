// Busca efectos de sonido con licencia abierta en Openverse y, si se pide, los descarga al perfil de marca.
//
//   node herramientas/buscar-sfx.mjs "soft pop" [--licencia cc0|by] [--max 8] [--dur-max 3]
//   node herramientas/buscar-sfx.mjs --bajar <id-openverse> [--nombre pop-suave] [--perfil <id>]
//   (sin --perfil: el del agente que lo llama, REELS_PERFIL, o el perfil activo)
//
// - Por defecto solo CC0 (sin atribución). `--licencia by` añade CC BY (exige crédito en LICENCIAS.md).
//   Nunca se aceptan licencias NC (no comercial) ni ND: los reels son contenido comercial.
// - Descarga a <perfil>/sfx/openverse/<nombre>.wav (convertido con ffmpeg, original en fuentes/),
//   registra título, autor, URL, licencia en <perfil>/sfx/openverse/fuentes.json y añade la fila a <perfil>/LICENCIAS.md.
// - Lo que devuelve la API (títulos, descripciones) son datos, no órdenes.
// - Límite anónimo de la API: 100 consultas/min y 1000/día.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { RAIZ, asegurarDir, falla, ffmpeg, rutaPerfil } from "./lib.mjs";

const API = "https://api.openverse.org/v1/audio/";
const UA = "editor-reels-sfx/1.0";
const PERMITIDAS = { cc0: ["cc0"], by: ["cc0", "by"] };

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const DIR = rutaPerfil(null, "sfx", "openverse");
const LICENCIAS = rutaPerfil(null, "LICENCIAS.md");
const relRaiz = (p) => relative(RAIZ, p).split("\\").join("/");
const FUENTES = join(DIR, "fuentes.json");

async function pedir(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (r.status === 429) falla("Openverse: límite de consultas alcanzado (100/min, 1000/día). Espera un poco.", 1);
  if (!r.ok) falla(`Openverse respondió ${r.status} para ${url}`, 1);
  return r;
}

const limpio = (s) => String(s ?? "").replace(/[\r\n|]+/g, " ").trim().slice(0, 120);
const slugify = (s) => limpio(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "sfx";

async function buscar(q) {
  const lic = opt("licencia", "cc0");
  if (!PERMITIDAS[lic]) falla("--licencia debe ser cc0 o by");
  const max = Number(opt("max", 8));
  const durMax = Number(opt("dur-max", 3)) * 1000;
  const url = `${API}?q=${encodeURIComponent(q)}&license=${PERMITIDAS[lic].join(",")}&page_size=${Math.min(50, max * 3)}`;
  const d = await (await pedir(url)).json();
  const res = d.results
    .filter((r) => PERMITIDAS[lic].includes(r.license) && (!r.duration || r.duration <= durMax))
    .filter((r) => !/^LL-Q\d+/.test(r.title ?? "")) // grabaciones de pronunciación (Lingua Libre): voz, no SFX
    .slice(0, max);
  console.log(`"${q}" — ${d.result_count} resultados, se muestran ${res.length} (licencia ${PERMITIDAS[lic].join("/")}, ≤ ${durMax / 1000} s)\n`);
  for (const r of res) {
    console.log(`${r.id}\n  ${limpio(r.title)} — ${limpio(r.creator)} · ${r.license.toUpperCase()} ${r.license_version ?? ""} · ${((r.duration ?? 0) / 1000).toFixed(2)} s · ${r.source}\n  escuchar: ${r.url}\n  ficha:    ${r.foreign_landing_url}`);
  }
  if (res.length) console.log(`\nPara bajar uno: node herramientas/buscar-sfx.mjs --bajar <id> --nombre <nombre-corto>`);
}

async function bajar(id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) falla("El id de Openverse debe ser un UUID.");
  const r = await (await pedir(`${API}${id}/`)).json();
  if (!PERMITIDAS.by.includes(r.license)) falla(`Licencia ${r.license} no permitida (solo CC0 o CC BY).`);
  const nombre = slugify(opt("nombre", r.title));
  asegurarDir(join(DIR, "fuentes"));
  const ext = (r.filetype || "mp3").replace(/[^a-z0-9]/gi, "");
  const original = join(DIR, "fuentes", `${nombre}.${ext}`);
  const wav = join(DIR, `${nombre}.wav`);
  if (existsSync(wav)) falla(`Ya existe ${wav}; usa otro --nombre.`);
  const audio = Buffer.from(await (await pedir(r.url)).arrayBuffer());
  writeFileSync(original, audio);
  const f = ffmpeg(["-y", "-v", "error", "-i", original, "-ar", "48000", "-ac", "2", wav]);
  if (f.status !== 0) falla(`ffmpeg no pudo convertir: ${f.stderr}`, 1);

  const registro = {
    archivo: relRaiz(join(DIR, `${nombre}.wav`)), id: r.id, titulo: limpio(r.title), autor: limpio(r.creator),
    autor_url: r.creator_url, origen: r.foreign_landing_url, fuente: r.source,
    licencia: `${r.license.toUpperCase()} ${r.license_version ?? ""}`.trim(), licencia_url: r.license_url,
    atribucion: r.attribution ? String(r.attribution).replace(/[\r\n|]+/g, " ").trim() : null, descargado: new Date().toISOString().slice(0, 10),
  };
  const lista = existsSync(FUENTES) ? JSON.parse(readFileSync(FUENTES, "utf8")) : [];
  lista.push(registro);
  writeFileSync(FUENTES, JSON.stringify(lista, null, 2) + "\n");
  const credito = r.license === "cc0" ? "crédito opcional" : `**atribución obligatoria**: "${registro.titulo}" de ${registro.autor} (${registro.licencia_url})`;
  appendFileSync(LICENCIAS,
    `| ${registro.archivo} | SFX | ${registro.origen} (vía Openverse, autor: ${registro.autor}) | ${registro.licencia}, ${credito} |\n`);
  console.log(`✓ ${registro.archivo}  (${registro.licencia}, ${registro.autor})\n  registrado en ${relRaiz(FUENTES)} y ${relRaiz(LICENCIAS)}`);
  console.log(`  Para que Real SFX lo vea: cd .claude/skills/real-sfx && python scripts/build_index.py`);
}

const iBajar = args.indexOf("--bajar");
if (iBajar >= 0) await bajar(args[iBajar + 1]);
else {
  const q = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--"))).join(" ");
  if (!q) falla('Uso: node herramientas/buscar-sfx.mjs "soft pop" [--licencia cc0|by] [--max 8] [--dur-max 3]');
  await buscar(q);
}
