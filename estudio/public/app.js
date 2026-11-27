import { $, $$, accion, agentes, api, archivo, confirmar, cuandoTermine, dur, h, intentar, mb, md, modal, olvidarAgentes, pedirAgente, preguntar, seguir, tiempoRelativo, toast, verLog } from "./comun.js";
import { abrirEditor } from "./editor.js";
import { verLearner } from "./learner.js";
import { asistenteMarca, verMarca } from "./marca.js";
import { botonSinParadas, cajaSugerencias } from "./flujo-ui.js";

const principal = $("#principal");
let biblioteca = { items: {} };
let limpiar = null;

const TITULOS = { videos: "Videos", broll: "B-roll", inspiracion: "Inspiración y referentes", motion: "Motion graphics", audio: "Música y SFX" };
const AYUDAS = {
  videos: "Grabaciones crudas y clips de entrada. Crea un proyecto a partir de cualquiera.",
  broll: "Tomas propias y descargadas (con licencia). Descríbelas con IA para encontrarlas por lo que muestran.",
  inspiracion: "Referentes: reels de otros y tus propios reels. Úsalos como referencia de un proyecto.",
  motion: "Animaciones reutilizables (MOV/WebM con transparencia o imágenes) y el catálogo de bloques de HyperFrames.",
  audio: "Música y efectos con licencia clara (regístrala en LICENCIAS.md de tu perfil de marca).",
};

async function cargarBiblioteca() {
  biblioteca = await api("/api/biblioteca");
  const cuenta = {};
  for (const it of Object.values(biblioteca.items)) cuenta[it.tipo] = (cuenta[it.tipo] ?? 0) + 1;
  $$("[data-n]").forEach((e) => (e.textContent = cuenta[e.dataset.n] ?? ""));
  return biblioteca;
}
export const bibliotecaActual = () => biblioteca;
export { cargarBiblioteca };

