// Editor visual de una versión: visor 9:16 con superposición en vivo, línea de tiempo, inspector,
// transcripción y biblioteca. Todo edita edicion.json; guardar crea siempre vN+1.
import { $, $$, accion, api, archivo, confirmar, esc, h, intentar, md, pedirAgente, preguntar, tiempo, toast } from "./comun.js";
import { activosEn, cajaSubtitulo, normalizarEdicion, revisarEdicion } from "/herramientas/reglas.mjs";
import { CATEGORIAS, RECETAS, parametros, rasgosDe, vistaEfecto } from "/herramientas/efectos.mjs";

let marcaCache;
const PISTAS = [
  { k: "subtitulos", c: "sub", n: "Subtítulos", color: "var(--sub)" },
  { k: "fondos", c: "fon", n: "B-roll", color: "var(--fon)" },
  { k: "tarjetas", c: "tar", n: "Tarjetas", color: "var(--tar)" },
  { k: "motion", c: "mot", n: "Motion", color: "var(--mot)" },
  { k: "efectos", c: "efx", n: "Efectos", color: "var(--efx)" },
  { k: "zooms", c: "zoo", n: "Zooms", color: "var(--zoo)" },
  { k: "encuadre", c: "enc", n: "Encuadre", color: "var(--enc)" },
];
const ENCUADRES = {
  "Completo": { escala: 1, origen: "50% 50%", x: 0, y: 0 },
  "Esquina inf. der. 50 %": { escala: 0.5, origen: "1080px 1920px", x: 0, y: 0 },
  "Esquina inf. izq. 50 %": { escala: 0.5, origen: "0px 1920px", x: 0, y: 0 },
  "Busto 70 % abajo": { escala: 0.7, origen: "540px 0px", x: 0, y: 300 },
};
const IMG = /\.(jpe?g|png|webp|gif)$/i;
const r3 = (n) => Math.round(n * 1000) / 1000;

