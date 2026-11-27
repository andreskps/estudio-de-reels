// Marca: página del perfil (vista previa 9:16, crear / duplicar / archivar, «Afinar con mis reels»)
// y asistente de marca nueva por pasos (meta E1: < 5 min). El esquema y el armado de la marca son los mismos
// que usan el servidor y las herramientas: /herramientas/marca-esquema.mjs.
import { $, api, archivo, confirmar, h, intentar, md, preguntar, toast } from "./comun.js";
import { ESTILOS_SUBTITULO, FUENTES_OFL, OPCIONES_NUNCA, PLATAFORMAS, marcaDesdeAsistente, validarMarca } from "/herramientas/marca-esquema.mjs";

const NOMBRE_PLAT = { instagram: "Instagram Reels", tiktok: "TikTok", shorts: "YouTube Shorts" };
const MUESTRA = "Así se verán tus subtítulos";
const TAMANOS = [["Pequeño", 56], ["Mediano", 64], ["Grande", 72]];

// ---------- fuentes en el navegador (solo para las vistas previas) ----------
let fuentesCargadas = false;
function cargarFuentesOFL() {
  if (fuentesCargadas) return;
  fuentesCargadas = true;
  const fam = FUENTES_OFL.map((f) => `family=${f.familia.replace(/ /g, "+")}${f.pesos.length > 1 ? `:wght@${f.pesos.join(";")}` : ""}`).join("&");
  document.head.append(h("link", { rel: "stylesheet", href: `https://fonts.googleapis.com/css2?${fam}&display=swap` }));
}
async function cargarFuentePropia(familia, file) {
  const f = new FontFace(familia, await file.arrayBuffer());
  await f.load();
  document.fonts.add(f);
}
// Fuente de un perfil con archivo propio: se carga desde su carpeta para la vista previa.
const fuentesPerfil = new Set();
function fuenteDePerfil(perfil, f) {
  if (!f?.archivo || fuentesPerfil.has(perfil.ruta + f.archivo)) return;
  fuentesPerfil.add(perfil.ruta + f.archivo);
  new FontFace(f.familia, `url(${archivo(`${perfil.ruta}/${f.archivo}`)})`).load().then((x) => document.fonts.add(x)).catch(() => {});
}

// ---------- vista previa 9:16 ----------
// Dibuja con las mismas reglas que herramientas/generar.mjs: centro, ancho máximo, contorno, caja, mayúsculas y palabra resaltada.
function palabraClave(t) {
  return t.split(/\s+/).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).filter((w) => w.length >= 4).reduce((a, w) => (w.length > a.length ? w : a), "");
}
export function vistaPrevia(b, { ancho = 270, zona = true, texto = MUESTRA, tarjeta = true } = {}) {
  const k = ancho / 1080, S = b.subtitulos, z = b.zona_segura, c = b.colores;
  const pct = (v, total) => `${(v / total) * 100}%`;
  const caja = h("div.v916", { style: { width: `${ancho}px` } });
  // fondo: una persona de referencia para ver dónde cae el texto respecto a la cara
  caja.append(h("div.v916-cabeza"), h("div.v916-hombros"));
  if (zona) for (const [l, t, w, hh] of [[0, 0, 1080, z.arriba], [0, 1920 - z.abajo, 1080, z.abajo], [1080 - z.derecha, 0, z.derecha, 1920], [0, 0, z.izquierda, 1920]])
    caja.append(h("div.v916-zona", { style: { left: pct(l, 1080), top: pct(t, 1920), width: pct(w, 1080), height: pct(hh, 1920) } }));
  const TF = b.fuentes.titulos ?? b.fuentes.subtitulos;
  if (tarjeta) caja.append(h("div.v916-tarjeta", { style: { top: pct(380, 1920), left: pct(z.izquierda, 1080), right: pct(z.derecha, 1080) } },
    h("div", { style: { fontFamily: `"${TF.familia}", sans-serif`, fontWeight: TF.peso, fontSize: `${60 * k}px`, padding: `${22 * k}px ${40 * k}px`, borderRadius: `${26 * k}px` } }, "Tu título aquí")));
  const span = h("span", { style: {
    fontFamily: `"${b.fuentes.subtitulos.familia}", sans-serif`, fontWeight: b.fuentes.subtitulos.peso, fontSize: `${S.tamano_base_px * k}px`, lineHeight: 1.12,
    color: c.principal, maxWidth: `${S.ancho_max_px * k}px`, WebkitTextStroke: S.contorno_px ? `${S.contorno_px * 2 * k}px ${c.contorno}` : "0", paintOrder: "stroke fill",
    textShadow: `0 ${3 * k}px ${10 * k}px rgba(0,0,0,.45)`, textTransform: S.mayusculas ? "uppercase" : "none",
    background: S.caja ? c.fondo_tarjeta : "none", borderRadius: S.caja ? `${18 * k}px` : 0, padding: S.caja ? `${8 * k}px ${26 * k}px ${12 * k}px` : 0 } });
  const clave = S.resaltado?.modo === "palabra" ? palabraClave(texto) : "";
  for (const [i, w] of texto.split(" ").entries()) {
    if (i) span.append(" ");
    span.append(clave && w.replace(/[^\p{L}\p{N}]/gu, "") === clave
      ? h("span", { style: { color: S.resaltado.color ?? c.acento, display: "inline-block", transform: `scale(${S.resaltado.escala ?? 1})` } }, w) : w);
  }
  caja.append(h("div.v916-sub", { style: { top: pct(S.centro_y_px, 1920) } }, span));
  return caja;
}