// ---------- router ----------
async function enrutar() {
  limpiar?.(); limpiar = null;
  const partes = (location.hash.slice(2) || "proyectos").split("/").map(decodeURIComponent);
  const sec = partes[0] === "biblioteca" ? partes[1] : partes[0];
  $$(".nav").forEach((n) => n.classList.toggle("activo", n.dataset.sec === sec || (sec === "proyecto" && n.dataset.sec === "proyectos")));
  principal.scrollTop = 0;
  try {
    if (partes[0] === "proyecto") await verProyecto(partes[1], partes[2]);
    else if (partes[0] === "editor") limpiar = await abrirEditor(principal, partes[1], partes[2]);
    else if (partes[0] === "biblioteca") await verBiblioteca(partes[1], partes.slice(2).join("/"));
    else if (partes[0] === "learner") await verLearner(principal, biblioteca);
    else if (partes[0] === "marca" && partes[1] === "nueva") await asistenteMarca(principal, partes[2], pintarPerfilActivo);
    else if (partes[0] === "marca") await verMarca(principal, partes[1], pintarPerfilActivo);
    else if (partes[0] === "agentes") await verAgentes();
    else if (partes[0] === "cuentas") await verCuentas();
    else await verProyectos();
  } catch (e) {
    principal.replaceChildren(h("div.pagina", h("div.vacio", "✗ ", e.message)));
  }
}
window.addEventListener("hashchange", enrutar);
$("#abrir-chat")?.addEventListener("click", () => { const m = /^#\/(?:editor|proyecto)\/([^/]+)/.exec(location.hash); pedirAgente({ tarea: m ? "corregir" : "libre", slug: m?.[1] && decodeURIComponent(m[1]) }); });
cuandoTermine((t) => {
  if (t.meta?.tarea === "aprender") { cargarBiblioteca(); if (location.hash.startsWith("#/learner")) enrutar(); }
  else if (["indexar"].includes(t.meta?.accion) || t.meta?.tarea === "describir") cargarBiblioteca().then(() => location.hash.startsWith("#/biblioteca") && enrutar());
  else if (location.hash.startsWith("#/proyecto")) enrutar();
});

// ---------- Proyectos ----------
const ETAPAS = [["entrada", "Clip"], ["analisis", "Referencia"], ["plan", "Plan"], ["plan_aprobado", "Aprobado"], ["versiones", "Edición"], ["final", "Render"]];
function miniDe(p) {
  const it = Object.values(biblioteca.items).find((i) => i.ruta === p.etapas.clip);
  return it?.miniatura ? `url("${archivo(it.miniatura)}")` : "none";
}
async function continuar(p) {
  const { accion: paso } = p.siguiente, slug = p.slug;
  if (paso === "preview") { await accion({ accion: "preview", slug, version: p.etapas.ultima }, { abrir: true }); location.hash = `#/proyecto/${slug}/resumen`; return; }
  if (paso.startsWith("accion:")) return accion({ accion: paso.slice(7), slug, version: p.etapas.ultima }, { abrir: true });
  if (paso.startsWith("agente:")) return pedirAgente({ tarea: paso.slice(7), slug, version: p.etapas.ultima });
  location.hash = paso === "editor" ? `#/editor/${slug}/${p.etapas.ultima}` : `#/proyecto/${slug}/${paso === "plan" ? "plan" : paso === "entrega" ? "versiones" : "resumen"}`;
}
async function verProyectos() {
  const [lista, perfiles] = await Promise.all([api("/api/proyectos"), api("/api/perfiles").catch(() => [])]);
  const deEjemplo = perfiles.find((p) => p.activo)?.id === "ejemplo";
  const pendientes = lista.filter(p => !p.etapas.final_actual);
  const destacados = pendientes[0];
  const buscar = h("input", { type: "search", placeholder: "Buscar un reel…", "aria-label": "Buscar proyectos" });
  const filtro = h("select", { "aria-label": "Filtrar proyectos" }, [["todos", "Todos los proyectos"], ["pendientes", "Con cambios pendientes"], ["entregados", "Última versión entregada"]].map(([value,text]) => h("option", {value}, text)));
  const rejilla = h("div.proyectos");
  const pintar = () => {
    const visibles = lista.filter(p => p.tema.toLowerCase().includes(buscar.value.toLowerCase()) && (filtro.value === "todos" || (filtro.value === "entregados" ? p.etapas.final_actual : !p.etapas.final_actual)));
    rejilla.replaceChildren(...visibles.map(p => {
      const e = p.etapas;
      return h("article.proy",
        h("a.mini", { href: `#/proyecto/${p.slug}`, "aria-label": `Abrir proyecto ${p.tema}`, style: { backgroundImage: miniDe(p) } },
          miniDe(p) === "none" && h("span.mini-inicial", p.tema.slice(0,1).toUpperCase()),
          h("div.estado", h("span.pill", { class: e.final_actual ? "ok" : "aviso" }, e.final_actual ? "Entregado" : e.entregada ? "Cambios pendientes" : "En preparación"))),
        h("div.cuerpo", h("div.fila", h("span.eyebrow", e.formato === "libre" ? "REEL" : e.formato), h("span.pill", { title: "Perfil de marca de este reel" }, p.perfil?.nombre ?? ""), h("div.espacio"), h("span.tenue", p.fecha)),
          h("h3", h("a", { href: `#/proyecto/${p.slug}` }, p.tema)),
          h("div.versiones-resumen", h("span", `Edición ${e.ultima ?? "por crear"}`), h("span.tenue", e.entregada ? `Entrega ${e.entregada}` : "Sin entrega todavía")),
          h("div.card-next", p.siguiente.detalle),
          h("div.fila", h("button.btn", { on: { click: intentar(() => continuar(p)) } }, p.siguiente.texto, " →"),
            h("a.btn.chico", { href: `#/proyecto/${p.slug}` }, "Detalles"))));
    }));
    if (!visibles.length) rejilla.append(h("div.vacio", lista.length ? "No hay reels con este filtro." : "Tu próximo reel empieza aquí. Sube el clip y elige uno de tus formatos.", !lista.length && h("button.btn.prim", { on: { click: nuevoProyecto } }, "Crear mi primer reel")));
  };
  buscar.oninput = pintar; filtro.onchange = pintar; pintar();
  principal.replaceChildren(h("div.pagina.dashboard",
    h("div.cabecera", h("div", h("div.eyebrow", "TU MESA DE EDICIÓN"), h("h1", "Tus reels, en marcha."), h("p.tenue", "De tu clip a una entrega con tu estilo.")), h("div.espacio"), h("button.btn.prim", { on: { click: nuevoProyecto } }, "+ Nuevo reel")),
    h("div.resumen-estudio", h("div", h("strong", String(pendientes.length)), h("span", "por continuar")), h("div", h("strong", String(lista.filter(p=>p.etapas.final_actual).length)), h("span", "al día")), h("div", h("strong", String(lista.length)), h("span", "proyectos"))),
    deEjemplo && h("section.continuar", h("div", h("div.eyebrow", "PRIMERO, TU MARCA"), h("h2", "Estás usando la marca de ejemplo"), h("p", "Crea la tuya en unos 5 minutos: nombre, fuente, colores y estilo de subtítulos. Tus reels nuevos la usarán.")),
      h("a.btn.prim", { href: "#/marca/nueva" }, "Crear mi marca →")),
    destacados && h("section.continuar", h("div", h("div.eyebrow", "SIGUIENTE EN TU MESA"), h("h2", destacados.tema), h("p", destacados.siguiente.detalle)), h("button.btn.prim", { on: { click: intentar(() => continuar(destacados)) } }, destacados.siguiente.texto, " →")),
    h("div.filtros", h("h2", "Proyectos"), h("div.espacio"), buscar, filtro), rejilla));
}

async function nuevoProyecto() {
  const [formatos, perfiles] = await Promise.all([api("/api/formatos"), api("/api/perfiles")]);
  const perfil = h("select", perfiles.map((p) => h("option", { value: p.id, selected: p.activo }, p.nombre)));
  const formato = h("select", Object.entries(formatos).map(([value, f]) => h("option", { value }, f.nombre)));
  const ayudaFormato = h("p.tenue", formatos.libre.descripcion);
  formato.onchange = () => (ayudaFormato.textContent = formatos[formato.value].descripcion);
  const tema = h("input", { type: "text", placeholder: "ej.: errores al lanzar una tienda" });
  const clip = h("input", { type: "file", accept: "video/*" });
  const ref = h("input", { type: "file", accept: "video/*,image/*", multiple: true });
  const desdeBib = h("select", h("option", { value: "" }, "— o elige un video de la biblioteca —"),
    Object.values(biblioteca.items).filter((i) => i.clase === "video" && i.tipo === "videos").map((i) => h("option", { value: i.ruta }, i.nombre)));
  const refBib = h("select", h("option", { value: "" }, "— o elige un referente de la biblioteca —"),
    Object.values(biblioteca.items).filter((i) => i.tipo === "inspiracion").map((i) => h("option", { value: i.ruta }, `${i.nombre} (${i.origen})`)));
  const estado = h("div.tenue");
  let creado = null;
  const crear = h("button.btn.prim", { on: { click: intentar(async () => {
    if (!clip.files[0] && !desdeBib.value) throw new Error("falta el clip");
    crear.disabled = true;
    try {
      const { slug } = creado ??= await api("/api/proyecto/nuevo", { json: { tema: tema.value, formato: formato.value, perfil: perfil.value } });
      const subirA = async (f, destino) => {
        estado.textContent = `Subiendo ${f.name} (${mb(f.size)})…`;
        const r = await fetch(`/api/subir?slug=${slug}&destino=${destino}&nombre=${encodeURIComponent(f.name)}`, { method: "POST", body: f });
        if (!r.ok) throw new Error((await r.json()).error);
      };
      const previo = await api(`/api/proyecto/${slug}`);
      if (!previo.etapas.entrada && clip.files[0]) await subirA(clip.files[0], "entrada");
      else if (!previo.etapas.entrada) await api(`/api/proyecto/${slug}/entrada-desde`, { json: { ruta: desdeBib.value } });
      for (const f of ref.files) await subirA(f, "referencia");
      if (refBib.value) await api(`/api/proyecto/${slug}/entrada-desde`, { json: { ruta: refBib.value, destino: "referencia" } });
      m.cerrar(); toast("Proyecto creado");
      location.hash = `#/proyecto/${slug}`;
    } finally { crear.disabled = false; }
  }) } }, "Crear proyecto");
  const m = modal("Nuevo reel", h("p.tenue", "Elige el formato. Después prepararemos la transcripción y tu primera propuesta."), h("label.campo", "Tema", tema), h("label.campo", "Marca (perfil)", perfil), h("label.campo", "Formato de edición", formato), ayudaFormato, h("label.campo", "Clip ya cortado (entrada, solo lectura después)", clip, desdeBib),
    h("label.campo", "Referencia de este video", ref, refBib), estado, h("div.fila", h("div.espacio"), crear));
  tema.focus();
}

async function verProyecto(slug, pestaña = "resumen") {
  const p = await api(`/api/proyecto/${slug}`);
  const e = p.etapas;
  // Sin paradas: el servidor avanza solo; la página se refresca mientras siga en marcha.
  if (e.sin_paradas?.activo) setTimeout(() => { if (location.hash.startsWith(`#/proyecto/${slug}`)) enrutar(); }, 5000);
  const vs = p.versiones.map((v) => v.v);
  const ultima = p.versiones.at(-1);
  const tabs = [["resumen", "Resumen"], ["plan", "Plan"], ["referencia", "Referencia"], ["versiones", `Versiones (${vs.length})`]];
  const ir = (t) => (location.hash = `#/proyecto/${slug}/${t}`);
  const agente = (tarea, extra = {}) => pedirAgente({ tarea, slug, versiones: vs, version: ultima?.v, ...extra });
  const subirPendiente = h("input", { type: "file", accept: "video/*", "aria-label": "Subir clip pendiente" });
  subirPendiente.onchange = intentar(async () => {
    const f = subirPendiente.files[0]; if (!f) return;
    subirPendiente.disabled = true;
    try {
      const r = await fetch(`/api/subir?slug=${slug}&destino=entrada&nombre=${encodeURIComponent(f.name)}`, { method: "POST", body: f });
      if (!r.ok) throw new Error((await r.json()).error);
      toast("Clip recibido. Ya puedes prepararlo."); await enrutar();
    } finally { subirPendiente.disabled = false; }
  });
  let cuerpo;

  if (pestaña === "resumen") {
    const paso = (ok, ahora, titulo, detalle, ...botones) => h("div.paso", { class: ok ? "ok" : ahora ? "ahora" : "" }, h("div.ico", ok ? "✔" : ahora ? "●" : ""), h("div", h("b", titulo), h("div.tenue", detalle)), h("div.espacio"), ...botones);
    const sig = p.siguiente.texto;
    cuerpo = h("div.dos",
      h("div.pasos",
        paso(e.entrada, !e.entrada, "Clip de entrada", e.clip ? "Original guardado" : "Añade tu grabación ya cortada", !e.entrada && subirPendiente),
        paso(e.transcripcion, !e.transcripcion && e.entrada, "Transcripción", e.transcripcion ? "Tu voz está lista para crear subtítulos" : "Prepara el clip antes de pedir una edición",
          !e.transcripcion && e.entrada && h("button.btn.chico.prim", { on: { click: intentar(() => accion({ accion: "preparar", slug }, { abrir: true })) } }, "Preparar clip")),
        paso(e.analisis, sig === "Analizar referencia", "Análisis de la referencia", e.referencia ? `${e.refs.length} archivo(s) en referencia/` : "Sin referencia (opcional)",
          e.referencia && h("button.btn.chico", { on: { click: intentar(() => accion({ accion: "analizar", slug }, { abrir: true })) } }, "Fotogramas y cortes"),
          e.referencia && h("button.btn.chico", { on: { click: () => agente("referencia") } }, "🤖 Analizar")),
        paso(e.plan, sig === "Crear plan", "Plan de edición", e.plan ? "plan-edicion.md" : "Un agente propone el gancho, la estructura, B-roll y zooms",
          h("button.btn.chico", { on: { click: () => agente("plan") } }, e.plan ? "🤖 Rehacer" : "🤖 Crear plan"), e.plan && h("button.btn.chico", { on: { click: () => ir("plan") } }, "Ver")),
        paso(e.plan_aprobado, sig === "Aprobar plan", "Aprobación del plan", e.plan_aprobado ? "Aprobado" : "Checkpoint: apruébalo antes de componer",
          e.plan && !e.plan_aprobado && h("button.btn.chico.prim", { on: { click: intentar(async () => { await api(`/api/proyecto/${slug}/aprobar`, { json: { que: "plan" } }); enrutar(); }) } }, "Aprobar plan")),
        paso(e.versiones > 0, sig === "Proponer edición" || sig === "Pasar a edicion.json", "Edición", e.versiones ? `${e.versiones} versiones · última ${e.ultima}${e.editable ? "" : " (hecha con script antiguo)"}` : "Aún no hay composición",
          h("button.btn.chico", { on: { click: () => agente("proponer") } }, "🤖 Proponer edición"),
          e.versiones > 0 && !e.editable && h("button.btn.chico", { on: { click: intentar(() => accion({ accion: "migrar", slug, version: e.ultima }, { abrir: true })) } }, "Pasar a edicion.json"),
          e.versiones > 0 && h("button.btn.chico.prim", { on: { click: () => (location.hash = `#/editor/${slug}/${e.ultima}`) } }, "✎ Editor")),
        ...(e.versiones > 0 && e.editable ? (() => {
          const r = e.rev ?? {}, v = e.ultima;
          return [
            paso(r.validada, p.siguiente.accion === "accion:validar", `Validación de ${v}`, r.validada ? "Zona segura, solapes y subtítulos: todo pasa" : "Revisa zona segura, solapes y duración de subtítulos",
              !r.validada && h("button.btn.chico.prim", { on: { click: intentar(() => accion({ accion: "validar", slug, version: v }, { abrir: true })) } }, "Validar")),
            paso(r.retencion, p.siguiente.accion === "agente:retencion", "Revisión de retención", r.retencion ? (r.sugerencias ? `${r.sugerencias} sugerencia(s) por decidir (pestaña Versiones)` : "Hecha") : "Un agente revisa si retiene antes de que la veas",
              !r.retencion && h("button.btn.chico", { disabled: !r.validada, on: { click: () => agente("retencion", { version: v }) } }, "🤖 Revisar retención")),
            paso(r.aprobada, p.siguiente.accion === "preview", "Vista previa y aprobación", r.aprobada ? (r.auto ? "Aprobada por el modo sin paradas" : "Aprobaste esta versión") : "Checkpoint: mírala y apruébala para exportar",
              h("button.btn.chico", { disabled: !r.retencion, on: { click: intentar(() => accion({ accion: "preview", slug, version: v }, { abrir: true })) } }, "▶ Vista previa"),
              !r.aprobada && h("button.btn.chico.prim", { disabled: !r.validada || !r.retencion, title: "Abre la vista previa antes de aprobar", on: { click: intentar(async () => { await api(`/api/proyecto/${slug}/aprobar`, { json: { que: "preview", version: v } }); toast(`${v} aprobada`); enrutar(); }) } }, "Aprobar")),
          ];
        })() : []),
        paso(e.final_actual, false, "Entrega", e.final_actual ? `Última edición ${e.ultima} entregada` : e.entregada ? `Entregaste ${e.entregada}; ${e.ultima} sigue pendiente` : "Sin entrega todavía", e.final && h("button.btn.chico", { on: { click: () => ir("versiones") } }, "Ver"))),
      h("div", { style: { display: "grid", gap: "12px" } },
        e.final ? h("div", h("p.tenue", `Última entrega · ${e.entregada}`), h("video.player", { src: archivo(e.final), controls: true, preload: "metadata" })) : e.clip ? h("video.player", { src: archivo(e.clip), controls: true, preload: "metadata" }) : null,
        h("button.btn", { on: { click: () => agente("corregir") } }, "🤖 Pedir correcciones a un agente"),
        h("button.btn", { on: { click: () => agente("libre", { tareas: ["libre"] }) } }, "🤖 Instrucción libre")));
  } else if (pestaña === "plan") {
    cuerpo = h("div.caja", p.plan ? h("div.md", { html: md(p.plan) }) : h("div.vacio", "Aún no hay plan.", h("br"), h("button.btn", { style: { marginTop: "10px" }, on: { click: () => agente("plan") } }, "🤖 Crear plan")),
      p.plan && h("div.fila", { style: { marginTop: "14px" } }, h("div.espacio"), h("button.btn", { on: { click: () => agente("plan") } }, "🤖 Rehacer con indicaciones"),
        e.plan_aprobado ? h("span.ok-txt", "✔ Aprobado") : h("button.btn.prim", { on: { click: intentar(async () => { await api(`/api/proyecto/${slug}/aprobar`, { json: { que: "plan" } }); enrutar(); }) } }, "Aprobar plan")));
  } else if (pestaña === "referencia") {
    cuerpo = h("div.dos",
      h("div.caja", p.analisis ? h("div.md", { html: md(p.analisis) }) : h("div.vacio", "Sin análisis todavía."),
        p.resumen && h("div.tenue", { style: { marginTop: "12px" } }, `Referencia: ${p.resumen.referencia?.duracion?.toFixed?.(1) ?? "?"} s · ${p.resumen.referencia?.cortes?.length ?? "?"} cortes`)),
      h("div.hojas", e.refs.filter((r) => /\.(mp4|mov|webm|m4v)$/i.test(r)).map((r) => h("video.player", { src: archivo(r), controls: true, preload: "metadata", style: { marginBottom: "10px" } })),
        p.hojasRef.map((r) => h("img", { src: archivo(r), loading: "lazy" }))));
  } else {
    cuerpo = h("div", { style: { display: "grid", gap: "14px" } }, p.versiones.slice().reverse().map((v) => h("div.caja",
      h("div.fila", h("h3", { style: { margin: 0 } }, v.v), h("span.chip", v.final ? "Entregada" : v.revision.aprobada ? "Aprobada" : v.revision.validada ? "Validada" : "En revisión"),
        v.meta?.createdAt && h("span.tenue", tiempoRelativo(v.meta.createdAt)), v.meta?.desde && h("span.tenue", `desde ${v.meta.desde}`), h("div.espacio"),
        v.edicion ? h("button.btn.chico.prim", { on: { click: () => (location.hash = `#/editor/${slug}/${v.v}`) } }, "✎ Editar") :
          h("button.btn.chico", { on: { click: intentar(() => accion({ accion: "migrar", slug, version: v.v }, { abrir: true })) } }, "Pasar a edicion.json"),
        h("button.btn.chico", { on: { click: intentar(() => accion({ accion: "preview", slug, version: v.v }, { abrir: true })) } }, "▶ Vista previa"),
        h("button.btn.chico", { on: { click: () => agente("retencion", { version: v.v }) } }, "🤖 Retención"),
        !v.final && h("button.btn.chico", { on: { click: intentar(() => accion({ accion: "validar", slug, version: v.v }, { abrir: true })) } }, "Validar"),
        !v.final && !v.revision.aprobada && h("button.btn.chico", { disabled: !v.revision.validada || !v.revision.retencion, title: "Primero valida y revisa la retención. Después mira la vista previa y aprueba esta versión.", on: { click: intentar(async () => { await api(`/api/proyecto/${slug}/aprobar`, { json: { que: "preview", version: v.v } }); enrutar(); }) } }, "Aprobar vista previa"),
        v.final && h("a.btn.chico", { href: archivo(v.final), download: `${slug}-${v.v}.mp4` }, "Descargar"),
        v.render && !v.final && h("button.btn.chico", { on: { click: intentar(() => accion({ accion: "qa", slug, version: v.v }, { abrir: true })) } }, "Completar audio y QA"),
        !v.render && h("button.btn.chico", { disabled: !v.revision.aprobada, title: "Requiere la vista previa aprobada de esta versión", on: { click: intentar(() => accion({ accion: "render", slug, version: v.v }, { abrir: true })) } }, "Exportar")),
      h("div.dos", { style: { marginTop: "12px" } },
        h("div", v.validacion && h("details", h("summary", (v.validacion.match(/Pasa \d+ de \d+/) ?? ["Validación"])[0]), h("div.md", { html: md(v.validacion) })),
          v.retencion && h("details", h("summary", "Revisión de retención"), h("div.md", { html: md(v.retencion) })),
          cajaSugerencias({ slug, version: v.v, datos: v.retencion_datos, decididas: v.decididas, alHacer: enrutar }),
          v.qa && h("details", h("summary", "QA"), h("div.md", { html: md(v.qa) })),
          v.hojas.length > 0 && h("details", h("summary", `Hojas de QA (${v.hojas.length})`), h("div.hojas", v.hojas.map((r) => h("img", { src: archivo(r), loading: "lazy" }))))),
        v.final || v.render ? h("video.player", { src: archivo(v.final ?? v.render), controls: true, preload: "metadata" }) : h("div.tenue", "Sin render")))));
  }
  principal.replaceChildren(h("div.pagina",
    h("div.cabecera", h("a.btn.chico", { href: "#/proyectos" }, "← Proyectos"), h("h1", { style: { textTransform: "capitalize" } }, slug.slice(11).replace(/-/g, " ")), h("span.sub", slug.slice(0, 10)), h("span.pill", { title: "Perfil de marca de este reel (reel.json)" }, `🎨 ${p.perfil?.nombre ?? ""}`), h("div.espacio"),
      e.versiones > 0 && h("button.btn.prim", { on: { click: () => (location.hash = `#/editor/${slug}/${e.ultima}`) } }, "✎ Abrir editor")),
    h("div.tabs", tabs.map(([k, n]) => h("button.tab", { class: k === pestaña ? "activo" : "", on: { click: () => ir(k) } }, n))),
    pestaña === "resumen" && h("section.continuar.compacta", h("div", h("div.eyebrow", "TU SIGUIENTE PASO"), h("h2", p.siguiente.texto), h("p", p.siguiente.detalle), botonSinParadas(slug, e.sin_paradas, enrutar)), e.sin_paradas?.activo ? h("span.tenue", "El Estudio sigue solo…") : h("button.btn.prim", { on: { click: intentar(() => continuar(p)) } }, "Continuar →")),
    cuerpo));
}

// ---------- Biblioteca ----------
const filtro = { q: "", etiqueta: null, origen: "", favoritos: false };
// Carpetas: virtuales (campo "carpeta" del índice). Los archivos no se mueven en disco.
const rutaBib = (tipo, carpeta) => `#/biblioteca/${tipo}${carpeta ? "/" + carpeta.split("/").map(encodeURIComponent).join("/") : ""}`;
const seleccion = new Set();
async function moverA(ids, carpeta) {
  if (!ids.length) return;
  await api("/api/biblioteca/mover", { json: { ids, carpeta } });
  toast(`${ids.length === 1 ? "Movido" : `${ids.length} movidos`} a ${carpeta || "la raíz"}`);
  seleccion.clear();
  await cargarBiblioteca(); enrutar();
}
// Cualquier elemento puede recibir tarjetas arrastradas (una o la selección entera).
function destino(el, carpeta) {
  el.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("application/x-item")) { e.preventDefault(); el.classList.add("encima"); } });
  el.addEventListener("dragleave", () => el.classList.remove("encima"));
  el.addEventListener("drop", (e) => {
    const id = e.dataTransfer.getData("application/x-item"); if (!id) return;
    e.preventDefault(); el.classList.remove("encima");
    intentar(moverA)(seleccion.has(id) ? [...seleccion] : [id], carpeta);
  });
  return el;
}