export async function abrirEditor(cont, slug, version) {
  // La marca del perfil de este reel (no la del perfil activo).
  if (marcaCache?.slug !== slug) marcaCache = { slug, brand: (await api(`/api/marca?slug=${encodeURIComponent(slug)}`)).brand };
  const B = marcaCache.brand;
  const [d, proy, bib, learner] = await Promise.all([api(`/api/proyecto/${slug}/edicion/${version}`), api(`/api/proyecto/${slug}`), api("/api/biblioteca"), api("/api/tecnicas").catch(() => ({ tecnicas: [] }))]);
  const tecnicas = learner.tecnicas ?? [];
  const prohibidos = B.animaciones?.rasgos_prohibidos ?? [];
  const chocaMarca = (e) => rasgosDe(e).some((r) => prohibidos.includes(r));
  const vs = proy.versiones.map((v) => v.v);
  if (!d.existe) {
    const v = proy.versiones.find((x) => x.v === version);
    cont.replaceChildren(h("div.pagina", h("div.cabecera", h("a.btn.chico", { href: `#/proyecto/${slug}` }, "← Proyecto"), h("h1", `${version}`)),
      h("div.vacio", `${version} se hizo con un script antiguo (sin edicion.json).`, h("br"), h("br"),
        h("button.btn.prim", { on: { click: intentar(() => accion({ accion: "migrar", slug, version }, { abrir: true })) } }, `Pasar a edicion.json (crea v${vs.length + 1})`), " ",
        h("button.btn", { on: { click: () => pedirAgente({ tarea: "proponer", slug, version, versiones: vs }) } }, "🤖 Proponer edición nueva"),
        v?.final && h("video.player", { src: archivo(v.final), controls: true, style: { marginTop: "16px", maxWidth: "360px" } }))));
    return () => {};
  }
  const clave = `borrador:${slug}:${version}`;
  let E = normalizarEdicion(d.edicion, B);
  let borrador = null;
  try { borrador = localStorage.getItem(clave); } catch {}
  if (!borrador) {
    const remoto = await api(`/api/proyecto/${slug}/borrador/${version}`).catch(() => ({}));
    if (remoto.edicion) borrador = JSON.stringify(remoto.edicion);
  }
  let borradorTimer;
  const persistirBorrador = () => { clearTimeout(borradorTimer); borradorTimer = setTimeout(() => api(`/api/proyecto/${slug}/borrador/${version}`, { json: { edicion: E } }).catch(() => {}), 600); };
  const palabras = d.transcripcion ?? [];
  const items = Object.values(bib.items);
  const itemPorRuta = new Map(items.map((i) => [i.ruta, i]));
  const itemDe = (archivoRel) => itemPorRuta.get(archivoRel) ?? items.find((i) => i.nombre === archivoRel?.split("/").pop());
  let historial = [], futuro = [], sucio = false, sel = null, problemas = [], zonaVisible = true, pxs = 40, vivo = true;
  let marcadas = null; // [i, j] rango de palabras

  // ---------- estructura ----------
  const master = h("video", { src: archivo(d.clip), preload: "auto", playsInline: true });
  const recorte = d.recorte ? h("video", { src: archivo(d.recorte), muted: true, preload: "auto", playsInline: true }) : null;
  const fondoCapa = h("div.capa");
  const fxCapa = h("div.capa", E.recorte && recorte ? recorte : master);
  const zoomCapa = h("div.capa", fxCapa);
  const efxEscena = h("div.escena");
  const efxCapa = h("div.capa", { style: { overflow: "hidden", pointerEvents: "none" } }, efxEscena);
  const persona = h("div.capa", zoomCapa);
  const motionCapa = h("div.capa");
  const escena = h("div.escena");
  const lienzo = h("div.lienzo", E.recorte ? h("div.capa", { style: { background: "#0b0b0d" } }) : null);
  const ordenCapas = () => {
    const usaRec = E.recorte && recorte;
    fxCapa.replaceChildren(usaRec ? recorte : master);
    if (usaRec) { master.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none"; lienzo.append(master); }
    else master.style.cssText = "";
    lienzo.replaceChildren(...(usaRec ? [h("div.capa", { style: { background: "#0b0b0d" } }), fondoCapa, persona] : [persona, fondoCapa]), motionCapa, efxCapa, h("div.capa", { style: { overflow: "hidden" } }, escena), ...(usaRec ? [master] : []));
  };
  ordenCapas();
  const reloj = h("span.reloj", "0:00.00");
  const btnPlay = h("button.btn", { on: { click: () => alternar() } }, "▶");
  const visor = h("div.ed-visor", lienzo, h("div.controles",
    h("button.btn.chico", { title: "Inicio", on: { click: () => ir(0) } }, "⏮"),
    h("button.btn.chico", { title: "−1 s (Shift+←)", on: { click: () => ir(t() - 1) } }, "−1s"), btnPlay,
    h("button.btn.chico", { title: "+1 s (Shift+→)", on: { click: () => ir(t() + 1) } }, "+1s"), reloj,
    h("button.chip.on", { title: "Mostrar u ocultar la zona segura", on: { click: (e) => { zonaVisible = !zonaVisible; e.currentTarget.classList.toggle("on"); pintarEscena(true); } } }, "Zona segura")));

  const estado = h("span.tenue");
  const btnDeshacer = h("button.btn.chico", { title: "Ctrl+Z", on: { click: () => deshacer() } }, "↶");
  const btnRehacer = h("button.btn.chico", { title: "Ctrl+Y", on: { click: () => rehacer() } }, "↷");
  const selVer = h("select", vs.map((v) => h("option", { value: v, selected: v === version }, v)));
  selVer.onchange = () => (location.hash = `#/editor/${slug}/${selVer.value}`);
  const exigirGuardado = () => { if (sucio) throw new Error("Guarda los cambios como una nueva versión antes de revisar, aprobar o pedir correcciones."); };
  const pedirCorreccion = intentar(() => {
    exigirGuardado(); master.pause();
    const elemento = sel ? E[sel.k]?.[sel.i] : null;
    return pedirAgente({ tarea: "corregir", slug, version, versiones: vs, contexto: { version, segundo: r3(t()), pista: sel?.k ?? null, indice: sel?.i ?? null, elemento: elemento ?? null } });
  });
  const herramientasRevision = h("details.ed-revision", h("summary.btn", "Revisar y exportar"), h("div.ed-menu",
    h("b", `Entrega de ${version}`),
    h("p.tenue", "1. Revisa retención y valida. 2. Mira la vista previa. 3. Aprueba y exporta."),
    h("button.btn", { on: { click: intentar(() => { exigirGuardado(); return pedirAgente({ tarea: "retencion", slug, version, versiones: vs }); }) } }, "1 · Revisar retención"),
    h("button.btn", { on: { click: intentar(() => { exigirGuardado(); return accion({ accion: "validar", slug, version }, { abrir: true }); }) } }, "1 · Validar composición"),
    h("button.btn", { on: { click: intentar(() => { exigirGuardado(); return accion({ accion: "preview", slug, version }, { abrir: true }); }) } }, "2 · Vista previa final"),
    h("button.btn", { on: { click: intentar(async () => { exigirGuardado(); await api(`/api/proyecto/${slug}/aprobar`, { json: { que: "preview", version } }); toast(`${version} aprobada. Ya puedes exportar.`); }) } }, "3 · Aprobar esta versión"),
    h("button.btn.prim", { on: { click: intentar(() => { exigirGuardado(); return accion({ accion: "render", slug, version }, { abrir: true }); }) } }, "Exportar video")));
  const barra = h("div.ed-barra",
    h("a.btn.chico", { href: `#/proyecto/${slug}` }, "←"), h("h2", slug.slice(11).replace(/-/g, " ")), selVer, estado, h("div.espacio"),
    btnDeshacer, btnRehacer,
    h("button.btn", { title: "Envía el segundo actual y el bloque seleccionado al asistente", on: { click: pedirCorreccion } }, "Corregir este momento"),
    herramientasRevision,
    h("button.btn.prim", { title: "Ctrl+S", on: { click: () => guardar() } }, "Guardar versión"));

  const tabsLado = [["props", "Propiedades"], ["trans", "Transcripción"], ["bib", "Biblioteca"], ["tec", "Técnicas"], ["avisos", "Avisos"], ["ver", "Versión"]];
  let tabActiva = sessionStorage.getItem("insertar") ? "bib" : sessionStorage.getItem("insertarTecnica") ? "tec" : "props";
  const panel = h("div.ed-panel");
  const tabsEl = h("div.tabs");
  const pintarTabs = () => tabsEl.replaceChildren(...tabsLado.map(([k, n]) => h("button.tab", { class: k === tabActiva ? "activo" : "", on: { click: () => { tabActiva = k; pintarTabs(); pintarPanel(); } } },
    k === "avisos" && problemas.length ? `${n} (${problemas.filter((p) => p.nivel === "error").length || problemas.length})` : n)));
  const lado = h("div.ed-lado", tabsEl, panel);

  const tlLienzo = h("div.tl-lienzo");
  const tlScroll = h("div.tl-scroll", tlLienzo);
  const zoomTL = h("input", { type: "range", min: 8, max: 300, value: 40, style: { width: "140px" } });
  zoomTL.oninput = () => { const c = t(); pxs = Number(zoomTL.value); pintarTL(); tlScroll.scrollLeft = c * pxs - tlScroll.clientWidth / 2; };
  const tiempoEl = h("div.ed-tiempo",
    h("div.tl-barra", h("span", "Línea de tiempo"), h("span", "· arrastra bloques y bordes · doble clic = editar · "), h("kbd", "Espacio"), " reproducir ", h("kbd", "S"), " dividir ", h("kbd", "Supr"), " borrar ",
      h("div.espacio"), h("span", "Zoom"), zoomTL,
      h("button.btn.chico", { on: { click: () => anadir("subtitulos") } }, "+ Subtítulo"), h("button.btn.chico", { on: { click: () => anadir("tarjetas") } }, "+ Tarjeta"),
      h("button.btn.chico", { on: { click: () => anadir("zooms") } }, "+ Zoom"), h("button.btn.chico", { on: { click: () => anadir("encuadre") } }, "+ Encuadre")),
    h("div.tl-cuerpo", h("div.tl-nombres", h("div.tl-nombre", "Audio"), PISTAS.map((p) => h("div.tl-nombre", h("i", { style: { background: p.color } }), p.n))), tlScroll));

  const raiz = h("div.editor", barra, h("div.ed-medio", visor, lado), tiempoEl);
  cont.replaceChildren(raiz);

  // ---------- tiempo y reproducción ----------
  const t = () => master.currentTime || 0;
  function ir(s) { master.currentTime = Math.max(0, Math.min(E.duracion - 0.01, s)); if (recorte) recorte.currentTime = master.currentTime; pintarEscena(); }
  function alternar() { if (master.paused) { master.play(); recorte?.play(); } else { master.pause(); recorte?.pause(); } }
  master.onplay = () => (btnPlay.textContent = "❚❚");
  master.onpause = () => { btnPlay.textContent = "▶"; recorte?.pause(); fondoVideo?.pause(); };

  // ---------- visor ----------
  let fondoActual = -2, fondoVideo = null, subActual = -2, firmaEscena = "";
  const escala = () => lienzo.clientWidth / 1080;
  const ro = new ResizeObserver(() => { escena.style.transform = efxEscena.style.transform = `scale(${escala()})`; motionCapa.style.setProperty("--k", escala()); firmaEscena = ""; pintarEscena(); });
  ro.observe(lienzo);

  function htmlTexto(s) {
    let x = esc(s.texto);
    for (const w of E.sin_partir) x = x.replaceAll(esc(w), `<span class="nw">${esc(w)}</span>`);
    return x;
  }
  function pintarEscena(forzar = false) {
    const ahora = t();
    const a = activosEn(E, ahora);
    reloj.textContent = `${tiempo(ahora)} / ${tiempo(E.duracion)}`;
    // fondo
    if (a.fondo !== fondoActual || forzar) {
      fondoActual = a.fondo;
      fondoVideo = null;
      const f = E.fondos[a.fondo];
      if (!f) fondoCapa.replaceChildren();
      else if (IMG.test(f.archivo)) fondoCapa.replaceChildren(h("img.fondo-img", { src: archivo(rutaArchivo(f.archivo)), style: { objectFit: f.ajuste === "contain" ? "contain" : "cover", transformOrigin: "50% 40%" } }));
      else { fondoVideo = h("video", { src: archivo(rutaArchivo(f.archivo)), muted: true, playsInline: true, preload: "auto", style: { objectFit: f.ajuste === "contain" ? "contain" : "cover" } }); fondoCapa.replaceChildren(fondoVideo); }
    }
    const f = E.fondos[a.fondo];
    if (f) {
      if (fondoVideo) {
        const objetivo = (f.desde ?? 0) + (ahora - f.inicio) * (f.velocidad ?? 1);
        fondoVideo.playbackRate = f.velocidad ?? 1;
        if (master.paused) { fondoVideo.pause(); if (Math.abs(fondoVideo.currentTime - objetivo) > 0.04) fondoVideo.currentTime = objetivo; }
        else { if (fondoVideo.paused) fondoVideo.play().catch(() => {}); if (Math.abs(fondoVideo.currentTime - objetivo) > 0.3) fondoVideo.currentTime = objetivo; }
      } else {
        const img = fondoCapa.firstChild;
        if (img && f.kenburns !== false) img.style.transform = `scale(${1 + 0.07 * Math.min(1, (ahora - f.inicio) / Math.max(0.01, f.fin - f.inicio))})`;
      }
    }
    if (recorte && E.recorte && !master.paused && Math.abs(recorte.currentTime - ahora) > 0.15) recorte.currentTime = ahora;
    // encuadre y zoom
    const en = a.encuadre ?? { escala: 1, origen: "50% 50%", x: 0, y: 0 };
    const k = escala();
    const origen = String(en.origen ?? "50% 50%").replace(/(-?[\d.]+)px/g, (_, n) => `${n * k}px`);
    persona.style.transformOrigin = origen;
    persona.style.transform = `translate(${(en.x ?? 0) * k}px, ${(en.y ?? 0) * k}px) scale(${en.escala ?? 1})`;
    const z = a.zoom;
    if (z) {
      const p = Math.min(1, Math.max(0, (ahora - z.inicio) / Math.max(0.01, z.fin - z.inicio)));
      zoomCapa.style.transformOrigin = String(z.origen ?? "50% 40%").replace(/(-?[\d.]+)px/g, (_, n) => `${n * k}px`);
      zoomCapa.style.transform = `scale(${1 + ((z.escala ?? 1.04) - 1) * (1 - (1 - p) ** 2)})`;
    } else zoomCapa.style.transform = "";
    // efectos (vista previa aproximada; el render exacto lo hace generar.mjs con la misma receta)
    let cuadroT = "", cuadroO = "50% 50%", fondoT = "";
    const nodosEfx = [];
    for (const i of a.efectos) {
      const e = E.efectos[i], v = vistaEfecto(e, ahora);
      if (v.capa) nodosEfx.push(h("div.v-efx-capa", { style: v.capa }));
      if (v.texto) nodosEfx.push(h("div.v-efx-texto", { style: { top: `${v.texto.y - v.texto.tamano}px`, height: `${v.texto.tamano * 2}px`, opacity: v.texto.opacity } },
        h("span", { style: { fontSize: `${v.texto.tamano}px`, transform: v.texto.transform, fontFamily: `"${(B.fuentes.titulos ?? B.fuentes.subtitulos).familia}"`, fontWeight: (B.fuentes.titulos ?? B.fuentes.subtitulos).peso, color: B.colores.principal } }, v.texto.texto)));
      if (v.cuadro) {
        const tr = String(v.cuadro.transform ?? "").replace(/(-?[\d.]+)px/g, (_, n) => `${n * k}px`);
        cuadroT += " " + tr; if (v.cuadro.transformOrigin) cuadroO = v.cuadro.transformOrigin;
        if (e.receta === "sacudida") fondoT += " " + tr;
      }
    }
    efxEscena.replaceChildren(...nodosEfx);
    fxCapa.style.transformOrigin = cuadroO; fxCapa.style.transform = cuadroT;
    fondoCapa.style.transform = fondoT;
    // escena (texto): solo se rehace si cambia lo visible
    const firma = JSON.stringify([a.subtitulo, a.tarjetas, a.motion, zonaVisible, sel, firmaEdicion]);
    if (firma !== firmaEscena || forzar) {
      firmaEscena = firma;
      const nodos = [];
      if (zonaVisible) {
        const zs = B.zona_segura;
        nodos.push(h("div.zona", { style: { left: 0, top: 0, width: "1080px", height: `${zs.arriba}px` } }), h("div.zona", { style: { left: 0, bottom: 0, width: "1080px", height: `${zs.abajo}px` } }),
          h("div.zona", { style: { right: 0, top: `${zs.arriba}px`, width: `${zs.derecha}px`, height: `${1920 - zs.arriba - zs.abajo}px` } }), h("div.zona", { style: { left: 0, top: `${zs.arriba}px`, width: `${zs.izquierda}px`, height: `${1920 - zs.arriba - zs.abajo}px` } }));
      }
      for (const i of a.tarjetas) {
        const tj = E.tarjetas[i];
        nodos.push(h("div.v-tar", { class: (tj.estilo === "oscura" ? "oscura " : "") + (sel?.k === "tarjetas" && sel.i === i ? "v-sel" : ""), style: { top: `${tj.y}px`, left: `${B.zona_segura.izquierda}px`, width: `${1080 - B.zona_segura.izquierda - B.zona_segura.derecha}px` } },
          h("div.card", tj.titulo && h("div.titulo", tj.titulo), tj.texto && h("div.texto", tj.texto))));
      }
      if (a.subtitulo != null) {
        const s = E.subtitulos[a.subtitulo];
        const y = s.y ?? E.posiciones_subtitulo[s.pos] ?? E.posiciones_subtitulo.normal;
        nodos.push(h("div.v-sub", { style: { top: `${y - 110}px` } }, h("span", { class: sel?.k === "subtitulos" && sel.i === a.subtitulo ? "v-sel" : "", html: htmlTexto(s),
          style: { maxWidth: `${B.subtitulos.ancho_max_px}px`, fontSize: `${s.tamano ?? B.subtitulos.tamano_base_px}px`, fontFamily: `"${B.fuentes.subtitulos.familia}"`, fontWeight: B.fuentes.subtitulos.peso, color: B.colores.principal } })));
      }
      escena.replaceChildren(...nodos);
      motionCapa.replaceChildren(...a.motion.map((i) => {
        const m = E.motion[i], src = archivo(rutaArchivo(m.archivo));
        const st = { left: `${(m.x ?? 0) * k}px`, top: `${(m.y ?? 0) * k}px`, width: `${(m.ancho ?? 1080) * k}px` };
        return IMG.test(m.archivo) ? h("img.v-motion", { src, style: st }) : h("video.v-motion", { src, muted: true, autoplay: true, loop: true, playsInline: true, style: st });
      }));
    }
    // cabezal y transcripción
    cabezal.style.left = `${ahora * pxs}px`;
    if (!master.paused && (ahora * pxs < tlScroll.scrollLeft || ahora * pxs > tlScroll.scrollLeft + tlScroll.clientWidth - 40)) tlScroll.scrollLeft = ahora * pxs - 60;
    if (tabActiva === "trans") {
      const w = palabras.findIndex((p) => p.start <= ahora && ahora < p.end);
      if (w !== subActual) { $$(".palabra.actual", panel).forEach((e) => e.classList.remove("actual")); if (w >= 0) $(`.palabra[data-i="${w}"]`, panel)?.classList.add("actual"); subActual = w; }
    }
  }
  const rutaArchivo = (a) => (a.includes("/") ? a : (itemDe(a)?.ruta ?? a));
  let firmaEdicion = 0;
  const bucle = () => { if (!vivo) return; pintarEscena(); requestAnimationFrame(bucle); };

  // ---------- edición ----------
  function commit(fn, { silencioso = false } = {}) {
    historial.push(JSON.stringify(E)); if (historial.length > 200) historial.shift(); futuro = [];
    fn();
    E = normalizarEdicionConservandoSel(E);
    sucio = true; firmaEdicion++;
    try { localStorage.setItem(clave, JSON.stringify(E)); } catch {} persistirBorrador();
    revisar(); pintarTL(); if (!silencioso) pintarPanel(); pintarEscena(true);
  }
  function normalizarEdicionConservandoSel(X) {
    const obj = sel && X[sel.k]?.[sel.i];
    const N = normalizarEdicion(X, B);
    if (obj) { const j = N[sel.k].findIndex((o) => o.inicio === r3(Number(obj.inicio)) && (o.texto ?? o.id ?? o.archivo) === (obj.texto ?? obj.id ?? obj.archivo)); sel = j >= 0 ? { k: sel.k, i: j } : null; }
    return N;
  }
  function deshacer() { if (!historial.length) return; futuro.push(JSON.stringify(E)); E = JSON.parse(historial.pop()); sel = null; trasCambio(); }
  function rehacer() { if (!futuro.length) return; historial.push(JSON.stringify(E)); E = JSON.parse(futuro.pop()); sel = null; trasCambio(); }
  function trasCambio() { sucio = true; firmaEdicion++; try { localStorage.setItem(clave, JSON.stringify(E)); } catch {} persistirBorrador(); revisar(); pintarTL(); pintarPanel(); pintarEscena(true); }
  function revisar() {
    problemas = revisarEdicion(E, B);
    estado.innerHTML = (sucio ? '<span class="aviso-txt">● sin guardar</span> · ' : "") +
      (problemas.some((p) => p.nivel === "error") ? `<span class="error-txt">${problemas.filter((p) => p.nivel === "error").length} errores</span>` : '<span class="ok-txt">reglas ok</span>') +
      (problemas.some((p) => p.nivel === "aviso") ? ` · <span class="aviso-txt">${problemas.filter((p) => p.nivel === "aviso").length} avisos</span>` : "");
    btnDeshacer.disabled = !historial.length; btnRehacer.disabled = !futuro.length;
    pintarTabs();
  }
  function anadir(k, extra = {}) {
    const a = r3(t());
    const base = {
      subtitulos: { inicio: a, fin: r3(Math.min(E.duracion, a + 1.2)), texto: "Texto nuevo", pos: "normal" },
      tarjetas: { id: `tarjeta-${E.tarjetas.length + 1}`, inicio: a, fin: r3(Math.min(E.duracion, a + 2.5)), titulo: "Título", texto: "", y: B.zona_segura.arriba + 40, estilo: "blanca" },
      zooms: { inicio: a, fin: r3(Math.min(E.duracion, a + (B.animaciones?.zoom_punch_in?.duracion_s ?? 0.8))), escala: B.animaciones?.zoom_punch_in?.escala ?? 1.04, origen: "50% 40%" },
      encuadre: { inicio: a, ...ENCUADRES["Completo"] },
      fondos: { id: `broll-${E.fondos.length + 1}`, inicio: a, fin: r3(Math.min(E.duracion, a + 2.5)), desde: 0, kenburns: true },
      motion: { id: `motion-${E.motion.length + 1}`, inicio: a, fin: r3(Math.min(E.duracion, a + 2)), x: 140, y: 400, ancho: 800 },
      efectos: { id: `efx-${Date.now().toString(36)}`, receta: "fundido-negro", inicio: a, fin: r3(Math.min(E.duracion, a + 0.6)), params: {} },
    }[k];
    const obj = { ...base, ...extra };
    commit(() => E[k].push(obj));
    const i = E[k].findIndex((o) => o.inicio === obj.inicio && (o.id ?? o.texto) === (obj.id ?? obj.texto));
    seleccionar(k, i);
  }
  function insertarItem(it, enT = t()) {
    const k = it.tipo === "motion" ? "motion" : "fondos";
    const largo = it.clase === "video" ? Math.min(it.duracion ?? 2.5, 4) : 2.5;
    anadir(k, { archivo: it.ruta, inicio: r3(enT), fin: r3(Math.min(E.duracion, enT + largo)), id: `${k === "motion" ? "m" : "b"}-${it.nombre.replace(/\.\w+$/, "").replace(/[^\w-]/g, "-").slice(0, 24)}-${Math.round(enT * 10)}` });
    toast(`Añadido «${it.nombre}» en ${tiempo(enT)}`);
  }
  // x = {receta, params, tecnica?, duracion?}: una técnica del Learner o una receta suelta
  function insertarEfecto(x, enT = t()) {
    const R = RECETAS[x.receta];
    if (!R) return toast("Esa técnica no tiene receta todavía", true);
    const largo = Number(x.duracion) || R.duracion;
    anadir("efectos", { id: `efx-${Date.now().toString(36)}`, receta: x.receta, tecnica: x.tecnica, params: { ...(x.params ?? {}) }, inicio: r3(enT), fin: r3(Math.min(E.duracion, enT + largo)) });
    const choca = rasgosDe({ receta: x.receta, params: x.params }).filter((r) => prohibidos.includes(r));
    toast(choca.length ? `Añadido «${R.nombre}» · ⚠ tu marca dice «Nunca» a ${choca.join(", ")}` : `Añadido «${R.nombre}» en ${tiempo(enT)}`, choca.length > 0);
  }
  function seleccionar(k, i, { saltar = false } = {}) {
    sel = k == null ? null : { k, i };
    if (saltar && sel) ir(E[k][i].inicio + 0.01);
    if (sel) { tabActiva = "props"; pintarTabs(); }
    pintarTL(); pintarPanel(); pintarEscena(true);
  }
  function borrarSel() { if (!sel) return; const { k, i } = sel; sel = null; commit(() => E[k].splice(i, 1)); }
  function dividirSub() {
    const i = sel?.k === "subtitulos" ? sel.i : E.subtitulos.findIndex((s) => s.inicio <= t() && t() < s.fin);
    if (i < 0) return toast("Pon el cabezal sobre un subtítulo", true);
    const s = E.subtitulos[i], corte = r3(t());
    if (corte <= s.inicio + 0.13 || corte >= s.fin - 0.13) return toast("Muy cerca del borde para dividir", true);
    const pal = s.texto.split(/\s+/);
    const enRango = palabras.filter((p) => p.start >= s.inicio - 0.05 && p.end <= s.fin + 0.05);
    let n = enRango.length === pal.length ? enRango.filter((p) => p.start < corte).length : Math.round(pal.length * (corte - s.inicio) / (s.fin - s.inicio));
    n = Math.max(1, Math.min(pal.length - 1, n));
    commit(() => E.subtitulos.splice(i, 1, { ...s, fin: corte, texto: pal.slice(0, n).join(" ") }, { ...s, inicio: corte, texto: pal.slice(n).join(" ") }));
  }
  function unirSub(i) {
    const a = E.subtitulos[i], b = E.subtitulos[i + 1];
    if (!b) return;
    commit(() => E.subtitulos.splice(i, 2, { ...a, fin: b.fin, texto: `${a.texto} ${b.texto}` }));
  }
  // Subtítulos automáticos desde la transcripción: grupos por pausa ≥150 ms, puntuación y tamaño de la marca.
  async function autoSubtitulos() {
    if (!palabras.length) return toast("No hay transcripción con tiempos", true);
    if (E.subtitulos.length && !(await confirmar(`Se reemplazarán los ${E.subtitulos.length} subtítulos actuales (puedes deshacer con Ctrl+Z).`, { si: "Reemplazar" }))) return;
    const [min, max] = B.subtitulos.palabras_por_grupo ?? [3, 7];
    const cabe = (g) => g.length <= max && cajaSubtitulo({ texto: g.map((x) => x.text).join(" "), pos: "normal" }, E, B).lineas <= (B.subtitulos.lineas_max ?? 2);
    // Fuerza de corte después de la palabra i: fin de frase > coma > pausa larga.
    const fuerza = (i) => {
      const p = palabras[i], sig = palabras[i + 1];
      if (!sig) return 10;
      const pausa = sig.start - p.end;
      return (/[.!?…]$/.test(p.text) ? 6 : /[,;:]$/.test(p.text) ? 3 : 0) + Math.min(4, pausa / 0.15);
    };
    // 1) Frases: cortar en fin de frase o pausa larga.
    const frases = []; let f = [];
    palabras.forEach((p, i) => { f.push(i); if (fuerza(i) >= 6) { frases.push(f); f = []; } });
    if (f.length) frases.push(f);
    // 2) Cada frase que no cabe se parte por su mejor punto (coma o pausa), dejando ≥ min palabras a cada lado si se puede.
    const partir = (idx) => {
      if (cabe(idx.map((i) => palabras[i]))) return [idx];
      let mejor = -1, valor = -1;
      for (let k = 0; k < idx.length - 1; k++) {
        const izq = k + 1, der = idx.length - izq;
        const v = fuerza(idx[k]) + (izq >= min && der >= min ? 2 : 0) - Math.abs(izq - der) * 0.05;
        if (v > valor) { valor = v; mejor = k; }
      }
      return [...partir(idx.slice(0, mejor + 1)), ...partir(idx.slice(mejor + 1))];
    };
    let grupos = frases.flatMap(partir).map((idx) => idx.map((i) => palabras[i]));
    // 3) Huérfanos (1–2 palabras) se unen al vecino si cabe.
    for (let i = 0; i < grupos.length; i++) {
      if (grupos[i].length >= Math.min(min, 3)) continue;
      if (i > 0 && cabe([...grupos[i - 1], ...grupos[i]]) && grupos[i][0].start - grupos[i - 1].at(-1).end < 0.6) { grupos[i - 1].push(...grupos[i]); grupos.splice(i--, 1); }
      else if (i + 1 < grupos.length && cabe([...grupos[i], ...grupos[i + 1]])) { grupos[i + 1].unshift(...grupos[i]); grupos.splice(i--, 1); }
    }
    commit(() => { E.subtitulos = grupos.map((x) => ({ inicio: r3(x[0].start), fin: r3(x.at(-1).end), texto: x.map((p) => p.text).join(" ").trim(), pos: "normal" })); });
    toast(`${grupos.length} subtítulos creados desde la transcripción`);
  }
  let guardando = false;
  async function guardar() {
    if (guardando) return;
    const err = problemas.filter((p) => p.nivel === "error");
    if (err.length) { tabActiva = "avisos"; pintarTabs(); pintarPanel(); return toast(`Corrige ${err.length} errores antes de guardar`, true); }
    guardando = true;
    estado.textContent = "Guardando…";
    try {
      const r = await api(`/api/proyecto/${slug}/version`, { json: { desde: version, edicion: E } });
      if (!r.ok) { toast(r.errores ? r.errores.map((e) => e.mensaje).join(" · ") : "No se pudo generar", true); if (r.salida) console.log(r.salida); revisar(); return; }
      try { localStorage.removeItem(clave); } catch {}
      clearTimeout(borradorTimer);
      await api(`/api/proyecto/${slug}/borrador/${version}`, { json: { edicion: null } }).catch(() => {});
      sucio = false;
      toast(`Guardado como ${r.version}. Revisa la versión antes de exportar.`);
      location.hash = `#/editor/${slug}/${r.version}`;
    } catch (e) { toast(e.message, true); revisar(); } finally { guardando = false; }
  }

  // ---------- línea de tiempo ----------
  const cabezal = h("div.cabezal");
  let ondaPng = null;
  api(`/api/onda?ruta=${encodeURIComponent(d.clip)}`).then((o) => { ondaPng = o.png; pintarTL(); }).catch(() => {});
  function pintarTL() {
    const W = Math.max(E.duracion * pxs, tlScroll.clientWidth);
    tlLienzo.style.width = `${W}px`;
    const paso = pxs > 120 ? 0.5 : pxs > 50 ? 1 : pxs > 20 ? 2 : 5;
    const marcas = [];
    for (let s = 0; s <= E.duracion; s += paso) marcas.push(h("div.marca", { style: { left: `${s * pxs}px` } }, s % 1 ? "" : tiempo(s).replace(/\.\d+$/, "")));
    const regla = h("div.regla", { on: { mousedown: (e) => arrastrarCabezal(e) } }, marcas);
    const audio = h("div.pista", ondaPng && h("div.onda", { style: { backgroundImage: `url("${archivo(ondaPng)}")`, width: `${E.duracion * pxs}px` } }));
    const err = new Set(problemas.filter((p) => p.nivel === "error" && p.indice >= 0).map((p) => `${p.tipo}:${p.indice}`));
    const pistas = PISTAS.map((P) => {
      const pista = h("div.pista", { "data-k": P.k, on: {
        mousedown: (e) => { if (e.target === pista) { seleccionar(null); arrastrarCabezal(e); } },
        dragover: (e) => { if (((P.k === "fondos" || P.k === "motion") && e.dataTransfer.types.includes("application/x-item")) || (P.k === "efectos" && e.dataTransfer.types.includes("application/x-efecto"))) { e.preventDefault(); pista.classList.add("encima"); } },
        dragleave: () => pista.classList.remove("encima"),
        drop: (e) => { e.preventDefault(); pista.classList.remove("encima");
          const enT = Math.max(0, (e.clientX - tlLienzo.getBoundingClientRect().left) / pxs);
          if (P.k === "efectos") { const x = JSON.parse(e.dataTransfer.getData("application/x-efecto") || "null"); if (x) insertarEfecto(x, enT); return; }
          const it = bib.items[e.dataTransfer.getData("application/x-item")]; if (it) insertarItem({ ...it, tipo: P.k === "motion" ? "motion" : "broll" }, Math.max(0, (e.clientX - tlLienzo.getBoundingClientRect().left) / pxs)); },
      } });
      E[P.k].forEach((o, i) => {
        const fin = P.k === "encuadre" ? (E.encuadre[i + 1]?.inicio ?? E.duracion) : o.fin;
        const nombre = P.k === "subtitulos" ? o.texto : P.k === "fondos" || P.k === "motion" ? (o.archivo ?? "").split("/").pop() : P.k === "tarjetas" ? (o.titulo || o.texto || o.id) :
          P.k === "zooms" ? `${o.escala ?? 1.04}×` : P.k === "efectos" ? `${RECETAS[o.receta]?.nombre ?? o.receta}${o.params?.texto ? ` «${o.params.texto}»` : ""}` : (Object.entries(ENCUADRES).find(([, v]) => v.escala === o.escala && v.origen === o.origen)?.[0] ?? `${o.escala}×`);
        const it = (P.k === "fondos" || P.k === "motion") && itemDe(o.archivo);
        const b = h("div.blq", { class: `${P.c}${sel?.k === P.k && sel.i === i ? " sel" : ""}${err.has(`${P.k}:${i}`) ? " mal" : ""}${P.k === "efectos" && chocaMarca(o) ? " choca" : ""}`, title: P.k === "efectos" && chocaMarca(o) ? `${nombre} · ⚠ choca con tu marca` : nombre,
          style: { left: `${o.inicio * pxs}px`, width: `${Math.max(4, (fin - o.inicio) * pxs)}px` } },
          it?.miniatura ? h("img.mini", { src: archivo(it.miniatura) }) : null, nombre,
          P.k !== "encuadre" && h("div.borde.i"), P.k !== "encuadre" && h("div.borde.d"));
        b.addEventListener("mousedown", (e) => arrastrarBloque(e, P.k, i, e.target.classList.contains("i") ? "i" : e.target.classList.contains("d") ? "d" : "mover"));
        b.addEventListener("dblclick", () => { seleccionar(P.k, i, { saltar: true }); setTimeout(() => $("[data-foco]", panel)?.focus(), 0); });
        pista.append(b);
      });
      return pista;
    });
    tlLienzo.replaceChildren(regla, audio, ...pistas, cabezal);
    cabezal.style.left = `${t() * pxs}px`;
  }
  function arrastrarCabezal(e) {
    const x0 = tlLienzo.getBoundingClientRect().left;
    const mover = (ev) => ir((ev.clientX - x0) / pxs);
    mover(e);
    const fin = () => { removeEventListener("mousemove", mover); removeEventListener("mouseup", fin); };
    addEventListener("mousemove", mover); addEventListener("mouseup", fin);
  }
  function puntosImán(k) {
    const p = [t(), 0, E.duracion];
    if (k === "subtitulos") for (const w of palabras) p.push(w.start, w.end);
    for (const P of PISTAS) for (const o of E[P.k]) p.push(o.inicio, o.fin ?? o.inicio);
    return p;
  }
  function arrastrarBloque(e, k, i, modo) {
    if (e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    if (!(sel?.k === k && sel.i === i)) seleccionar(k, i);
    const o = E[k][i], a0 = o.inicio, f0 = o.fin ?? o.inicio, x0 = e.clientX;
    const iman = puntosImán(k).filter((v) => v !== a0 && v !== f0);
    const pegar = (v) => { if (e.altKey) return v; let mejor = v, dist = 7 / pxs; for (const p of iman) if (Math.abs(p - v) < dist) { dist = Math.abs(p - v); mejor = p; } return mejor; };
    let movido = false, guardado = null;
    const mover = (ev) => {
      const dt = (ev.clientX - x0) / pxs;
      if (!movido && Math.abs(ev.clientX - x0) < 3) return;
      if (!movido) { movido = true; guardado = JSON.stringify(E); }
      const largo = f0 - a0;
      if (modo === "mover") {
        let a = pegar(a0 + dt);
        const fPeg = pegar(a0 + dt + largo);
        if (fPeg !== a0 + dt + largo && a === a0 + dt) a = fPeg - largo;
        a = Math.max(0, Math.min(E.duracion - (k === "encuadre" ? 0.01 : largo), a));
        o.inicio = r3(a); if (o.fin != null) o.fin = r3(a + largo);
      } else if (modo === "i") o.inicio = r3(Math.max(0, Math.min(f0 - 0.1, pegar(a0 + dt))));
      else o.fin = r3(Math.min(E.duracion, Math.max(a0 + 0.1, pegar(f0 + dt))));
      if (k === "fondos" && modo === "i" && IMG.test(o.archivo ?? "") === false) o.desde = r3(Math.max(0, (o.desde ?? 0) + (o.inicio - a0) * (o.velocidad ?? 1)));
      firmaEdicion++; pintarTL(); pintarEscena(true);
      if (modo === "mover") ir(o.inicio + 0.01); else ir(modo === "i" ? o.inicio + 0.01 : o.fin - 0.02);
    };
    const fin = () => {
      removeEventListener("mousemove", mover); removeEventListener("mouseup", fin);
      if (movido) { const nuevo = JSON.parse(JSON.stringify(E)); E = JSON.parse(guardado); commit(() => { E = nuevo; }); }
    };
    addEventListener("mousemove", mover); addEventListener("mouseup", fin);
  }

  // ---------- panel lateral ----------
  const num = (obj, campo, { paso = 0.01, min, max, foco } = {}) => h("input", { type: "number", step: paso, min, max, value: obj[campo] ?? "", "data-foco": foco ? "" : null,
    on: { change: (e) => commit(() => { obj[campo] = e.target.value === "" ? undefined : Number(e.target.value); }) } });
  const txt = (obj, campo, { area = false, foco = false, ph = "" } = {}) => {
    const el = h(area ? "textarea" : "input", { type: area ? null : "text", rows: area ? 2 : null, value: area ? null : obj[campo] ?? "", placeholder: ph, "data-foco": foco ? "" : null,
      on: { input: (e) => { obj[campo] = e.target.value; firmaEdicion++; pintarEscena(true); }, change: (e) => { const v = e.target.value; obj[campo] = historialValor; commit(() => { obj[campo] = v; }); } } });
    if (area) el.value = obj[campo] ?? "";
    let historialValor = obj[campo];
    el.addEventListener("focus", () => (historialValor = obj[campo]));
    return el;
  };
  const campo = (n, el) => h("label.campo", n, el);
  const selArchivo = (obj, tipos) => {
    const s = h("select", h("option", { value: obj.archivo ?? "" }, (obj.archivo ?? "(elige)").split("/").pop()),
      items.filter((i) => tipos.includes(i.tipo) && i.ruta !== obj.archivo).map((i) => h("option", { value: i.ruta }, `${i.nombre} · ${i.tipo}`)));
    s.onchange = () => commit(() => { obj.archivo = s.value; });
    return s;
  };

  function pintarPanel() {
    const f = { props: panelProps, trans: panelTrans, bib: panelBib, tec: panelTec, avisos: panelAvisos, ver: panelVersion }[tabActiva];
    panel.replaceChildren(...f().filter((x) => x != null && x !== false && x !== ""));
  }
  function panelProps() {
    if (!sel || !E[sel.k]?.[sel.i]) return panelGeneral();
    const { k, i } = sel, o = E[k][i];
    const tiempos = h("div.rejilla2", campo("Inicio (s)", num(o, "inicio")), k === "encuadre" ? h("div") : campo("Fin (s)", num(o, "fin")));
    const quitar = h("button.btn.peligro", { on: { click: borrarSel } }, "🗑 Eliminar");
    const P = PISTAS.find((p) => p.k === k);
    const cab = h("div.fila", h("b", `${P.n.replace(/s$/, "")} ${i + 1}`), h("div.espacio"), h("button.btn.chico", { on: { click: () => seleccionar(null) } }, "✕"));
    if (k === "subtitulos") {
      const pos = h("select", Object.keys(E.posiciones_subtitulo).map((p) => h("option", { value: p, selected: p === o.pos }, `${p} (y ${E.posiciones_subtitulo[p]})`)));
      pos.onchange = () => commit(() => { o.pos = pos.value; delete o.y; });
      const c = cajaSubtitulo(o, E, B);
      return [cab, campo("Texto", txt(o, "texto", { area: true, foco: true })), tiempos,
        h("div.rejilla2", campo("Posición", pos), campo(`Tamaño (marca ${B.subtitulos.tamano_base_px})`, num(o, "tamano", { paso: 1, min: B.subtitulos.tamano_minimo_px }))),
        campo("Y propia (opcional, centro en px)", num(o, "y", { paso: 10 })),
        h("div.tenue", `~${c.lineas} línea(s) · ${((o.fin - o.inicio)).toFixed(2)} s`),
        h("div.fila", h("button.btn.chico", { on: { click: dividirSub } }, "✂ Dividir en el cabezal (S)"), h("button.btn.chico", { on: { click: () => unirSub(i) } }, "⇢ Unir con el siguiente"),
          h("button.btn.chico", { on: { click: () => commit(() => { o.inicio = r3(t()); }) } }, "⇤ Empieza aquí"), h("button.btn.chico", { on: { click: () => commit(() => { o.fin = r3(t()); }) } }, "⇥ Termina aquí")),
        quitar];
    }
    if (k === "fondos" || k === "motion") {
      const it = itemDe(o.archivo);
      const vista = it?.miniatura ? h("img", { src: archivo(it.miniatura), style: { width: "100%", maxHeight: "180px", objectFit: "contain", borderRadius: "8px", background: "#000" } }) : null;
      const esImg = IMG.test(o.archivo ?? "");
      const kb = h("input", { type: "checkbox", checked: o.kenburns !== false, on: { change: (e) => commit(() => { o.kenburns = e.target.checked; }) } });
      const ajuste = h("select", ["cover", "contain"].map((v) => h("option", { value: v, selected: (o.ajuste ?? "cover") === v }, v === "cover" ? "Llenar (recorta)" : "Encajar (barras)")));
      ajuste.onchange = () => commit(() => { o.ajuste = ajuste.value; });
      return [cab, vista, campo("Archivo", selArchivo(o, k === "motion" ? ["motion", "broll"] : ["broll", "inspiracion", "videos", "motion"])), tiempos,
        k === "fondos" && !esImg && h("div.rejilla2", campo("Desde (s del video)", num(o, "desde")), campo("Velocidad", num(o, "velocidad", { paso: 0.05, min: 0.1, max: 4 }))),
        k === "fondos" && esImg && h("label.fila", kb, "Ken Burns (acercamiento lento)"),
        k === "fondos" && campo("Ajuste", ajuste),
        k === "motion" && h("div.rejilla2", campo("X (px)", num(o, "x", { paso: 10 })), campo("Y (px)", num(o, "y", { paso: 10 }))),
        k === "motion" && campo("Ancho (px)", num(o, "ancho", { paso: 10 })),
        h("div.tenue", { style: { fontSize: "12px", wordBreak: "break-all" } }, o.archivo), quitar];
    }
    if (k === "efectos") {
      const R = RECETAS[o.receta];
      const selR = h("select", Object.entries(RECETAS).map(([id, r]) => h("option", { value: id, selected: id === o.receta }, `${r.nombre} · ${CATEGORIAS[r.categoria]}`)));
      selR.onchange = () => commit(() => { o.receta = selR.value; o.params = {}; });
      o.params ??= {};
      const P = parametros(o);
      const campos = R ? Object.entries(R.params).map(([pk, def]) => {
        const el = def.tipo === "opcion" ? h("select", def.opciones.map((op) => h("option", { value: op, selected: op === P[pk] }, op))) :
          h("input", { type: def.tipo === "num" ? "number" : def.tipo === "color" ? "color" : "text", step: def.paso, min: def.min, max: def.max, value: P[pk] });
        el.onchange = () => commit(() => { o.params[pk] = def.tipo === "num" ? Number(el.value) : el.value; });
        return campo(def.nombre, el);
      }) : [];
      const choca = rasgosDe(o).filter((r) => prohibidos.includes(r));
      const tec = o.tecnica && tecnicas.find((x) => x.slug === o.tecnica);
      return [cab, campo("Receta", selR), h("div.tenue", R?.descripcion ?? ""), tiempos, h("div.rejilla2", ...campos),
        choca.length && h("div.problema.aviso", `Tu marca dice «Nunca» a: ${choca.join(", ")}. ${B.animaciones?.filosofia ?? ""}`),
        tec && h("div.tenue", "Técnica del Learner: ", h("a", { href: "#/learner" }, tec.nombre)),
        tec?.ejemplos?.[0] && h("video", { src: archivo(tec.ejemplos[0].clip), muted: true, autoplay: true, loop: true, playsInline: true, style: { width: "100%", maxHeight: "200px", objectFit: "contain", background: "#000", borderRadius: "8px" } }),
        quitar];
    }
    if (k === "tarjetas") {
      const est = h("select", ["blanca", "oscura"].map((v) => h("option", { value: v, selected: o.estilo === v }, v)));
      est.onchange = () => commit(() => { o.estilo = est.value; });
      return [cab, campo("Título", txt(o, "titulo", { foco: true })), campo("Texto", txt(o, "texto", { area: true })), tiempos,
        h("div.rejilla2", campo("Y (borde superior, px)", num(o, "y", { paso: 10 })), campo("Estilo", est)), quitar];
    }
    if (k === "zooms") {
      const zp = B.animaciones?.zoom_punch_in ?? {};
      return [cab, tiempos, h("div.rejilla2", campo(`Escala (marca ${zp.escala ?? "?"})`, num(o, "escala", { paso: 0.01, min: 1, max: 2 })), campo("Origen", txt(o, "origen", { ph: "50% 40%" }))),
        h("div.tenue", zp.uso ?? ""), quitar];
    }
    const pre = h("select", h("option", { value: "" }, "Preajuste…"), Object.keys(ENCUADRES).map((n) => h("option", { value: n }, n)));
    pre.onchange = () => pre.value && commit(() => Object.assign(o, ENCUADRES[pre.value]));
    return [cab, h("div.tenue", "Corte seco del creador desde este momento (nunca se voltea)."), tiempos, campo("Preajuste", pre),
      h("div.rejilla2", campo("Escala", num(o, "escala", { paso: 0.05, min: 0.2, max: 2 })), campo("Origen", txt(o, "origen", { ph: "1080px 1920px" }))),
      h("div.rejilla2", campo("X (px)", num(o, "x", { paso: 10 })), campo("Y (px)", num(o, "y", { paso: 10 }))), quitar];
  }
  function panelGeneral() {
    const rec = h("input", { type: "checkbox", checked: E.recorte, disabled: !d.recorte && !E.recorte, on: { change: (e) => { commit(() => { E.recorte = e.target.checked; }); ordenCapas(); fondoActual = -2; } } });
    const posiciones = h("div", { style: { display: "grid", gap: "6px" } }, Object.keys(E.posiciones_subtitulo).map((p) => h("div.rejilla2", h("span.tenue", p), num(E.posiciones_subtitulo, p, { paso: 10 }))),
      h("button.btn.chico", { on: { click: async () => { const n = await preguntar("Nombre de la posición (ej.: alto, hook)"); if (n) commit(() => { E.posiciones_subtitulo[n] = 600; }); } } }, "+ Posición"));
    const musicas = items.filter((i) => i.tipo === "audio");
    const mus = h("select", h("option", { value: "" }, "Sin música"), musicas.map((i) => h("option", { value: i.ruta, selected: E.audio?.musica?.archivo === i.ruta }, i.nombre)));
    mus.onchange = () => commit(() => { E.audio = { musica: mus.value ? { archivo: mus.value, volumen: E.audio?.musica?.volumen ?? 0.1, desde: 0 } : null }; });
    return [h("b", "Edición de esta versión"), h("div.tenue", `${E.duracion} s · ${E.subtitulos.length} subtítulos · ${E.fondos.length} B-roll · ${E.tarjetas.length} tarjetas · ${E.zooms.length} zooms · ${E.efectos.length} efectos`),
      h("div.tenue", "Selecciona un bloque en la línea de tiempo para editarlo, o haz doble clic para ir a su texto."),
      h("label.fila", rec, "Creador recortado (sin fondo) sobre el B-roll"),
      !d.recorte && h("button.btn.chico", { on: { click: intentar(() => accion({ accion: "recorte", slug }, { abrir: true })) } }, "Quitar fondo del creador (crea recorte/clip-recorte.webm)"),
      h("b", "Posiciones de subtítulo (centro y)"), posiciones,
      campo("Palabras que no se parten (separadas por coma)", (() => { const i = h("input", { type: "text", value: E.sin_partir.join(", ") }); i.onchange = () => commit(() => { E.sin_partir = i.value.split(",").map((x) => x.trim()).filter(Boolean); }); return i; })()),
      campo("Música de fondo", mus),
      E.audio?.musica && campo("Volumen (0.1 ≈ −20 dB)", num(E.audio.musica, "volumen", { paso: 0.01, min: 0, max: 1 })),
      h("b", "Añadir en el cabezal"), h("div.fila", PISTAS.filter((p) => !["fondos", "motion"].includes(p.k)).map((p) => h("button.btn.chico", { on: { click: () => anadir(p.k) } }, `+ ${p.n.replace(/s$/, "")}`))),
      h("div.tenue", "B-roll y motion: arrástralos desde la pestaña Biblioteca a su pista.")];
  }
  function panelTrans() {
    if (!palabras.length) return [h("div.vacio", "Esta versión no tiene transcripción con tiempos.")];
    const usadas = new Set();
    palabras.forEach((p, i) => { if (E.subtitulos.some((s) => s.inicio - 0.02 <= p.start && p.end <= s.fin + 0.02)) usadas.add(i); });
    const crear = h("button.btn.chico.prim", { disabled: !marcadas, on: { click: () => {
      const [a, b] = marcadas; const g = palabras.slice(a, b + 1);
      marcadas = null; anadir("subtitulos", { inicio: r3(g[0].start), fin: r3(g.at(-1).end), texto: g.map((p) => p.text).join(" ") });
    } } }, "Crear subtítulo con la selección");
    const caja = h("div.palabras", palabras.map((p, i) => h("span.palabra", { "data-i": i, class: (usadas.has(i) ? "usada " : "") + (marcadas && i >= marcadas[0] && i <= marcadas[1] ? "marcada" : ""),
      title: `${p.start.toFixed(2)}–${p.end.toFixed(2)}`, on: { click: (e) => {
        if (e.shiftKey && marcadas) marcadas = [Math.min(marcadas[0], i), Math.max(marcadas[0], i)];
        else if (e.shiftKey) marcadas = [i, i];
        else { marcadas = null; ir(p.start + 0.01); }
        pintarPanel();
      } } }, p.text, " ")));
    return [h("div.tenue", "Clic = ir a la palabra · Shift+clic = seleccionar un rango. Subrayado = ya tiene subtítulo."),
      h("div.fila", crear, h("button.btn.chico", { on: { click: autoSubtitulos } }, "⚡ Subtítulos automáticos")), caja];
  }
  function panelBib() {
    const pend = sessionStorage.getItem("insertar"); sessionStorage.removeItem("insertar");
    const q = h("input", { type: "search", placeholder: "Buscar B-roll, motion, referentes…", value: pend ? bib.items[pend]?.nombre ?? "" : "" });
    const tipo = h("select", [["", "Todo"], ["broll", "B-roll"], ["motion", "Motion"], ["inspiracion", "Inspiración"], ["videos", "Videos"]].map(([v, n]) => h("option", { value: v }, n)));
    const rej = h("div.mini-bib");
    // Carpetas de la biblioteca (por defecto, la de este reel si existe).
    const selCarpeta = h("select");
    const llenarCarpetas = () => {
      const cs = [...new Set(items.filter((i) => i.clase !== "audio" && (!tipo.value || i.tipo === tipo.value) && i.carpeta).map((i) => i.carpeta.split("/")[0]))].sort();
      const tema = slug.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-/g, " ").toLowerCase();
      const previa = selCarpeta.value || (pend ? "" : cs.find((c) => c.toLowerCase() === tema) ?? "");
      selCarpeta.replaceChildren(h("option", { value: "" }, "Todas las carpetas"), cs.map((c) => h("option", { value: c, selected: c === previa }, `📁 ${c}`)));
    };
    const pintar = () => {
      const w = q.value.toLowerCase().split(/\s+/).filter(Boolean);
      const c = selCarpeta.value;
      rej.replaceChildren(...items.filter((i) => i.clase !== "audio" && (!tipo.value || i.tipo === tipo.value) && (!c || i.carpeta === c || (i.carpeta ?? "").startsWith(c + "/")) && w.every((x) => `${i.nombre} ${i.etiquetas.join(" ")} ${i.descripcion} ${i.carpeta ?? ""}`.toLowerCase().includes(x)))
        .slice(0, 90).map((i) => {
          const el = h("div.item", { draggable: "true", title: `${i.nombre}\n${i.descripcion || i.etiquetas.join(", ")}\nArrastra a la pista B-roll o Motion · clic = insertar en el cabezal`, on: { click: () => insertarItem(i) } },
            h("div.vista", { style: { backgroundImage: i.miniatura ? `url("${archivo(i.miniatura)}")` : "none" } }), h("div.info", h("div.nombre", i.nombre)));
          el.addEventListener("dragstart", (e) => { e.dataTransfer.setData("application/x-item", i.id); e.dataTransfer.effectAllowed = "copy"; });
          return el;
        }));
    };
    q.oninput = pintar; tipo.onchange = () => { llenarCarpetas(); pintar(); }; selCarpeta.onchange = pintar; llenarCarpetas(); pintar();
    return [h("div.fila", q, tipo), h("div.fila", selCarpeta), h("div.tenue", "Arrastra a la pista B-roll o Motion, o haz clic para insertar en el cabezal."), rej];
  }
  function panelTec() {
    const pend = sessionStorage.getItem("insertarTecnica"); sessionStorage.removeItem("insertarTecnica");
    const q = h("input", { type: "search", placeholder: "Buscar técnica o receta…" });
    const soloMarca = h("input", { type: "checkbox", checked: true });
    const caja = h("div", { style: { display: "grid", gap: "6px" } });
    const fila = (x, titulo, sub, mini, clip) => {
      const choca = rasgosDe({ receta: x.receta, params: x.params }).some((r) => prohibidos.includes(r));
      const el = h("div.item", { draggable: "true", style: { display: "grid", gridTemplateColumns: "44px 1fr", gap: "8px", alignItems: "center", padding: "6px" },
        title: "Arrastra a la pista Efectos · clic = insertar en el cabezal", on: { click: () => insertarEfecto(x) } },
        h("div", { style: { width: "44px", height: "56px", borderRadius: "6px", background: mini ? `#000 url("${archivo(mini)}") center/cover` : "var(--panel2)", display: "grid", placeItems: "center", fontSize: "18px" } }, mini ? "" : "✨"),
        h("div", { style: { minWidth: 0 } }, h("div.nombre", titulo, choca ? h("span.aviso-txt", " ⚠") : ""), h("div.tags", sub)));
      if (clip) { let v; el.addEventListener("mouseenter", () => { v = h("video", { src: archivo(clip), muted: true, autoplay: true, loop: true, style: { position: "fixed", right: "320px", bottom: "40px", width: "180px", borderRadius: "10px", zIndex: 50, boxShadow: "var(--sombra)" } }); document.body.append(v); }); el.addEventListener("mouseleave", () => v?.remove()); }
      el.addEventListener("dragstart", (e) => { e.dataTransfer.setData("application/x-efecto", JSON.stringify(x)); e.dataTransfer.effectAllowed = "copy"; });
      return { el, choca, texto: `${titulo} ${sub}`.toLowerCase() };
    };
    const conReceta = tecnicas.filter((x) => x.receta && RECETAS[x.receta]);
    const filas = [
      ...conReceta.map((x) => fila({ receta: x.receta, params: x.parametros, tecnica: x.slug, duracion: x.duracion_s }, x.nombre, `${CATEGORIAS[x.categoria] ?? ""} · ${x.veces ?? 0} ejemplos`, x.miniatura, x.ejemplos?.[0]?.clip)),
      ...Object.entries(RECETAS).map(([id, r]) => fila({ receta: id }, r.nombre, `receta · ${CATEGORIAS[r.categoria]}`, null, null)),
    ];
    const sinReceta = tecnicas.length - conReceta.length;
    const pintar = () => {
      const w = q.value.toLowerCase().split(/\s+/).filter(Boolean);
      caja.replaceChildren(...filas.filter((f) => (!soloMarca.checked || !f.choca) && w.every((x) => f.texto.includes(x))).map((f) => f.el));
    };
    q.oninput = pintar; soloMarca.onchange = pintar; pintar();
    if (pend) { const tq = tecnicas.find((x) => x.slug === pend); if (tq) { q.value = tq.nombre; pintar(); toast(`Pon el cabezal donde va «${tq.nombre}» y haz clic en ella, o arrástrala a la pista Efectos`); } }
    return [q, h("label.fila", soloMarca, "Solo las que encajan con mi marca"),
      h("div.tenue", `Técnicas del Learner con receta (${conReceta.length}) y recetas sueltas. Arrástralas a la pista Efectos o haz clic para ponerlas en el cabezal.${sinReceta ? ` ${sinReceta} técnicas sin receta están en el Learner como inspiración.` : ""}`),
      caja, h("a.btn.chico", { href: "#/learner" }, "🧠 Abrir el Learner")];
  }
  function panelAvisos() {
    if (!problemas.length) return [h("div.ok-txt", "✔ Todo cumple las reglas de la marca (estimado)."), h("div.tenue", "La medición exacta de cajas la hace «Validar».")];
    return problemas.map((p) => h("div.problema", { class: p.nivel, on: { click: () => p.indice >= 0 && seleccionar(p.tipo, p.indice, { saltar: true }) } }, p.mensaje));
  }
  function panelVersion() {
    const v = proy.versiones.find((x) => x.v === version) ?? {};
    return [h("div.fila", h("b", version), v.meta?.desde && h("span.tenue", `desde ${v.meta.desde}`)),
      v.validacion ? h("details", { open: true }, h("summary", "Validación"), h("div.md", { html: md(v.validacion) })) : h("div.tenue", "Sin validar todavía."),
      v.retencion ? h("details", h("summary", "Retención"), h("div.md", { html: md(v.retencion) })) : h("button.btn.chico", { on: { click: () => pedirAgente({ tarea: "retencion", slug, version, versiones: vs }) } }, "🤖 Revisión de retención"),
      v.final && h("video.player", { src: archivo(v.final), controls: true }),
      proy.plan && h("details", h("summary", "Plan de edición"), h("div.md", { html: md(proy.plan) }))];
  }

  // ---------- teclado ----------
  const teclas = (e) => {
    if (e.target?.closest?.("input, textarea, select")) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); e.target.blur(); guardar(); } return; }
    const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
    if (k === " ") { e.preventDefault(); alternar(); }
    else if (ctrl && k === "z") { e.preventDefault(); e.shiftKey ? rehacer() : deshacer(); }
    else if (ctrl && k === "y") { e.preventDefault(); rehacer(); }
    else if (ctrl && k === "s") { e.preventDefault(); guardar(); }
    else if (k === "delete" || k === "backspace") { e.preventDefault(); borrarSel(); }
    else if (k === "s") dividirSub();
    else if (k === "arrowleft") ir(t() - (e.shiftKey ? 1 : 1 / 30));
    else if (k === "arrowright") ir(t() + (e.shiftKey ? 1 : 1 / 30));
    else if (k === "escape") seleccionar(null);
  };
  addEventListener("keydown", teclas);
  const antesDeSalir = (e) => { if (sucio) { e.preventDefault(); e.returnValue = ""; } };
  addEventListener("beforeunload", antesDeSalir);

  // ---------- arranque ----------
  master.addEventListener("loadedmetadata", () => { pxs = Math.max(8, Math.min(120, (tlScroll.clientWidth - 20) / E.duracion)); zoomTL.value = pxs; pintarTL(); ir(0.01); }, { once: true });
  revisar(); pintarTabs(); pintarPanel(); pintarTL(); requestAnimationFrame(bucle);
  if (borrador) {
    const aviso = h("span.fila", h("span.aviso-txt", "Hay un borrador sin guardar de esta versión"),
      h("button.btn.chico", { on: { click: () => { try { historial.push(JSON.stringify(E)); E = normalizarEdicion(JSON.parse(borrador), B); } catch {} aviso.remove(); trasCambio(); } } }, "Recuperar"),
      h("button.btn.chico", { on: { click: () => { try { localStorage.removeItem(clave); } catch {} api(`/api/proyecto/${slug}/borrador/${version}`, { json: { edicion: null } }).catch(() => {}); aviso.remove(); } } }, "Descartar"));
    estado.after(aviso);
  }
  if (sessionStorage.getItem("insertar")) toast("Elige el momento con el cabezal y haz clic en el archivo, o arrástralo a la pista B-roll");

  return () => {
    vivo = false; ro.disconnect(); master.pause(); recorte?.pause();
    removeEventListener("keydown", teclas); removeEventListener("beforeunload", antesDeSalir);
    if (sucio) toast("Los cambios sin guardar quedan como borrador en esta versión.");
  };
}