// ---------- colores desde el logo ----------
const hex = (r, g, b) => "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
async function coloresDeImagen(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, 64, 64);
  const d = ctx.getImageData(0, 0, 64, 64).data, cubos = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const q = [d[i], d[i + 1], d[i + 2]].map((v) => Math.min(255, Math.round(v / 24) * 24));
    const kq = q.join(","), e = cubos.get(kq) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += d[i]; e.g += d[i + 1]; e.b += d[i + 2]; cubos.set(kq, e);
  }
  return [...cubos.values()].map((e) => {
    const r = Math.round(e.r / e.n), g = Math.round(e.g / e.n), b = Math.round(e.b / e.n);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), sat = max ? (max - min) / max : 0, lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return { hex: hex(r, g, b), n: e.n, sat, lum };
  }).sort((a, b) => b.n - a.n).slice(0, 12);
}
function sugerirColores(paleta) {
  const vivos = paleta.filter((c) => c.sat > 0.35 && c.lum > 0.15 && c.lum < 0.92).sort((a, b) => b.n * (0.3 + b.sat) - a.n * (0.3 + a.sat));
  const oscuro = paleta.filter((c) => c.lum < 0.18).sort((a, b) => b.n - a.n)[0];
  return { principal: "#FFFFFF", acento: vivos[0]?.hex ?? null, contorno: oscuro?.hex ?? "#000000" };
}