async function verBiblioteca(tipo, carpeta = "") {
  if (!TITULOS[tipo]) throw new Error("sección desconocida");
  await cargarBiblioteca();
  const arbol = (await api("/api/carpetas"))[tipo] ?? [];
  const delTipo = Object.values(biblioteca.items).filter((i) => i.tipo === tipo).sort((a, b) => (b.favorito - a.favorito) || b.agregado.localeCompare(a.agregado));
  const dentro = (i, c) => !c || i.carpeta === c || (i.carpeta ?? "").startsWith(c + "/");
  const aqui = delTipo.filter((i) => (i.carpeta ?? "") === carpeta);
  const subcarpetas = arbol.filter((c) => c.split("/").slice(0, -1).join("/") === carpeta);
  const conteo = {};
  delTipo.filter((i) => dentro(i, carpeta)).forEach((i) => i.etiquetas.forEach((t) => (conteo[t] = (conteo[t] ?? 0) + 1)));
  const origenes = [...new Set(delTipo.map((i) => i.origen))];
  seleccion.clear();

  // ---------- migas ----------
  const partes = carpeta ? carpeta.split("/") : [];
  const migas = h("div.migas",
    destino(h("a.miga", { href: rutaBib(tipo, "") }, TITULOS[tipo]), ""),
    partes.map((p, n) => { const ruta = partes.slice(0, n + 1).join("/"); return [h("span.tenue", "›"), destino(h("a.miga", { href: rutaBib(tipo, ruta), class: n === partes.length - 1 ? "actual" : "" }, p), ruta)]; }));

  // ---------- acciones de carpeta ----------
  const cambiar = (datos) => intentar(async () => { await api("/api/carpetas", { json: { tipo, ...datos } }); await cargarBiblioteca(); })();
  const nueva = intentar(async () => {
    const n = await preguntar(carpeta ? `Nueva carpeta dentro de «${partes.at(-1)}»` : "Nueva carpeta"); if (!n) return;
    await cambiar({ accion: "crear", ruta: carpeta ? `${carpeta}/${n}` : n }); enrutar();
  });
  const renombrar = intentar(async () => {
    const n = await preguntar("Nuevo nombre", partes.at(-1)); if (!n || n === partes.at(-1)) return;
    const nuevaRuta = [...partes.slice(0, -1), n].join("/");
    await cambiar({ accion: "renombrar", ruta: carpeta, nueva: nuevaRuta }); location.hash = rutaBib(tipo, nuevaRuta);
  });
  const borrar = intentar(async () => {
    const n = delTipo.filter((i) => dentro(i, carpeta)).length;
    if (!(await confirmar(`¿Quitar la carpeta «${partes.at(-1)}»? ${n ? `Sus ${n} archivos pasan a la carpeta de arriba; ` : ""}ningún archivo se borra.`, { si: "Quitar carpeta" }))) return;
    await cambiar({ accion: "borrar", ruta: carpeta }); location.hash = rutaBib(tipo, partes.slice(0, -1).join("/"));
  });

  // ---------- carpetas (con collage de lo que tienen dentro) ----------
  const tarjetaCarpeta = (c) => {
    const items = delTipo.filter((i) => dentro(i, c));
    const minis = items.filter((i) => i.miniatura).slice(0, 4);
    const hijas = arbol.filter((x) => x.startsWith(c + "/") && x.split("/").length === c.split("/").length + 1).length;
    return destino(h("a.carpeta", { href: rutaBib(tipo, c), title: "Abrir · arrastra aquí archivos para moverlos" },
      h("div.collage", { class: `n${minis.length}` }, minis.length ? minis.map((i) => h("div", { style: { backgroundImage: `url("${archivo(i.miniatura)}")` } })) : h("div.vacia", "📁")),
      h("div.info", h("div.nombre", "📁 ", c.split("/").at(-1)), h("div.tags", [items.length ? `${items.length} archivo${items.length === 1 ? "" : "s"}` : "vacía", hijas && `${hijas} carpeta${hijas === 1 ? "" : "s"}`].filter(Boolean).join(" · ")))), c);
  };

  // ---------- archivos ----------
  const rejilla = h("div.rejilla");
  const barraSel = h("div.barra-sel");
  const buscar = h("input", { type: "search", placeholder: carpeta ? `Buscar en «${partes.at(-1)}» y sus carpetas…` : "Buscar por nombre, etiqueta, carpeta o descripción…", value: filtro.q });
  const selOrigen = h("select", h("option", { value: "" }, "Todos los orígenes"), origenes.map((o) => h("option", { value: o, selected: o === filtro.origen }, o)));
  const fav = h("button.chip", { class: filtro.favoritos ? "on" : "" }, "★ Favoritos");
  const filtrando = () => filtro.q || filtro.etiqueta || filtro.origen || filtro.favoritos;
  const pintarSel = () => {
    $$(".item", rejilla).forEach((el) => el.classList.toggle("sel", seleccion.has(el.dataset.id)));
    if (!seleccion.size) return barraSel.replaceChildren();
    const mover = h("select", h("option", { value: "" }, `Mover ${seleccion.size} a…`), h("option", { value: "/" }, `${TITULOS[tipo]} (raíz)`), arbol.map((c) => h("option", { value: c }, c.split("/").join(" › "))));
    mover.onchange = () => mover.value && intentar(moverA)([...seleccion], mover.value === "/" ? "" : mover.value);
    barraSel.replaceChildren(h("b", `${seleccion.size} seleccionado${seleccion.size === 1 ? "" : "s"}`), mover,
      h("button.btn.chico", { on: { click: () => { seleccion.clear(); pintarSel(); } } }, "Quitar selección"),
      h("span.tenue", "Ctrl+clic para elegir varios · arrástralos a una carpeta"));
  };
  const pintar = () => {
    const q = filtro.q.toLowerCase().split(/\s+/).filter(Boolean);
    // Al buscar o filtrar se busca dentro de esta carpeta y todas sus subcarpetas.
    const base = filtrando() ? delTipo.filter((i) => dentro(i, carpeta)) : aqui;
    const vis = base.filter((i) => (!filtro.etiqueta || i.etiquetas.includes(filtro.etiqueta)) && (!filtro.origen || i.origen === filtro.origen) && (!filtro.favoritos || i.favorito) &&
      q.every((w) => `${i.nombre} ${i.etiquetas.join(" ")} ${i.descripcion} ${i.carpeta ?? ""}`.toLowerCase().includes(w)));
    const tarjetas = vis.map((i) => {
      const el = tarjetaItem(i, (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) { seleccion.has(i.id) ? seleccion.delete(i.id) : seleccion.add(i.id); return pintarSel(); }
        detalleItem(i, arbol);
      }, { arrastrable: true });
      el.dataset.id = i.id;
      if (filtrando() && (i.carpeta ?? "") !== carpeta) $(".tags", el).prepend(h("span.en-carpeta", `📁 ${i.carpeta || TITULOS[tipo]}`), " ");
      return el;
    });
    const carpetasVis = filtrando() ? [] : subcarpetas.map(tarjetaCarpeta);
    rejilla.replaceChildren(...carpetasVis, ...tarjetas);
    if (!carpetasVis.length && !tarjetas.length) rejilla.append(h("div.vacio", { style: { gridColumn: "1/-1" } },
      filtrando() ? "Nada coincide con el filtro." : carpeta ? "Carpeta vacía. Arrastra aquí archivos desde tu computador o tarjetas desde otra carpeta." : "Aún no hay nada aquí. Arrastra archivos arriba."));
    pintarSel();
  };
  buscar.oninput = () => { filtro.q = buscar.value; pintar(); };
  selOrigen.onchange = () => { filtro.origen = selOrigen.value; pintar(); };
  fav.onclick = () => { filtro.favoritos = !filtro.favoritos; fav.classList.toggle("on"); pintar(); };
  const chips = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([t, n]) =>
    h("span.chip", { class: filtro.etiqueta === t ? "on" : "", on: { click: () => { filtro.etiqueta = filtro.etiqueta === t ? null : t; $$(".etiquetas .chip").forEach((x) => x.classList.toggle("on", x.dataset.t === filtro.etiqueta)); pintar(); } }, "data-t": t }, t, h("span.tenue", n)));
  const entrada = h("input", { type: "file", multiple: true, style: { display: "none" }, on: { change: () => importar(tipo, entrada.files, carpeta) } });
  const soltar = h("div.soltar", { on: {
    dragover: (e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); soltar.classList.add("encima"); } }, dragleave: () => soltar.classList.remove("encima"),
    drop: (e) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); soltar.classList.remove("encima"); importar(tipo, e.dataTransfer.files, carpeta); }, click: () => entrada.click() } },
    "⬇ Arrastra aquí archivos para importarlos", carpeta ? ` a «${partes.at(-1)}»` : "", " — o haz clic para elegir", entrada);
  let catalogo = null;
  if (tipo === "motion" && !carpeta) catalogo = await vistaCatalogo();
  principal.replaceChildren(h("div.pagina",
    h("div.cabecera", h("h1", carpeta ? partes.at(-1) : TITULOS[tipo]), h("span.sub", `${delTipo.filter((i) => dentro(i, carpeta)).length} archivos`), h("div.espacio"),
      h("button.btn", { on: { click: nueva } }, "＋ Carpeta"),
      carpeta && h("button.btn", { on: { click: renombrar } }, "Renombrar"),
      carpeta && h("button.btn", { on: { click: borrar } }, "Quitar carpeta"),
      h("button.btn", { on: { click: intentar(() => accion({ accion: "indexar" }, { abrir: false })) } }, "↻ Reindexar"),
      tipo !== "audio" && h("button.btn", { on: { click: () => describirTodos(delTipo.filter((i) => dentro(i, carpeta))) } }, "🤖 Describir los que faltan")),
    migas,
    !carpeta && h("p.tenue", { style: { marginTop: "-4px" } }, AYUDAS[tipo], " Las carpetas ordenan la biblioteca sin mover los archivos de tus reels."),
    soltar, h("div.filtros", buscar, selOrigen, fav), h("div.etiquetas", chips), barraSel, rejilla,
    catalogo));
  pintar();
}

