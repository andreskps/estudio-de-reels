// Perfiles de marca: cada marca es una carpeta registrada por su ruta en perfiles/indice.json.
// El perfil "andres" es marca/ (no se mueve); la base trae "ejemplo" en perfiles/ejemplo/.
// Un reel guarda su perfil en reels/<slug>/reel.json; los reels anteriores a los perfiles son de "andres".
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { validarMarca } from "./marca-esquema.mjs";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ_BASE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const POR_DEFECTO = { activo: "andres", perfiles: [{ id: "andres", nombre: "Andres", ruta: "marca" }] };
export const ID_PERFIL = /^[a-z0-9][a-z0-9-]{0,40}$/;
const leer = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };
const rutaIndice = (raiz) => join(raiz, "perfiles", "indice.json");

export function indicePerfiles(raiz = RAIZ_BASE) {
  const i = leer(rutaIndice(raiz));
  return i?.perfiles?.length ? i : structuredClone(POR_DEFECTO);
}

function carpeta(raiz, p) {
  const dir = normalize(join(raiz, p.ruta));
  if (!dir.startsWith(normalize(raiz) + sep)) throw new Error(`El perfil «${p.id}» apunta fuera del proyecto.`);
  return dir;
}
const conDir = (raiz, p, i) => ({ ...p, dir: carpeta(raiz, p), activo: p.id === i.activo });

export function listaPerfiles(raiz = RAIZ_BASE, { archivados = false } = {}) {
  const i = indicePerfiles(raiz);
  return i.perfiles.filter((p) => archivados || !p.archivado).map((p) => conDir(raiz, p, i));
}

// Perfil de un reel o de una herramienta, en este orden:
// 1) id pedido (--perfil en la CLI o elegido en el Estudio)
// 2) reels/<slug>/reel.json → perfil
// 3) reel que existe sin reel.json → "andres" (compatibilidad con los reels anteriores)
// 4) sin reel: la variable REELS_PERFIL (la pone el Estudio al lanzar un agente) o el perfil activo
export function resolverPerfil({ raiz = RAIZ_BASE, slug, id } = {}) {
  const i = indicePerfiles(raiz);
  let elegido = id || null, origen = id ? "pedido" : null;
  if (!elegido && slug) {
    const r = leer(join(raiz, "reels", slug, "reel.json"));
    if (r?.perfil) [elegido, origen] = [r.perfil, "reel.json"];
    else if (existsSync(join(raiz, "reels", slug)) && i.perfiles.some((p) => p.id === "andres")) [elegido, origen] = ["andres", "reel anterior a los perfiles"];
  }
  if (!elegido && process.env.REELS_PERFIL) [elegido, origen] = [process.env.REELS_PERFIL, "REELS_PERFIL"];
  if (!elegido) [elegido, origen] = [i.activo, "activo"];
  const p = i.perfiles.find((x) => x.id === elegido);
  if (!p) throw new Error(`No existe el perfil «${elegido}». Perfiles: ${i.perfiles.map((x) => x.id).join(", ")}.`);
  return { ...conDir(raiz, p, i), origen };
}

export function fijarActivo(id, raiz = RAIZ_BASE) {
  const i = indicePerfiles(raiz);
  const p = i.perfiles.find((x) => x.id === id && !x.archivado);
  if (!p) throw new Error(`No existe el perfil «${id}».`);
  i.activo = id;
  mkdirSync(dirname(rutaIndice(raiz)), { recursive: true });
  writeFileSync(rutaIndice(raiz), JSON.stringify(i, null, 2) + "\n");
  return conDir(raiz, p, i);
}

// Escribe reel.json de un reel nuevo (nunca reasigna el perfil de uno que ya lo tiene).
export function escribirReel(slug, datos, raiz = RAIZ_BASE) {
  const p = join(raiz, "reels", slug, "reel.json");
  const previo = leer(p) ?? {};
  if (previo.perfil && datos.perfil && previo.perfil !== datos.perfil) throw new Error(`El reel ya es del perfil «${previo.perfil}».`);
  resolverPerfil({ raiz, id: datos.perfil ?? previo.perfil }); // valida que exista
  const r = { ...previo, ...datos, creado: previo.creado ?? new Date().toISOString() };
  writeFileSync(p, JSON.stringify(r, null, 2) + "\n");
  return r;
}

// Rutas de solo lectura de todos los perfiles (relativas a la raíz, con "/").
export function rutasMisReels(raiz = RAIZ_BASE) {
  return listaPerfiles(raiz, { archivados: true }).map((p) => `${p.ruta.replace(/\\/g, "/").replace(/\/$/, "")}/mis-reels/`);
}