// ---------- página Marca ----------
export async function verMarca(principal, id, alCambiarActivo) {
  const q = id ? `?perfil=${encodeURIComponent(id)}` : "";
  const [{ perfil: P, brand: b, md: texto, licencias, mis_reels: misReels, propuesta }, perfiles, todos] = await Promise.all([
    api(`/api/marca${q}`), api("/api/perfiles"), api("/api/perfiles?archivados")]);
  cargarFuentesOFL(); fuenteDePerfil(P, b.fuentes.subtitulos);
  const recargar = () => verMarca(principal, P.id, alCambiarActivo);
  const activo = perfiles.find((p) => p.activo);
  const selPerfil = h("select", { "aria-label": "Perfil que estás viendo", on: { change: () => (location.hash = `#/marca/${selPerfil.value}`) } },
    perfiles.map((p) => h("option", { value: p.id, selected: p.id === P.id }, `${p.nombre}${p.activo ? " · activo" : ""}`)),
    P.archivado ? h("option", { value: P.id, selected: true }, `${P.nombre} · archivado`) : null);
  const archivados = todos.filter((p) => p.archivado);

  const acciones = h("div.fila",
    !P.activo && !P.archivado && h("button.btn.prim.chico", { on: { click: intentar(async () => { await api("/api/perfiles/activo", { json: { id: P.id } }); toast(`«${P.nombre}» es ahora el perfil activo`); await alCambiarActivo?.(); recargar(); }) } }, "Usar para los reels nuevos"),
    h("a.btn.chico", { href: "#/marca/nueva" }, "＋ Crear marca"),
    h("button.btn.chico", { title: "Copia esta marca (sin tus reels propios) para crear una parecida", on: { click: intentar(async () => {
      const nombre = await preguntar("Nombre de la marca nueva", `${P.nombre} (copia)`);
      if (!nombre) return;
      const n = await api("/api/perfiles", { json: { nombre, desde: P.id } });
      toast(`Perfil «${n.nombre}» creado`); location.hash = `#/marca/${n.id}`;
    }) } }, "⧉ Duplicar"),
    P.asistente && h("a.btn.chico", { href: `#/marca/nueva/${P.id}` }, "✎ Rehacer con el asistente"),
    !P.activo && !P.archivado && h("button.btn.chico", { title: "Lo oculta de las listas; sus reels lo siguen usando. No borra nada.", on: { click: intentar(async () => {
      if (!(await confirmar(`¿Archivar «${P.nombre}»? Se oculta de las listas, pero su carpeta y sus reels quedan intactos.`, { si: "Archivar" }))) return;
      await api(`/api/perfiles/${P.id}/archivar`, { json: { archivar: true } }); toast("Perfil archivado"); location.hash = "#/marca";
    }) } }, "🗄 Archivar"),
    P.archivado && h("button.btn.chico", { on: { click: intentar(async () => { await api(`/api/perfiles/${P.id}/archivar`, { json: { archivar: false } }); toast("Perfil restaurado"); recargar(); }) } }, "↩ Restaurar"));

  const z = b.zona_segura;
  principal.replaceChildren(h("div.pagina",
    h("div.cabecera", h("h1", "Marca"), h("label.fila", h("span.tenue", "Perfil"), selPerfil), h("span.sub", b.estado ?? ""), h("div.espacio"),
      h("span.tenue", `Carpeta ${P.ruta}/ · ${P.activo ? "los reels nuevos usan este perfil" : `el activo es «${activo?.nombre}»`}; cada reel guarda el suyo.`)),
    acciones,
    h("div.dos", { style: { marginTop: "14px" } },
      h("div", { style: { display: "grid", gap: "14px" } },
        propuesta && cajaPropuesta(P, b, propuesta, recargar),
        h("div.caja", h("h3", { style: { marginTop: 0 } }, "Colores"), h("div.fila", Object.entries(b.colores).filter(([, v]) => v).map(([k, v]) =>
          h("div", { style: { textAlign: "center", fontSize: "12px" } }, h("div", { style: { width: "64px", height: "44px", borderRadius: "8px", background: v, border: "1px solid #333" } }), k.replace("_", " "))))),
        h("div.caja", h("h3", { style: { marginTop: 0 } }, "Tipografía y subtítulos"),
          h("div.tenue", `${b.fuentes.subtitulos.familia} ${b.fuentes.subtitulos.peso}${b.fuentes.subtitulos.archivo ? ` (${b.fuentes.subtitulos.archivo})` : ""} · ${b.subtitulos.tamano_base_px}px · ${b.subtitulos.palabras_por_grupo.join("–")} palabras · máx. ${b.subtitulos.lineas_max} líneas · centro y ${b.subtitulos.centro_y_px}px · ancho ${b.subtitulos.ancho_max_px}px`,
            b.subtitulos.mayusculas ? " · mayúsculas" : "", b.subtitulos.caja ? " · con caja" : "", b.subtitulos.resaltado?.modo === "palabra" ? " · palabra resaltada" : "")),
        h("div.caja", h("h3", { style: { marginTop: 0 } }, "Nunca"), h("ul", b.nunca.map((n) => h("li", n)))),
        cajaAfinar(P, misReels, recargar),
        h("details.caja", h("summary", "brand.md (lo que leen los agentes)"), h("div.md", { html: md(texto ?? "") })),
        licencias && h("details.caja", h("summary", "Licencias registradas"), h("div.md", { html: md(licencias) })),
        archivados.length ? h("details.caja", h("summary", `Perfiles archivados (${archivados.length})`), h("ul", archivados.map((p) => h("li", h("a", { href: `#/marca/${p.id}` }, p.nombre), h("span.tenue", ` · ${p.ruta}/`))))) : null),
      h("div.caja", h("h3", { style: { marginTop: 0 } }, "Vista previa 9:16"),
        h("div.fila", { style: { alignItems: "flex-start" } }, vistaPrevia(b),
          h("div.tenue", h("b", "Zona segura"), h("br"), `Arriba ${z.arriba}px`, h("br"), `Abajo ${z.abajo}px`, h("br"), `Derecha ${z.derecha}px`, h("br"), `Izquierda ${z.izquierda}px`,
            h("br"), h("br"), "Lo rojo queda tapado por la interfaz de la app: nada legible ahí.")),
        h("h3", "Animación"), h("div.tenue", b.animaciones.filosofia ?? ""), h("div.tenue", `Zoom: ${b.animaciones.zoom_punch_in.escala}× · ${b.animaciones.zoom_punch_in.max_por_video == null ? "suaves, los que hagan falta" : `máx. ${b.animaciones.zoom_punch_in.max_por_video} por video`}`),
        b.animaciones.rasgos_prohibidos?.length ? h("div.tenue", `Prohibido: ${b.animaciones.rasgos_prohibidos.join(", ")}`) : null,
        h("h3", "Audio"), h("div.tenue", `${b.audio.lufs} LUFS · ${b.audio.sfx ? "con SFX" : "sin SFX"} · música ${b.audio.musica_db_bajo_voz} dB bajo la voz · ${b.audio.musica}`),
        P.asistente_s ? h("div.tenue", { style: { marginTop: "10px" } }, `Creada con el asistente en ${tiempoMS(P.asistente_s)}.`) : null))));
}
const tiempoMS = (s) => `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, "0")} s`;