function tarjetaItem(i, alClic, { arrastrable = false } = {}) {
  const vista = h("div.vista", { style: { backgroundImage: i.miniatura ? `url("${archivo(i.miniatura)}")` : "none" } },
    i.duracion && i.clase !== "imagen" ? h("span.dur", dur(i.duracion)) : null, i.favorito ? h("span.fav", "★") : null);
  if (i.clase === "video") {
    let v;
    vista.addEventListener("mouseenter", () => { v = h("video", { src: archivo(i.ruta), muted: true, autoplay: true, loop: true, playsInline: true }); vista.append(v); });
    vista.addEventListener("mouseleave", () => { v?.remove(); v = null; });
  }
  const el = h("div.item", { draggable: arrastrable ? "true" : null, on: { click: alClic } }, vista,
    h("div.info", h("div.nombre", { title: i.nombre }, i.nombre), h("div.tags", i.descripcion || i.etiquetas.join(" · ") || i.origen)));
  if (arrastrable) el.addEventListener("dragstart", (e) => { e.dataTransfer.setData("application/x-item", i.id); e.dataTransfer.effectAllowed = "copyMove"; });
  return el;
}
export { tarjetaItem };

async function importar(tipo, archivos, carpeta = "") {
  for (const f of archivos) {
    toast(`Subiendo ${f.name}…`);
    const r = await fetch(`/api/subir?tipo=${tipo}&nombre=${encodeURIComponent(f.name)}&carpeta=${encodeURIComponent(carpeta)}`, { method: "POST", body: f });
    if (!r.ok) { toast((await r.json()).error, true); return; }
  }
  await accion({ accion: "indexar" });
}

