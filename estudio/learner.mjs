// Learner: aprende técnicas de edición de videos de referencia y las guarda en biblioteca/tecnicas/<slug>/.
//   tecnica.json  (nombre, categoría, descripción, cómo se hace, receta + parámetros, compatibilidad con la marca, ejemplos)
//   ejemplos/<fuente>-<momento>.mp4|.jpg   el momento exacto de cada video donde aparece
// biblioteca/tecnicas/fuentes.json lista los videos estudiados.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { marca } from "../herramientas/lib.mjs";
import { resolverPerfil } from "../herramientas/perfiles.mjs";
import { CATEGORIAS, RECETAS } from "../herramientas/efectos.mjs";
import { AGENTES, ejecutarAgente, tipoAgente } from "./agentes.mjs";

export const slugDe = (t) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
const hostDe = (x) => { try { return new URL(x).hostname.replace(/^www\./, ""); } catch { return "link"; } };

// ctx: utilidades del servidor (trabajos, logs, rutas) para no duplicarlas.
export function crearLearner(ctx) {
  const { RAIZ, BIB, leerJSON, leerTxt, rel, dentroDeRaiz, nuevoTrabajo, log, correr, nodo, terminar, plantilla, config, ocupado, ocupar } = ctx;
  const TEC = join(BIB, "tecnicas");
  let ytdlp;
  const hayYtDlp = () => (ytdlp ??= spawnSync("where", ["yt-dlp"], { encoding: "utf8" }).status === 0);

  function recetasPublicas() {
    return Object.fromEntries(Object.entries(RECETAS).map(([id, r]) => {
      const defs = Object.fromEntries(Object.entries(r.params).map(([k, v]) => [k, v.def]));
      return [id, { nombre: r.nombre, categoria: r.categoria, tipo: r.tipo, descripcion: r.descripcion, duracion: r.duracion, params: r.params,
        rasgos: typeof r.rasgos === "function" ? r.rasgos(defs) : r.rasgos }];
    }));
  }
  function listarTecnicas() {
    if (!existsSync(TEC)) return [];
    return readdirSync(TEC).filter((d) => !d.startsWith(".") && existsSync(join(TEC, d, "tecnica.json")))
      .map((d) => leerJSON(join(TEC, d, "tecnica.json"))).filter(Boolean)
      .sort((a, b) => (b.favorito ? 1 : 0) - (a.favorito ? 1 : 0) || (b.actualizada ?? "").localeCompare(a.actualizada ?? ""));
  }
  const fuentes = () => leerJSON(join(TEC, "fuentes.json"), []);

  function nuncaDeMarca() {
    // brand.md completo: además de "Nunca", trae las excepciones que el creador pidió (p. ej. la tarjeta del hook).
    // Perfil activo: las técnicas se juzgan contra la marca con la que estás trabajando.
    const p = resolverPerfil({});
    const md = leerTxt(join(p.dir, "brand.md")) ?? "";
    return `Perfil: ${p.nombre} (${rel(p.dir)})\n\n${md.trim()}\n\nAnimaciones (brand.json): ${JSON.stringify(marca(null, p.id).animaciones ?? {})}`;
  }

  function guardarTecnicas(fuente, resp, dirMom) {
    const mom = leerJSON(join(dirMom, "momentos.json"), { momentos: [] });
    const hechas = [];
    for (const t of resp.tecnicas ?? []) {
      const slug = slugDe(t.slug || t.nombre);
      if (!slug) continue;
      const dir = join(TEC, slug);
      mkdirSync(join(dir, "ejemplos"), { recursive: true });
      const prev = leerJSON(join(dir, "tecnica.json"));
      const receta = RECETAS[t.receta] ? t.receta : null;
      const params = receta ? Object.fromEntries(Object.entries(t.parametros ?? {}).filter(([k]) => k in RECETAS[receta].params)) : {};
      const ejemplos = prev?.ejemplos ?? [];
      for (const mid of t.momentos ?? []) {
        const m = mom.momentos.find((x) => x.id === mid);
        if (!m || ejemplos.some((e) => e.fuente === fuente.id && e.momento === mid)) continue;
        const base = `${fuente.id}-${mid}`;
        copyFileSync(join(RAIZ, m.clip), join(dir, "ejemplos", `${base}.mp4`));
        copyFileSync(join(RAIZ, m.miniatura), join(dir, "ejemplos", `${base}.jpg`));
        ejemplos.push({ fuente: fuente.id, momento: mid, video: mom.video, inicio: m.inicio, fin: m.fin,
          clip: rel(join(dir, "ejemplos", `${base}.mp4`)), miniatura: rel(join(dir, "ejemplos", `${base}.jpg`)) });
      }
      const nueva = {
        slug, nombre: t.nombre || slug, categoria: CATEGORIAS[t.categoria] ? t.categoria : "sin-ordenar",
        descripcion: t.descripcion ?? "", como_se_hace: t.como_se_hace ?? "", receta, parametros: params,
        duracion_s: Number(t.duracion_s) || RECETAS[receta]?.duracion || null,
        compatible_marca: t.compatible_marca !== false, motivo_marca: t.motivo_marca ?? "",
        etiquetas: (t.etiquetas ?? []).map((x) => String(x).toLowerCase()).slice(0, 8), creada: new Date().toISOString(),
      };
      // Lo aprendido antes (o editado por el creador) se conserva; solo se suman ejemplos y, si faltaba, la receta.
      const tec = prev ? { ...nueva, ...prev, receta: prev.receta ?? receta, parametros: prev.receta ? prev.parametros : params } : nueva;
      tec.ejemplos = ejemplos;
      tec.fuentes = [...new Set(ejemplos.map((e) => e.fuente))];
      tec.veces = ejemplos.length;
      tec.miniatura = ejemplos[0]?.miniatura ?? null;
      tec.actualizada = new Date().toISOString();
      writeFileSync(join(dir, "tecnica.json"), JSON.stringify(tec, null, 1) + "\n");
      hechas.push(slug);
    }
    elegirPortadas();
    const lista = fuentes().filter((f) => f.id !== fuente.id);
    lista.unshift({ ...fuente, resumen: resp.resumen ?? "", tecnicas: hechas, plano_medio_s: mom.plano_medio_s, cortes: mom.cortes?.length ?? 0,
      duracion: mom.duracion, miniatura: mom.momentos[0]?.miniatura ?? null, fecha: new Date().toISOString() });
    mkdirSync(TEC, { recursive: true });
    writeFileSync(join(TEC, "fuentes.json"), JSON.stringify(lista, null, 1) + "\n");
    return hechas;
  }

  // Portada de cada técnica = su ejemplo menos compartido con otras técnicas (si no, todas muestran el primer momento del video).
  function elegirPortadas() {
    const todas = listarTecnicas();
    const usos = new Map();
    for (const t of todas) for (const e of t.ejemplos ?? []) usos.set(e.clip.replace(/^.*\/ejemplos\//, ""), (usos.get(e.clip.replace(/^.*\/ejemplos\//, "")) ?? 0) + 1);
    for (const t of todas) {
      if (!t.ejemplos?.length) continue;
      const orden = [...t.ejemplos].sort((a, b) => usos.get(a.clip.replace(/^.*\/ejemplos\//, "")) - usos.get(b.clip.replace(/^.*\/ejemplos\//, "")));
      t.ejemplos = orden;
      t.miniatura = orden[0].miniatura;
      writeFileSync(join(TEC, t.slug, "tecnica.json"), JSON.stringify(t, null, 1) + "\n");
    }
  }

  async function lanzar({ ruta: r, url: enlace, agente, modelo, esfuerzo, texto }) {
    const pedido = ctx.eleccionAgente({ agente, modelo, esfuerzo, tarea: "aprender" });
    agente = pedido.agente;
    if (ocupado()) throw new Error(`ya hay un agente trabajando (${ocupado().titulo}); espera a que termine`);
    let video = null;
    if (enlace) {
      let u;
      try { u = new URL(enlace); } catch { throw new Error("el link no es válido"); }
      if (!/^https?:$/.test(u.protocol) || /["%^`<>|\s]/.test(enlace)) throw new Error("el link no es válido");
      if (!hayYtDlp()) throw new Error("para pegar links falta yt-dlp (winget install yt-dlp); mientras, sube el MP4");
    } else {
      video = dentroDeRaiz(String(r ?? ""));
      if (!existsSync(video)) throw new Error("no existe el video");
    }
    const id = `f${Date.now().toString(36)}`;
    const t = nuevoTrabajo("agente", `${AGENTES[agente].nombre} · Learner · ${enlace ? hostDe(enlace) : basename(video)}`, { agente, tarea: "aprender", fuente: id, chat: "learner", pedido: (String(texto ?? "").trim() ? `${String(texto).trim()} — ` : "") + `Aprende las técnicas de ${enlace ?? basename(video)}` });
    t.meta.pedido_ia = pedido;
    ocupar(t);
    (async () => {
      if (enlace) {
        log(t, "▶ Descargando el video (solo para estudiarlo en tu computador)…");
        const dest = join(BIB, "inspiracion");
        mkdirSync(dest, { recursive: true });
        const c = await correr(t, "yt-dlp", ["--no-playlist", "--no-progress", "-f", "mp4/bv*+ba/b", "--merge-output-format", "mp4", "--max-filesize", "400M",
          "-o", join(dest, `learner-${id}.%(ext)s`), enlace]);
        const f = readdirSync(dest).find((x) => x.startsWith(`learner-${id}.`) && !/\.(part|ytdl)$/.test(x));
        if (c !== 0 || !f) { log(t, "✗ No se pudo descargar (Instagram a veces pide iniciar sesión). Descárgalo tú y súbelo como MP4."); return 1; }
        video = join(dest, f);
      }
      let c = await correr(t, ...nodo("aprender.mjs", video, id));
      if (c !== 0) return c;
      const dirMom = join(BIB, ".cache", "learner", id);
      const respuesta = `estudio/trabajos/${t.id}-respuesta.json`;
      const existentes = listarTecnicas().map((x) => `- ${x.slug}: ${x.nombre} (${x.categoria}) — ${x.descripcion}`).join("\n") || "(ninguna todavía)";
      const recetas = Object.entries(RECETAS).map(([k, x]) =>
        `- ${k}: ${x.nombre} (${x.categoria}) — ${x.descripcion} Parámetros: ${Object.entries(x.params).map(([p, d]) => `${p}=${JSON.stringify(d.def)}`).join(", ")}`).join("\n");
      const prompt = plantilla("aprender", { archivo: rel(video), momentos: rel(join(dirMom, "momentos.json")), existentes, recetas, marca: nuncaDeMarca(), respuesta, texto: texto ?? "" });
      log(t, `▶ ${AGENTES[agente].nombre} mira los momentos…`);
      c = await ejecutarAgente(agente, prompt, { cwd: RAIZ, env: { REELS_PERFIL: resolverPerfil({}).id }, onLinea: (l) => log(t, l, tipoAgente(l)), onProceso: (p) => (t.proc = p), ...ctx.opcionesAgente(t, "aprender") });
      if (c !== 0) return c;
      const resp = leerJSON(join(RAIZ, respuesta));
      if (!resp?.tecnicas?.length) { log(t, "✗ el agente no escribió técnicas en la respuesta JSON"); return 1; }
      const hechas = guardarTecnicas({ id, video: rel(video), url: enlace ?? null, titulo: basename(video) }, resp, dirMom);
      t.meta.tecnicas = hechas;
      log(t, `✔ ${hechas.length} técnicas guardadas: ${hechas.join(", ")}`);
      if (enlace) await correr(t, ...nodo("indexar.mjs"));
      return 0;
    })().catch((e) => { log(t, `✗ ${e.message}`); return 1; }).then((c) => { ocupar(null); terminar(t, c); });
    return t;
  }

  function actualizar(slug, cambios) {
    const p = join(TEC, slugDe(slug), "tecnica.json");
    const tec = leerJSON(p);
    if (!tec) throw new Error("técnica no encontrada");
    for (const k of ["nombre", "descripcion", "como_se_hace", "motivo_marca", "favorito", "compatible_marca", "duracion_s"]) if (cambios[k] !== undefined) tec[k] = cambios[k];
    if (cambios.categoria && CATEGORIAS[cambios.categoria]) tec.categoria = cambios.categoria;
    if (cambios.receta !== undefined) { tec.receta = RECETAS[cambios.receta] ? cambios.receta : null; if (!tec.receta) tec.parametros = {}; }
    if (cambios.parametros && tec.receta) tec.parametros = Object.fromEntries(Object.entries(cambios.parametros).filter(([k]) => k in RECETAS[tec.receta].params));
    if (cambios.etiquetas) tec.etiquetas = cambios.etiquetas.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
    tec.editada = true;
    tec.actualizada = new Date().toISOString();
    writeFileSync(p, JSON.stringify(tec, null, 1) + "\n");
    return tec;
  }

  // Quitar = mover a biblioteca/tecnicas/.papelera (no se borra nada).
  function quitar(slug) {
    const d = join(TEC, slugDe(slug));
    if (!existsSync(join(d, "tecnica.json"))) throw new Error("técnica no encontrada");
    mkdirSync(join(TEC, ".papelera"), { recursive: true });
    renameSync(d, join(TEC, ".papelera", `${slugDe(slug)}-${Date.now().toString(36)}`));
    return { ok: true };
  }

  const estado = () => ({ tecnicas: listarTecnicas(), fuentes: fuentes(), recetas: recetasPublicas(), categorias: CATEGORIAS, ytdlp: hayYtDlp() });
  return { estado, lanzar, actualizar, quitar };
}