function cajaAfinar(P, misReels, recargar) {
  const input = h("input", { type: "file", accept: "video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm", multiple: true, hidden: true, on: { change: intentar(async () => {
    for (const f of input.files) {
      toast(`Subiendo ${f.name}…`);
      const r = await fetch(`/api/perfiles/${P.id}/subir?destino=mis-reels&nombre=${encodeURIComponent(f.name)}`, { method: "POST", body: f });
      if (!r.ok) throw new Error((await r.json()).error);
    }
    toast("Reels subidos"); recargar();
  }) } });
  const afinar = intentar(async () => { const { abrirChat } = await import("./chat.js"); abrirChat({ perfil: P.id, perfilNombre: P.nombre, tarea: "afinar-marca" }); });
  return h("div.caja", h("h3", { style: { marginTop: 0 } }, "Afinar con mis reels"),
    h("div.tenue", "Sube 1–3 reels tuyos ya publicados. Un agente los mira (tamaño y altura de los subtítulos, colores, ritmo, lo que nunca haces) y te propone ajustes. Nada se cambia hasta que tú lo apruebes. Tus reels quedan en ", h("code", `${P.ruta}/mis-reels/`), " y nunca se modifican."),
    misReels.length ? h("ul", misReels.map((v) => h("li", h("a", { href: archivo(v.ruta), target: "_blank" }, v.nombre)))) : h("div.tenue", { style: { margin: "8px 0" } }, "Todavía no hay reels."),
    h("div.fila", input, h("button.btn.chico", { on: { click: () => input.click() } }, "⬆ Subir reels"),
      h("button.btn.prim.chico", { disabled: !misReels.length, title: misReels.length ? "Elige agente, modelo y esfuerzo en el chat" : "Sube al menos un reel", on: { click: afinar } }, "✨ Afinar con IA")));
}

// Cambios hoja por hoja entre dos marcas («subtitulos.tamano_base_px: 64 → 70»).
function diferencias(a, b, pre = "") {
  const out = [];
  for (const k of new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])) {
    const x = a?.[k], y = b?.[k];
    if (x && y && typeof x === "object" && typeof y === "object" && !Array.isArray(x) && !Array.isArray(y)) out.push(...diferencias(x, y, `${pre}${k}.`));
    else if (JSON.stringify(x) !== JSON.stringify(y)) out.push({ clave: pre + k, antes: x, despues: y });
  }
  return out;
}
const ver = (v) => (v == null ? "—" : Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v));
function cajaPropuesta(P, b, pr, recargar) {
  const cambios = diferencias(b, pr.brand).filter((d) => d.clave !== "nunca");
  const resolver = (que) => intentar(async () => {
    if (que === "aplicar" && !(await confirmar(`¿Aplicar ${cambios.length + pr.nunca_nuevas.length} cambio(s) a «${P.nombre}»? La marca anterior queda guardada en ${P.ruta}/historial/.`, { si: "Aplicar" }))) return;
    await api(`/api/perfiles/${P.id}/propuesta`, { json: { trabajo: pr.trabajo, accion: que } });
    toast(que === "aplicar" ? "Marca actualizada" : "Propuesta descartada"); recargar();
  });
  return h("div.caja.propuesta", h("h3", { style: { marginTop: 0 } }, "✨ Propuesta desde tus reels", pr.confianza ? h("span.tenue", ` · confianza ${pr.confianza}`) : null),
    cambios.length || pr.nunca_nuevas.length ? h("table.difs", cambios.map((d) => h("tr", h("td", h("code", d.clave)), h("td.tenue", ver(d.antes)), h("td", "→ ", h("b", ver(d.despues))))),
      pr.nunca_nuevas.map((n) => h("tr", h("td", h("code", "nunca")), h("td.tenue", "—"), h("td", "＋ ", h("b", n))))) : h("div.tenue", "Sin cambios: tus reels ya coinciden con la marca."),
    pr.motivos?.length ? h("details", h("summary.tenue", "Por qué"), h("ul", pr.motivos.map((m) => h("li", m)))) : null,
    pr.errores?.length ? h("div.error-txt", "No se puede aplicar: ", pr.errores.join("; ")) : null,
    h("div.fila", { style: { alignItems: "flex-start", marginTop: "8px" } }, h("div", h("div.tenue", "Ahora"), vistaPrevia(b, { ancho: 150, tarjeta: false })), h("div", h("div.tenue", "Con la propuesta"), vistaPrevia(pr.brand, { ancho: 150, tarjeta: false }))),
    h("div.fila", h("div.espacio"), h("button.btn.chico", { on: { click: resolver("descartar") } }, "Descartar"),
      h("button.btn.prim.chico", { disabled: !!pr.errores?.length || !(cambios.length || pr.nunca_nuevas.length), on: { click: resolver("aplicar") } }, "Aplicar a mi marca")));
}