async function describirTodos(items) {
  const faltan = items.filter((i) => !i.descripcion);
  if (!faltan.length) return toast("Todos tienen descripción.");
  toast(`Describiendo ${faltan.length}; uno a la vez (se encolan).`);
  const info = await agentes();
  const ag = info.config.por_tarea.describir || info.config.por_defecto;
  for (const i of faltan) {
    let t;
    for (;;) {
      try { t = await api("/api/agente", { json: { agente: ag, tarea: "describir", item: i.id } }); break; }
      catch (e) { if (!/ya hay un agente/.test(e.message)) return toast(e.message, true); await new Promise((r) => setTimeout(r, 3000)); }
    }
    seguir(t);
    await new Promise((ok) => { const quitar = cuandoTermine((x) => { if (x.id === t.id) { quitar(); ok(); } }); });
  }
}

function detalleItem(i, arbol = []) {
  $(".detalle")?.remove();
  const etiquetas = h("input", { type: "text", value: i.etiquetas.join(", ") });
  const desc = h("textarea", { rows: 3 }, i.descripcion);
  const lic = h("input", { type: "text", value: i.licencia ?? "", placeholder: "propia, CC0, comprada en…" });
  const fuente = h("input", { type: "text", value: i.fuente ?? "", placeholder: "URL o autor" });
  const tipo = h("select", Object.entries(TITULOS).map(([k, n]) => h("option", { value: k, selected: k === i.tipo }, n)));
  const carpeta = h("select", h("option", { value: "" }, "(raíz)"), [...new Set([...arbol, i.carpeta].filter(Boolean))].map((c) => h("option", { value: c, selected: c === i.carpeta }, c.split("/").join(" › "))));
  const guardar = intentar(async () => {
    await api(`/api/biblioteca/${i.id}`, { json: { etiquetas: etiquetas.value.split(","), descripcion: desc.value, licencia: lic.value, fuente: fuente.value, tipo: tipo.value, carpeta: tipo.value === i.tipo ? carpeta.value : "" } });
    toast("Guardado"); await cargarBiblioteca(); panel.remove(); enrutar();
  });
  const preview = i.clase === "video" ? h("video", { src: archivo(i.ruta), controls: true, preload: "metadata" }) : i.clase === "audio" ? h("audio", { src: archivo(i.ruta), controls: true, style: { width: "100%" } }) : h("img", { src: archivo(i.ruta) });
  const usar = h("select", h("option", { value: "" }, "Usar en el reel…"));
  api("/api/proyectos").then((ps) => ps.filter((p) => p.etapas.versiones).forEach((p) => usar.append(h("option", { value: `${p.slug}/${p.etapas.ultima}` }, p.tema))));
  usar.onchange = () => { if (usar.value) { sessionStorage.setItem("insertar", i.id); location.hash = `#/editor/${usar.value}`; panel.remove(); } };
  const panel = h("div.detalle",
    h("div.fila", h("b", { style: { wordBreak: "break-all" } }, i.nombre), h("div.espacio"), h("button.btn.chico", { on: { click: () => panel.remove() } }, "✕")),
    preview,
    h("div.tenue", [i.clase, i.ancho && `${i.ancho}×${i.alto}`, i.duracion && dur(i.duracion), i.fps && `${i.fps} fps`, i.alfa && "con transparencia", mb(i.tamano)].filter(Boolean).join(" · ")),
    h("div.tenue", { style: { wordBreak: "break-all", fontSize: "12px" } }, i.ruta),
    h("div.fila", h("button.btn.chico", { on: { click: intentar(async () => { await api(`/api/biblioteca/${i.id}`, { json: { favorito: !i.favorito } }); i.favorito = !i.favorito; toast(i.favorito ? "★ Favorito" : "Quitado de favoritos"); }) } }, i.favorito ? "★ Favorito" : "☆ Favorito"),
      h("button.btn.chico", { on: { click: () => pedirAgente({ tarea: "describir", item: i.id }) } }, "🤖 Describir con IA"), usar),
    h("label.campo", "Descripción", desc), h("label.campo", "Etiquetas (separadas por coma)", etiquetas),
    h("div.rejilla2", h("label.campo", "Sección", tipo), h("label.campo", "Carpeta", carpeta)), h("div.rejilla2", h("label.campo", "Licencia", lic), h("label.campo", "Fuente", fuente)),
    i.tipo === "videos" && h("button.btn", { on: { click: intentar(async () => {
      const tema = await preguntar("Tema del proyecto nuevo"); if (!tema) return;
      const { slug } = await api("/api/proyecto/nuevo", { json: { tema } });
      await api(`/api/proyecto/${slug}/entrada-desde`, { json: { ruta: i.ruta } });
      panel.remove(); location.hash = `#/proyecto/${slug}`;
    }) } }, "🎬 Crear proyecto con este video"),
    h("div.fila", h("div.espacio"), h("button.btn.prim", { on: { click: guardar } }, "Guardar")));
  document.body.append(panel);
}