// ---------- crear, duplicar, archivar y guardar (fase 3: asistente de marca) ----------
const CARPETAS = ["logo", "fuentes", "sfx", "musica", "mis-reels"];
const NO_DUPLICAR = new Set(["mis-reels", "analisis", "historial"]); // los reels propios son originales: no se copian
function guardarIndice(i, raiz) {
  mkdirSync(dirname(rutaIndice(raiz)), { recursive: true });
  const p = rutaIndice(raiz);
  writeFileSync(p + ".tmp", JSON.stringify(i, null, 2) + "\n");
  renameSync(p + ".tmp", p);
}

// Perfil nuevo en perfiles/<id>/ copiando la marca de `desde` (por defecto el ejemplo neutro de la base).
// Nunca pisa una carpeta ni un id existentes (tampoco los archivados).
export function crearPerfil({ id, nombre, desde = "ejemplo" }, raiz = RAIZ_BASE) {
  if (!ID_PERFIL.test(id ?? "")) throw new Error("El id del perfil solo admite minúsculas, números y guiones.");
  if (!String(nombre ?? "").trim()) throw new Error("Ponle un nombre al perfil.");
  const i = indicePerfiles(raiz);
  if (i.perfiles.some((p) => p.id === id)) throw new Error(`Ya existe un perfil «${id}»${i.perfiles.find((p) => p.id === id).archivado ? " (archivado)" : ""}.`);
  const origen = i.perfiles.find((p) => p.id === desde);
  if (!origen) throw new Error(`No existe el perfil «${desde}» para copiar.`);
  const dirOrigen = carpeta(raiz, origen);
  const ruta = `perfiles/${id}`;
  const dir = join(raiz, ruta);
  if (existsSync(dir)) throw new Error(`La carpeta ${ruta}/ ya existe; elige otro id.`);
  mkdirSync(dir, { recursive: true });
  for (const e of existsSync(dirOrigen) ? readdirSync(dirOrigen) : []) {
    if (NO_DUPLICAR.has(e) || e.startsWith(".")) continue;
    cpSync(join(dirOrigen, e), join(dir, e), { recursive: true });
  }
  for (const c of CARPETAS) {
    mkdirSync(join(dir, c), { recursive: true });
    if (!readdirSync(join(dir, c)).length) writeFileSync(join(dir, c, ".gitkeep"), "");
  }
  const p = { id, nombre: String(nombre).trim(), ruta, creado: new Date().toISOString().slice(0, 10), desde };
  i.perfiles.push(p);
  guardarIndice(i, raiz);
  return conDir(raiz, p, i);
}

// Archivar oculta el perfil de las listas (sus reels lo siguen usando); nunca borra la carpeta.
export function archivarPerfil(id, archivar = true, raiz = RAIZ_BASE) {
  const i = indicePerfiles(raiz);
  const p = i.perfiles.find((x) => x.id === id);
  if (!p) throw new Error(`No existe el perfil «${id}».`);
  if (archivar) {
    if (i.activo === id) throw new Error("No puedes archivar el perfil activo: activa otro primero.");
    if (i.perfiles.filter((x) => !x.archivado && x.id !== id).length === 0) throw new Error("Tiene que quedar al menos un perfil sin archivar.");
    p.archivado = true;
  } else delete p.archivado;
  guardarIndice(i, raiz);
  return conDir(raiz, p, i);
}

// Guarda brand.json (y brand.md si se pasa) de un perfil, solo si la marca es válida.
// La versión anterior queda en <perfil>/historial/ (nunca se pierde una marca), salvo { historial: false }
// (la primera marca de un perfil recién creado, que solo reemplaza la copia del ejemplo).
export function guardarMarca(id, brand, md = null, raiz = RAIZ_BASE, { historial = true } = {}) {
  const errores = validarMarca(brand);
  if (errores.length) { const e = new Error(`La marca no es válida:\n- ${errores.join("\n- ")}`); e.errores = errores; throw e; }
  const p = resolverPerfil({ raiz, id });
  mkdirSync(p.dir, { recursive: true });
  const sello = new Date().toISOString().replace(/[:.]/g, "-");
  for (const [f, txt] of [["brand.json", JSON.stringify(brand, null, 2) + "\n"], ["brand.md", md]]) {
    if (txt == null) continue;
    const destino = join(p.dir, f);
    if (historial && existsSync(destino)) {
      if (readFileSync(destino, "utf8") === txt) continue; // sin cambios: ni copia ni escritura
      mkdirSync(join(p.dir, "historial"), { recursive: true });
      copyFileSync(destino, join(p.dir, "historial", `${sello}-${f}`));
    }
    writeFileSync(destino + ".tmp", txt);
    renameSync(destino + ".tmp", destino);
  }
  return p;
}

// Anota datos sueltos en la entrada del índice (p. ej. cuánto tardó el asistente: meta E1 < 5 min).
export function anotarPerfil(id, datos, raiz = RAIZ_BASE) {
  const i = indicePerfiles(raiz);
  const p = i.perfiles.find((x) => x.id === id);
  if (!p) throw new Error(`No existe el perfil «${id}».`);
  Object.assign(p, datos);
  guardarIndice(i, raiz);
  return conDir(raiz, p, i);
}