// ---------- asistente de marca nueva ----------
// Respuestas → marcaDesdeAsistente (mismo armado que el servidor). El perfil se crea al final (no quedan perfiles a medias).
export async function asistenteMarca(principal, editar, alCambiarActivo) {
  cargarFuentesOFL();
  const inicio = Date.now();
  const base = (await api("/api/marca?perfil=ejemplo")).brand;
  let previo = null;
  if (editar) previo = await api(`/api/marca?perfil=${encodeURIComponent(editar)}`);
  const pb = previo?.brand;
  const r = {
    nombre: pb?.creador.nombre ?? "", usuario: pb?.creador.usuario ?? "", plataformas: pb?.creador.plataformas ?? ["instagram", "tiktok"],
    fuente: pb ? { familia: pb.fuentes.subtitulos.familia, peso: pb.fuentes.subtitulos.peso, archivo: pb.fuentes.subtitulos.archivo } : { familia: "Montserrat" },
    colores: pb ? { principal: pb.colores.principal, acento: pb.colores.acento, contorno: pb.colores.contorno } : { principal: "#FFFFFF", acento: "#FFD43B", contorno: "#000000" },
    estilo: pb?.subtitulos.estilo ?? "limpio", tamano: pb?.subtitulos.tamano_base_px ?? null,
    nunca: pb ? OPCIONES_NUNCA.filter((o) => pb.nunca.includes(o.texto)).map((o) => o.id) : OPCIONES_NUNCA.filter((o) => o.defecto).map((o) => o.id),
    logo: pb?.logo.archivo ?? null,
  };
  const archivos = { logo: null, logoURL: pb?.logo.archivo ? archivo(`${previo.perfil.ruta}/${pb.logo.archivo}`) : null, fuente: null, licencia: false };
  if (pb?.fuentes.subtitulos.archivo) fuenteDePerfil(previo.perfil, pb.fuentes.subtitulos);
  let paleta = [], paso = 0, activar = !editar, creando = false;
  const marca = () => marcaDesdeAsistente(r, pb ?? base);

  const PASOS = [
    { titulo: "Tu marca", ok: () => (!r.nombre.trim() ? "Escribe tu nombre o el de tu marca." : !r.plataformas.length ? "Elige al menos una plataforma." : null), cuerpo: pasoNombre },
    { titulo: "Logo", cuerpo: pasoLogo },
    { titulo: "Fuente", ok: () => (archivos.fuente && !archivos.licencia ? "Confirma que tienes licencia para usar tu fuente." : null), cuerpo: pasoFuente },
    { titulo: "Colores", cuerpo: pasoColores },
    { titulo: "Subtítulos", cuerpo: pasoSubtitulos },
    { titulo: "Nunca", cuerpo: pasoNunca },
    { titulo: "Listo", cuerpo: pasoListo },
  ];
  const lista = h("ol.asis-pasos"), panel = h("div.asis-panel"), previa = h("div.asis-previa"), pie = h("div.asis-pie");
  // Enter avanza al siguiente paso (o crea la marca en el último), como en cualquier formulario.
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.target.closest("button, select, textarea")) return;
    e.preventDefault();
    [...pie.querySelectorAll("button.prim")].find((b) => !b.disabled)?.click();
  });
  principal.replaceChildren(h("div.pagina",
    h("div.cabecera", h("h1", editar ? `Rehacer «${previo.perfil.nombre}»` : "Crear marca"), h("span.sub", "Unos 5 minutos. Todo se puede cambiar después."), h("div.espacio"), h("a.btn.chico", { href: editar ? `#/marca/${editar}` : "#/marca" }, "Cancelar")),
    h("div.asis", lista, panel, previa)));

  function pintar() {
    lista.replaceChildren(...PASOS.map((p, i) => h("li", { class: i === paso ? "on" : i < paso ? "hecho" : "" },
      h("button", { disabled: i > paso && !!primerError(i), on: { click: () => { if (i <= paso || !primerError(i)) { paso = i; pintar(); } } } }, p.titulo))));
    panel.replaceChildren(h("h2", `${paso + 1}. ${PASOS[paso].titulo}`), PASOS[paso].cuerpo(), pie);
    pintarPie(); pintarPrevia();
  }
  const primerError = (hasta) => { for (let i = 0; i < hasta; i++) { const e = PASOS[i].ok?.(); if (e) return e; } return null; };
  function pintarPie() {
    const err = PASOS[paso].ok?.();
    pie.replaceChildren(...[err ? h("div.aviso-txt", err) : h("div"), h("div.espacio"),
      paso > 0 && paso < 6 ? h("button.btn", { on: { click: () => { paso--; pintar(); } } }, "Atrás") : null,
      paso < 5 ? h("button.btn.prim", { disabled: !!err, on: { click: () => { paso++; pintar(); } } }, "Siguiente") : null,
      paso === 5 ? h("button.btn.prim", { disabled: creando || !!primerError(6), on: { click: crear } }, creando ? "Creando…" : editar ? "Guardar marca" : "Crear mi marca") : null].filter(Boolean));
  }
  function pintarPrevia() {
    const b = marca(), e = validarMarca(b).filter((x) => !/creador.(nombre|plataformas)/.test(x)); // esas dos ya las avisa el pie del paso 1
    previa.replaceChildren(...[h("div.tenue", "Vista previa 9:16"), vistaPrevia(b, { ancho: 260 }),
      h("div.tenue", { style: { fontSize: "12px" } }, `${b.fuentes.subtitulos.familia} ${b.fuentes.subtitulos.peso} · ${ESTILOS_SUBTITULO.find((x) => x.id === r.estilo)?.nombre}`),
      e.length ? h("div.error-txt", e.join("; ")) : null].filter(Boolean));
  }
  const alCambiar = () => { pintarPie(); pintarPrevia(); };

  function pasoNombre() {
    const nombre = h("input", { type: "text", value: r.nombre, placeholder: "Ej.: Lucía Cocina", maxlength: 60, on: { input: (e) => { r.nombre = e.target.value; alCambiar(); } } });
    const usuario = h("input", { type: "text", value: r.usuario, placeholder: "@usuario (opcional)", maxlength: 40, on: { input: (e) => { r.usuario = e.target.value; } } });
    setTimeout(() => nombre.focus(), 0);
    return h("div.asis-campos",
      h("label", h("span", "Nombre del creador o de la marca"), nombre), h("label", h("span", "Usuario"), usuario),
      h("div", h("span.tenue", "¿Dónde publicas?"), h("div.fila", PLATAFORMAS.map((p) => h("label.chip", { class: r.plataformas.includes(p) ? "on" : "" },
        h("input", { type: "checkbox", checked: r.plataformas.includes(p), on: { change: (e) => { r.plataformas = e.target.checked ? [...r.plataformas, p] : r.plataformas.filter((x) => x !== p); e.target.parentElement.classList.toggle("on", e.target.checked); alCambiar(); } } }), NOMBRE_PLAT[p])))),
      h("div.tenue", "La zona segura (lo que no tapa la interfaz de la app) ya es la más estricta de las tres: sirve para todas."));
  }
  function pasoLogo() {
    const input = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/svg+xml", hidden: true, on: { change: () => usarLogo(input.files[0]) } });
    const zona = h("div.soltar", { on: { click: () => input.click(), dragover: (e) => { e.preventDefault(); zona.classList.add("encima"); }, dragleave: () => zona.classList.remove("encima"),
      drop: (e) => { e.preventDefault(); zona.classList.remove("encima"); usarLogo(e.dataTransfer.files[0]); } } },
      archivos.logoURL ? h("img", { src: archivos.logoURL, alt: "Tu logo", style: { maxHeight: "120px", maxWidth: "100%" } }) : "Arrastra tu logo aquí o haz clic (PNG, JPG, WEBP o SVG)");
    async function usarLogo(f) {
      if (!f) return;
      if (!/\.(png|jpe?g|webp|svg)$/i.test(f.name)) return toast("El logo debe ser PNG, JPG, WEBP o SVG", true);
      archivos.logo = f; archivos.logoURL = URL.createObjectURL(f); r.logo = null;
      try { paleta = await coloresDeImagen(archivos.logoURL); Object.assign(r.colores, sugerirColores(paleta)); toast("Colores sugeridos desde tu logo (paso 4)"); } catch { paleta = []; }
      pintar();
    }
    return h("div.asis-campos", h("div.tenue", "Opcional. Se guarda en tu perfil y sirve para sugerirte colores; no se pone en tus reels salvo que lo pidas."), zona, input,
      archivos.logoURL ? h("button.btn.chico", { on: { click: () => { archivos.logo = null; archivos.logoURL = null; r.logo = null; paleta = []; pintar(); } } }, "Quitar logo") : null);
  }
  function pasoFuente() {
    const tarjetas = FUENTES_OFL.map((f) => h("button.fuente", { class: !archivos.fuente && r.fuente.familia === f.familia && !r.fuente.archivo ? "on" : "",
      on: { click: () => { r.fuente = { familia: f.familia }; archivos.fuente = null; pintar(); } } },
      h("div", { style: { fontFamily: `"${f.familia}"`, fontWeight: f.subtitulos, fontSize: "22px" } }, "Así se ve"), h("div.tenue", `${f.familia} · ${f.tipo}`)));
    const input = h("input", { type: "file", accept: ".woff2,.woff,.ttf,.otf", hidden: true, on: { change: intentar(async () => {
      const f = input.files[0]; if (!f) return;
      if (!/\.(woff2?|ttf|otf)$/i.test(f.name)) throw new Error("La fuente debe ser .woff2, .woff, .ttf u .otf");
      const familia = f.name.replace(/\.[^.]+$/, "").replace(/[^\w -]/g, "").trim().slice(0, 40) || "Mi fuente";
      await cargarFuentePropia(familia, f);
      archivos.fuente = f; r.fuente = { familia, peso: 700, archivo: `fuentes/${f.name.replace(/[^\p{L}\p{N}_. -]/gu, "_")}` }; pintar();
    }) } });
    const propia = (archivos.fuente || r.fuente.archivo) ? h("div.caja", h("div", { style: { fontFamily: `"${r.fuente.familia}"`, fontSize: "26px" } }, `${r.fuente.familia}: Así se ve`),
      h("label.fila", h("span.tenue", "Grosor"), h("select", { on: { change: (e) => { r.fuente.peso = Number(e.target.value); alCambiar(); } } }, [400, 500, 600, 700, 800, 900].map((p) => h("option", { value: p, selected: r.fuente.peso === p }, p)))),
      archivos.fuente ? h("label.fila", h("input", { type: "checkbox", checked: archivos.licencia, on: { change: (e) => { archivos.licencia = e.target.checked; alCambiar(); } } }), "Tengo licencia para usar esta fuente en videos (queda registrado en LICENCIAS.md)") : null) : null;
    const ofl = FUENTES_OFL.find((f) => f.familia === r.fuente.familia && !r.fuente.archivo);
    return h("div.asis-campos", h("div.tenue", "Fuentes gratuitas con licencia libre (OFL), listas para tus reels. O sube la tuya."),
      h("div.fuentes", tarjetas),
      ofl && ofl.pesos.length > 1 ? h("label.fila", h("span.tenue", "Grosor de subtítulos"), h("select", { on: { change: (e) => { r.fuente.peso = Number(e.target.value); alCambiar(); } } },
        ofl.pesos.map((p) => h("option", { value: p, selected: (r.fuente.peso ?? ofl.subtitulos) === p }, `${p}${p === ofl.subtitulos ? " (recomendado)" : ""}`)))) : null,
      h("div.fila", input, h("button.btn.chico", { on: { click: () => input.click() } }, "⬆ Subir mi fuente")), propia);
  }
  function pasoColores() {
    const campo = (k, etiqueta, ayuda, opcional) => {
      const inp = h("input", { type: "color", value: r.colores[k] ?? "#FFD43B", on: { input: (e) => { r.colores[k] = e.target.value.toUpperCase(); txt.value = r.colores[k]; alCambiar(); } } });
      const txt = h("input", { type: "text", value: r.colores[k] ?? "", placeholder: opcional ? "sin acento" : "#RRGGBB", maxlength: 7, style: { width: "90px" },
        on: { input: (e) => { const v = e.target.value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) { r.colores[k] = v.toUpperCase(); inp.value = v; } else if (opcional && !v) r.colores[k] = null; alCambiar(); } } });
      return h("div.color-campo", h("b", etiqueta), h("div.fila", inp, txt, opcional && r.colores[k] ? h("button.btn.chico", { on: { click: () => { r.colores[k] = null; pintar(); } } }, "Sin acento") : null), h("div.tenue", ayuda),
        paleta.length ? h("div.fila.muestras", paleta.slice(0, 8).map((c) => h("button.muestra", { title: c.hex, style: { background: c.hex }, on: { click: () => { r.colores[k] = c.hex; pintar(); } } }))) : null);
    };
    return h("div.asis-campos",
      paleta.length ? h("div.ok-txt", "Sugeridos desde tu logo. Toca una muestra para usarla.") : h("div.tenue", "Sube un logo en el paso 2 para que te sugiera colores."),
      campo("principal", "Texto", "Color de los subtítulos. El blanco se lee sobre casi todo.", false),
      campo("contorno", "Contorno", "Borde fino alrededor de cada letra para que se lea sobre fondos claros.", false),
      campo("acento", "Acento", "Para resaltar palabras clave (estilo «Palabra resaltada»). Opcional.", true));
  }
  function pasoSubtitulos() {
    const actual = marca().subtitulos.tamano_base_px;
    return h("div.asis-campos", h("div.tenue", "Elige cómo se ven tus subtítulos. La zona roja es la que tapa la app."),
      h("div.fila", h("span.tenue", "Tamaño"), TAMANOS.map(([n, px]) => h("button.chip", { class: actual === Math.min(px, r.estilo === "mayusculas" ? 60 : px) ? "on" : "", on: { click: () => { r.tamano = px; pintar(); } } }, n))),
      h("div.estilos", ESTILOS_SUBTITULO.map((e) => {
        const b = marcaDesdeAsistente({ ...r, estilo: e.id }, pb ?? base);
        return h("button.estilo", { class: r.estilo === e.id ? "on" : "", on: { click: () => { r.estilo = e.id; pintar(); } } },
          vistaPrevia(b, { ancho: 132, tarjeta: false }), h("b", e.nombre), h("div.tenue", e.descripcion));
      })),
      r.estilo === "resaltado" && !r.colores.acento ? h("div.aviso-txt", "Este estilo usa el color de acento: elige uno en el paso 4 (si no, se usa amarillo).") : null);
  }
  function pasoNunca() {
    return h("div.asis-campos", h("div.tenue", "Lo que nunca quieres ver en tus reels. Los agentes no lo harán aunque la referencia lo haga."),
      h("div.nunca", OPCIONES_NUNCA.filter((o) => !(o.id === "mayusculas" && r.estilo === "mayusculas")).map((o) => h("label.fila",
        h("input", { type: "checkbox", checked: r.nunca.includes(o.id), on: { change: (e) => { r.nunca = e.target.checked ? [...r.nunca, o.id] : r.nunca.filter((x) => x !== o.id); alCambiar(); } } }), o.texto))),
      !editar ? h("label.fila", { style: { marginTop: "12px" } }, h("input", { type: "checkbox", checked: activar, on: { change: (e) => (activar = e.target.checked) } }), "Usar esta marca para mis reels nuevos") : null);
  }
  let creado = null;
  function pasoListo() {
    if (!creado) return h("div.tenue", "Termina los pasos anteriores.");
    const b = creado.brand;
    return h("div.asis-campos",
      h("div.ok-txt", h("b", `✔ Marca «${creado.perfil.nombre}» lista`), ` en ${tiempoMS(creado.segundos)}.`),
      h("ul", h("li", `Fuente: ${b.fuentes.subtitulos.familia} ${b.fuentes.subtitulos.peso}`), h("li", `Colores: texto ${b.colores.principal}, contorno ${b.colores.contorno}${b.colores.acento ? `, acento ${b.colores.acento}` : ""}`),
        h("li", `Subtítulos: ${ESTILOS_SUBTITULO.find((x) => x.id === b.subtitulos.estilo)?.nombre}`), h("li", `Nunca: ${b.nunca.join(", ")}`), h("li", `Carpeta: ${creado.perfil.ruta}/`)),
      h("div.tenue", "¿Tienes reels ya publicados? Súbelos y un agente afinará la marca (tamaño exacto, altura, ritmo). Opcional."),
      h("div.fila", h("a.btn.prim", { href: `#/marca/${creado.perfil.id}` }, "✨ Afinar con mis reels"), h("a.btn", { href: "#/proyectos" }, "🎬 Crear un reel")));
  }
  async function crear() {
    const b = marca(), e = validarMarca(b);
    if (e.length) return toast(`Revisa la marca: ${e.join("; ")}`, true);
    creando = true; pintarPie();
    try {
      const p = editar ? previo.perfil : await api("/api/perfiles", { json: { nombre: r.nombre.trim() } });
      const subirA = async (destino, f) => {
        const res = await fetch(`/api/perfiles/${p.id}/subir?destino=${destino}&nombre=${encodeURIComponent(f.name)}`, { method: "POST", body: f });
        const d = await res.json(); if (!res.ok) throw new Error(d.error); return d.archivo;
      };
      if (archivos.logo) r.logo = await subirA("logo", archivos.logo);
      if (archivos.fuente) r.fuente = { ...r.fuente, archivo: await subirA("fuentes", archivos.fuente) };
      const segundos = (Date.now() - inicio) / 1000;
      const g = await api(`/api/perfiles/${p.id}/marca`, { json: { respuestas: r, duracion_s: editar ? undefined : segundos } });
      if (activar) await api("/api/perfiles/activo", { json: { id: p.id } });
      await alCambiarActivo?.();
      creado = { perfil: g.perfil, brand: g.brand, segundos };
      paso = 6; toast("Marca guardada");
    } catch (err) { toast(err.message, true); }
    creando = false; pintar();
  }
  pintar();
}