async function vistaCatalogo() {
  const cat = await api("/api/catalogo-motion");
  const lista = Array.isArray(cat) ? cat : cat.items ?? [];
  if (!lista.length) return null;
  const q = h("input", { type: "search", placeholder: `Buscar en ${lista.length} bloques de HyperFrames (titles, captions, transitions…)` });
  const caja = h("div.catalogo");
  const pintar = () => {
    const w = q.value.toLowerCase().split(/\s+/).filter(Boolean);
    caja.replaceChildren(...lista.filter((b) => w.every((x) => `${b.name} ${b.title} ${b.description} ${(b.tags ?? []).join(" ")}`.toLowerCase().includes(x))).slice(0, 60)
      .map((b) => h("div.bloque", h("b", b.title ?? b.name), h("div.tenue", (b.description ?? "").slice(0, 160)), h("div.fila", { style: { marginTop: "6px" } },
        (b.tags ?? []).slice(0, 4).map((t) => h("span.chip", t)), h("div.espacio"),
        h("button.btn.chico", { title: "Copia una instrucción para pedírsela a un agente", on: { click: () => { navigator.clipboard?.writeText(`Usa el bloque "${b.name}" del catálogo de HyperFrames (npx hyperframes@0.9.5 add ${b.name})`); toast("Instrucción copiada: pégala en «Pedir al agente»"); } } }, "Usar")))));
  };
  q.oninput = pintar; pintar();
  return h("div", { style: { marginTop: "30px" } }, h("h2", "Catálogo de bloques HyperFrames"), h("p.tenue", "Bloques listos (títulos, transiciones, gráficos). Un agente puede instalarlos en una versión."), h("div.filtros", q), caja);
}

// ---------- Marca ----------
// Nombre del perfil activo en el menú lateral.
async function pintarPerfilActivo() {
  const p = (await api("/api/perfiles").catch(() => [])).find((x) => x.activo);
  const n = $('[data-sec="marca"]'); if (n && p) n.textContent = `🎨 Marca · ${p.nombre}`;
}
pintarPerfilActivo();

// La página Marca y el asistente de marca nueva viven en marca.js.

// ---------- Cuentas y modelos ----------
// Estado de cada agente (instalado, sesión), prueba real con el modelo y esfuerzo elegidos, y botón para iniciar sesión.
async function verCuentas() {
  olvidarAgentes();
  principal.replaceChildren(h("div.pagina", h("div.cabecera", h("h1", "Cuentas y modelos")), h("div.tenue", "Comprobando cada agente…")));
  const [info, lista] = await Promise.all([agentes(), api("/api/cuentas?forzar")]);
  const CAT = info.catalogo;
  const nombreE = (e) => CAT.nombres_esfuerzo?.[e] ?? e;
  const fila = (c) => {
    const A = CAT.agentes[c.id];
    const rec = CAT.recomendado?._todas?.[c.id] ?? { modelo: "", esfuerzo: "" };
    let modelo = A.modelos.some((m) => m.id === rec.modelo) ? rec.modelo : "", esfuerzo = rec.esfuerzo ?? "";
    const resultado = h("div.resultado-prueba");
    const pintarResultado = (r) => {
      if (!r) return resultado.replaceChildren();
      resultado.replaceChildren(h("div", { class: r.ok ? "ok-txt" : "error-txt" },
        r.ok ? `✔ Respondió en ${r.segundos} s con ${r.modelo || "su modelo configurado"}${r.esfuerzo ? ` · esfuerzo ${nombreE(r.esfuerzo).toLowerCase()}` : ""}` : `✗ ${r.diagnostico ? `${r.diagnostico.mensaje} ${r.diagnostico.arreglo}` : "No respondió bien."}`,
        r.confirmado ? h("span", { class: r.coincide ? "tenue" : "error-txt" }, ` · el CLI confirma ${r.confirmado}${r.coincide ? "" : " (¡no es el que pediste!)"}`) : r.ok ? h("span.tenue", " · este CLI no informa el modelo") : null),
        !r.ok && r.salida ? h("details", h("summary.tenue", "Detalles"), h("pre", r.salida)) : null);
    };
    const selM = h("select", A.modelos.map((m) => h("option", { value: m.id, selected: m.id === modelo }, `${m.id ? m.nombre : `El de tu configuración${A.por_defecto_cli?.modelo ? ` (${A.por_defecto_cli.modelo})` : ""}`}${m.no_disponible ? " · no disponible" : ""}`)));
    const selE = A.esfuerzos.length ? h("select", h("option", { value: "" }, "Esfuerzo de tu configuración"), A.esfuerzos.map((e) => h("option", { value: e, selected: e === esfuerzo }, `Esfuerzo ${nombreE(e).toLowerCase()}`))) : null;
    selM.onchange = () => (modelo = selM.value);
    if (selE) selE.onchange = () => (esfuerzo = selE.value);
    const probar = intentar(async (b) => {
      b.disabled = true; b.textContent = "Probando…";
      try { pintarResultado(await api(`/api/cuentas/${c.id}/probar`, { json: { modelo, esfuerzo } })); olvidarAgentes(); }
      finally { b.disabled = false; b.textContent = "Probar"; }
    });
    const conectar = intentar(async () => { const r = await api(`/api/cuentas/${c.id}/conectar`, { method: "POST" }); toast(`Se abrió una ventana con «${r.comando}». ${r.ayuda}`); });
    const ses = !c.instalado ? h("span.error-txt", "✗ no instalado") : c.sesion.ok ? h("span.ok-txt", `● ${c.sesion.detalle}`) : c.sesion.ok === false ? h("span.error-txt", `● ${c.sesion.detalle}`) : h("span.aviso-txt", `● ${c.sesion.detalle}`);
    pintarResultado(c.ultima_prueba);
    return h("div.caja.cuenta", { style: { display: "grid", gap: "8px" } },
      h("div.fila", h("b", c.nombre), h("span.tenue", c.version || ""), h("div.espacio"), ses),
      c.avisos.map((a) => h("div.aviso-txt", a)),
      c.instalado && h("div.fila", selM, selE ?? h("span.tenue", "sin esfuerzo ajustable"), h("button.btn.chico.prim", { on: { click: (e) => probar(e.currentTarget) } }, "Probar"),
        h("button.btn.chico", { on: { click: () => conectar() } }, c.sesion.ok ? "Volver a conectar" : "Conectar")),
      c.id === "gemini" && h("p.tenue", { style: { fontSize: "12px", margin: 0 } }, "Si tu cuenta personal de Google es rechazada: crea una clave en Google AI Studio, guárdala como variable de entorno GEMINI_API_KEY y reinicia el Estudio."),
      resultado);
  };
  principal.replaceChildren(h("div.pagina",
    h("div.cabecera", h("h1", "Cuentas y modelos"), h("span.sub", "Cada agente usa tu propia cuenta; el Estudio no guarda claves ni contraseñas"), h("div.espacio"),
      h("button.btn.chico", { on: { click: () => verCuentas() } }, "↻ Comprobar de nuevo")),
    h("div", { style: { display: "grid", gap: "14px", maxWidth: "820px" } }, lista.map(fila),
      h("p.tenue", { style: { fontSize: "12px" } }, "«Probar» manda un mensaje mínimo con el modelo y el esfuerzo elegidos (gasta muy pocos tokens). Si tu cuenta no tiene un modelo, queda marcado como «no disponible» en el chat hasta que lo pruebes de nuevo. La lista de modelos está en estudio/modelos.json."))));
}

// ---------- Agentes ----------
async function verAgentes() {
  olvidarAgentes();
  const info = await agentes();
  const lista = await api("/api/trabajos");
  const sel = (valor, alCambiar, conVacio) => {
    const s = h("select", conVacio && h("option", { value: "" }, "(el de por defecto)"), Object.entries(info.agentes).map(([id, a]) => h("option", { value: id, selected: id === valor, disabled: !a.instalado }, a.nombre)));
    s.onchange = () => alCambiar(s.value); return s;
  };
  const guardar = intentar(async (c) => { await api("/api/agentes/config", { json: c }); olvidarAgentes(); toast("Guardado"); });
  principal.replaceChildren(h("div.pagina",
    h("div.cabecera", h("h1", "Agentes"), h("span.sub", "Claude Code, Codex y Gemini trabajan con las mismas reglas del proyecto")),
    h("div.dos",
      h("div", { style: { display: "grid", gap: "14px" } },
        h("div.agentes-sel", Object.entries(info.agentes).map(([id, a]) => h("div.agente", { class: a.instalado ? "on" : "no" },
          h("b", a.nombre), h("div.tenue", a.instalado ? "✔ instalado" : "no encontrado en PATH"), h("div.tenue", { style: { fontSize: "12px" } }, a.skills ? "usa CLAUDE.md, skills y subagentes" : id === "codex" ? "lee AGENTS.md" : "lee GEMINI.md")))),
        h("div.caja", h("h3", { style: { marginTop: 0 } }, "Historial"),
          lista.length ? h("div", { style: { display: "grid", gap: "6px" } }, lista.map((t) => h("div.paso", { style: { cursor: "pointer" }, on: { click: () => verLog(t.id) } },
            h("div.ico", { style: { background: t.estado === "ok" ? "var(--ok)" : t.estado === "error" ? "var(--error)" : "var(--aviso)" } }, t.estado === "ok" ? "✔" : t.estado === "error" ? "✗" : "…"),
            h("div", h("b", t.titulo), h("div.tenue", `${tiempoRelativo(t.inicio)} · ${t.ultima ?? ""}`.slice(0, 140)))))) : h("div.tenue", "Aún no hay trabajos."))),
      h("div.caja", { style: { display: "grid", gap: "10px" } }, h("h3", { style: { margin: 0 } }, "Qué agente hace qué"),
        h("label.campo", "Por defecto", sel(info.config.por_defecto, (v) => guardar({ por_defecto: v }))),
        Object.entries(info.tareas).map(([k, t]) => h("label.campo", t.titulo, sel(info.config.por_tarea[k] ?? "", (v) => guardar({ por_tarea: { ...info.config.por_tarea, [k]: v || undefined } }), true))),
        h("p.tenue", { style: { fontSize: "12px" } }, "Cada agente usa la cuenta que ya tienes iniciada en tu computador; el Estudio no guarda claves. Solo trabaja un agente a la vez. Tras editar, el Estudio siempre genera la composición y revisa las reglas."),
        cajaAhorro(info, lista, guardar)))));
}

// Consumo de tokens de los últimos 7 días (solo informativo).
function cajaAhorro(info, lista, guardar) {
  const semana = lista.filter((t) => t.meta?.consumo && Date.now() - new Date(t.inicio) < 7 * 864e5);
  const suma = semana.reduce((a, t) => ({ tokens: a.tokens + t.meta.consumo.tokens, costo: a.costo + (t.meta.consumo.costo ?? 0), n: a.n + 1 }), { tokens: 0, costo: 0, n: 0 });
  const prom = suma.n ? Math.round(suma.tokens / suma.n) : 0;
  const k = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1e3)}k`);
  return h("div", { style: { display: "grid", gap: "10px", marginTop: "8px" } },
    h("h3", { style: { margin: "6px 0 0" } }, "Consumo"),
    h("div.fila.consumo-resumen", h("div", h("b", suma.n ? k(suma.tokens) : "—"), h("span.tenue", "tokens · 7 días")), h("div", h("b", suma.n ? k(prom) : "—"), h("span.tenue", "por pedido")),
      suma.costo ? h("div", h("b", "$" + suma.costo.toFixed(2)), h("span.tenue", "Claude · 7 días")) : null),
    h("p.tenue", { style: { fontSize: "12px", margin: 0 } }, "Solo informativo: los agentes trabajan con todas sus skills, herramientas y tu modelo de siempre."));
}


// ---------- arranque ----------
await cargarBiblioteca().catch(() => {});
api("/api/trabajos").then((ts) => ts.filter((t) => t.estado === "corriendo").forEach((t) => seguir(t)));
enrutar();
