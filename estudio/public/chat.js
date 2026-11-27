// Chat con los agentes: una conversación por proyecto (o Learner / Biblioteca / general).
// Cada pedido es un "turno": tu mensaje, lo que el agente dice, sus pasos resumidos y una tarjeta con el resultado.
import { $, $$, agentes, api, archivo, h, intentar, md, seguir, tiempoRelativo, toast } from "./comun.js";
import { cajaSugerencias } from "./flujo-ui.js";

const COLOR = { claude: "#d97757", codex: "#3fb68b", gemini: "#6b8cff" };
const LETRA = { claude: "C", codex: "X", gemini: "G" };
const SUGERENCIAS = {
  corregir: ["Sube un poco los subtítulos del gancho", "Quita el zoom y deja cortes secos", "Pon B-roll del gimnasio entre 20 y 24 s", "Divide este subtítulo en dos grupos"],
  proponer: ["Propón la edición completa siguiendo el plan", "Edición orgánica: solo B-roll y subtítulos"],
  plan: ["Crea el plan de edición con 3 planos"],
  retencion: ["¿Dónde se va a caer la audiencia?"],
  libre: ["Resume en qué estado está cada reel", "Revisa que la marca esté bien aplicada"],
  aprender: ["Pega aquí el link de un reel o de YouTube"],
};

// Texto amable para un paso técnico.
export function pasoAmigable(e) {
  const x = e.texto.replace(/^🛠\s*/, "");
  const archivos = [...new Set([...x.matchAll(/[\w.\-]+\.(?:json|md|mjs|html|jpg|png|mp4|webm)/g)].map((m) => m[0]))].slice(0, 3).join(", ");
  if (e.tipo === "estado" || e.tipo === "error") return x.replace(/^[▶✔✗■]\s*/, "");
  if (/^✎/.test(x)) return `Editó ${archivos || x.slice(2)}`;
  if (/generar\.mjs/.test(x)) return "Generó la composición";
  if (/validar\.mjs/.test(x)) return "Midió la zona segura";
  if (/aprender\.mjs/.test(x)) return "Cortó el video en momentos";
  if (/indexar\.mjs/.test(x)) return "Actualizó la biblioteca";
  if (/qa\.mjs/.test(x)) return "Normalizó el audio y creó las hojas de QA";
  if (/hyperframes.*render/.test(x)) return "Renderizó el video";
  if (/yt-dlp/.test(x)) return "Descargó el video";
  if (/ffmpeg|ffprobe/.test(x)) return "Procesó el video";
  if (/\.(jpg|png)\b/i.test(x) && /view|image|imagen|Read/i.test(x)) return `Miró ${archivos}`;
  if (/Get-Content|^Read|cat |type |sed -n|Select-Object/.test(x)) return archivos ? `Leyó ${archivos}` : "Leyó archivos";
  if (/rg |Grep|Glob|Select-String|findstr|Get-ChildItem|ls /.test(x)) return "Buscó en el proyecto";
  if (/^Write|^Edit|Set-Content|apply_patch/.test(x)) return archivos ? `Escribió ${archivos}` : "Escribió un archivo";
  return archivos ? `Trabajó con ${archivos}` : "Ejecutó un comando";
}

let abierto = null; // { el, clave, cerrar }

// Tokens: "11k", "1,2M".
export const kTok = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));
export const textoConsumo = (c) => (c ? [`${kTok(c.tokens)} tokens`, c.costo != null && "$" + c.costo.toFixed(3)].filter(Boolean).join(" · ") : "");
// Dónde empieza la conversación visible de cada chat (solo en este navegador).
const DESDE = "chat-desde-";
const leerDesde = (k) => { try { return localStorage.getItem(DESDE + k) || ""; } catch { return ""; } };
const marcarDesde = (k) => { try { localStorage.setItem(DESDE + k, new Date().toISOString()); } catch {} };
const VISIBLES = 6;

// ---------- agente, modelo y esfuerzo ----------
const ELECCION = "chat-ia-";
const leerEleccion = (k) => { try { return JSON.parse(localStorage.getItem(ELECCION + k) || "null"); } catch { return null; } };
const guardarEleccion = (k, v) => { try { localStorage.setItem(ELECCION + k, JSON.stringify(v)); } catch {} };
export const recomendadoDe = (cat, tarea, agente) => ({ modelo: "", esfuerzo: "", ...(cat?.recomendado?.[tarea]?.[agente] ?? cat?.recomendado?._todas?.[agente] ?? {}) });
const nombreEsfuerzo = (cat, e) => (e ? cat?.nombres_esfuerzo?.[e] ?? e : "El de tu configuración");
const nombreModelo = (cat, agente, m) => (m ? cat?.agentes?.[agente]?.modelos?.find((x) => x.id === m)?.nombre?.split(" — ")[0] ?? m : "su configuración");
// Etiqueta de un mensaje: lo que se pidió y lo que confirmó el CLI.
function etiquetaIA(cat, info, t) {
  const p = t.meta?.pedido_ia;
  if (!p) return null;
  const c = t.meta?.confirmado;
  const partes = [info.agentes[p.agente]?.nombre ?? p.agente, nombreModelo(cat, p.agente, p.modelo), p.esfuerzo ? `esfuerzo ${nombreEsfuerzo(cat, p.esfuerzo).toLowerCase()}` : null].filter(Boolean).join(" · ");
  const estado = c?.distinto ? h("span.error-txt", ` ⚠ usó ${c.modelo}`) : c?.modelo ? h("span.ok-txt", { title: "Modelo confirmado por el CLI" }, ` ✓ ${c.modelo}`)
    : t.estado === "corriendo" ? null : t.estado === "error" ? h("span.error-txt", " · no respondió") : h("span.tenue", { title: "Este CLI no informa qué modelo usó; se le pasó el elegido." }, " (sin confirmar)");
  const origen = [p.origen?.agente && "agente por defecto", p.origen?.modelo && "modelo recomendado"].filter(Boolean).join(", ");
  return h("div.etiqueta-ia", { title: origen ? `Elegido automáticamente: ${origen}` : "Elegido por ti" }, "⚙ ", partes, estado);
}

export async function abrirChat(o = {}) {
  const info = await agentes();
  const clave = o.perfil ? `marca-${o.perfil}` : o.slug || (o.item ? "biblioteca" : o.tarea === "aprender" || o.clave === "learner" ? "learner" : "general");
  abierto?.cerrar(true);
  const proyectos = await api("/api/proyectos").catch(() => []);
  const proy = proyectos.find((p) => p.slug === o.slug);
  let versiones = o.versiones?.length ? o.versiones : proy ? Array.from({ length: proy.etapas.versiones }, (_, i) => `v${i + 1}`) : [];
  let version = o.version ?? proy?.etapas.ultima ?? null;

  // Tareas disponibles según el contexto.
  const tareasCtx = o.perfil ? ["afinar-marca"] : clave === "learner" ? ["aprender"] : o.item ? ["describir"] : o.slug ? ["corregir", "proponer", "retencion", "plan", "referencia", "libre"] : ["libre"];
  let tarea = tareasCtx.includes(o.tarea) ? o.tarea : tareasCtx[0];
  // Agente, modelo y esfuerzo: lo último que elegiste en esta conversación; si no, el por defecto y el recomendado.
  // Nunca se cambian solos: si el agente no está listo, el envío se bloquea y se dice por qué.
  const CAT = info.catalogo;
  const guardada = leerEleccion(clave);
  let agente = guardada?.agente && info.agentes[guardada.agente] ? guardada.agente : info.config.por_tarea[tarea] || info.config.por_defecto;
  let modelo = guardada?.agente === agente ? guardada.modelo : recomendadoDe(CAT, tarea, agente).modelo;
  let esfuerzo = guardada?.agente === agente ? guardada.esfuerzo : recomendadoDe(CAT, tarea, agente).esfuerzo;
  let cuentasEstado = null; // se carga aparte (no frena la apertura del chat)
  let errorEnvio = null;
  api("/api/cuentas").then((c) => { cuentasEstado = Object.fromEntries(c.map((x) => [x.id, x])); pintarPie(); }).catch(() => {});
  const elegirAgente = (id) => {
    agente = id; ({ modelo, esfuerzo } = recomendadoDe(CAT, tarea, id)); errorEnvio = null;
    guardarEleccion(clave, { agente, modelo, esfuerzo });
    $$(".av", avatares).forEach((b) => b.classList.toggle("on", b.dataset.id === id)); pintarPie();
  };
  const titulos = { ...Object.fromEntries(Object.entries(info.tareas).map(([k, t]) => [k, t.titulo])), aprender: "Aprender técnicas", describir: "Describir" };
  const corto = { corregir: "Corregir", proponer: "Proponer edición", retencion: "Retención", plan: "Plan", referencia: "Analizar referencia", libre: "Consultar", aprender: "Learner", describir: "Describir", "afinar-marca": "Afinar marca" };

  // ---------- cabecera ----------
  const selCtx = h("select.ctx", h("option", { value: "general" }, "General"), h("option", { value: "learner", selected: clave === "learner" }, "Learner"), o.perfil && h("option", { value: clave, selected: true }, `Marca · ${o.perfilNombre ?? o.perfil}`),
    proyectos.map((p) => h("option", { value: p.slug, selected: p.slug === o.slug }, p.tema)));
  selCtx.onchange = () => abrirChat(selCtx.value === clave && o.perfil ? o : selCtx.value === "general" ? {} : selCtx.value === "learner" ? { clave: "learner" } : { slug: selCtx.value });
  const avatares = h("div.avatares", Object.entries(info.agentes).map(([id, a]) => h("button.av", {
    class: (id === agente ? "on " : "") + (a.instalado ? "" : "no"), title: a.instalado ? `Hablar con ${a.nombre}` : `${a.nombre} no está instalado`, style: { "--c": COLOR[id] }, "data-id": id,
    on: { click: () => elegirAgente(id) } }, LETRA[id] ?? id[0].toUpperCase())));
  const btnNueva = h("button.btn.chico", { title: "Empieza de cero: oculta los mensajes anteriores y no le pasa nada al agente", on: { click: () => { marcarDesde(clave); abrirChat({ ...o, trabajo: undefined, texto: undefined }); } } }, "＋ Nueva");
  const cab = h("div.chat-cab", h("div", h("div.chat-titulo", "Asistente de edición"), selCtx), h("div.espacio"), avatares, btnNueva,
    h("button.btn.chico", { title: "Cerrar (Esc)", on: { click: () => cerrar() } }, "✕"));

  // ---------- conversación ----------
  const lista = h("div.chat-lista");
  const turnos = new Map(); // id -> {el, t}
  function pintarTurno(t) {
    const yo = t.meta?.pedido || titulos[t.meta?.tarea] || t.titulo;
    const ag = t.meta?.agente;
    const enCurso = t.estado === "corriendo";
    const partes = [];
    let grupo = null;
    for (const e of t.eventos ?? []) {
      if (e.tipo === "agente") { grupo = null; partes.push(h("div.burbuja.ia.md", { html: md(e.texto) })); continue; }
      if (e.tipo === "error" || /Failed to authenticate|OAuth session expired|IneligibleTier/i.test(e.texto)) {
        grupo = null;
        const d = t.meta?.diagnostico;
        const ayuda = d ? `${d.mensaje} ${d.arreglo}`
          : /Failed to authenticate|OAuth|login/i.test(e.texto) ? "El agente no tiene la sesión iniciada. Abre Cuentas y pulsa «Conectar»."
          : /IneligibleTier|UNSUPPORTED_CLIENT/i.test(e.texto) ? "Gemini no acepta esta cuenta. Abre Cuentas para ver cómo usar una clave de API."
          : /model_not_found|not supported when using/i.test(e.texto) ? "Tu cuenta no tiene acceso a ese modelo. Elige otro en el selector de abajo." : null;
        partes.push(h("div.burbuja.error", ayuda ? [h("b", ayuda), h("div.tenue", { style: { fontSize: "11.5px", marginTop: "4px" } }, e.texto),
          h("div", h("a.btn.chico", { href: "#/cuentas", style: { marginTop: "6px" }, on: { click: () => cerrar() } }, "Abrir Cuentas"))] : e.texto.replace(/^✗\s*/, "")));
        continue;
      }
      if (/^■/.test(e.texto)) { grupo = null; partes.push(h("div.burbuja.error", "Detenido antes de terminar.")); continue; }
      if (!grupo) { grupo = { pasos: [], crudo: [] }; partes.push(grupo); }
      if (e.tipo === "paso" || e.tipo === "estado") grupo.pasos.push(pasoAmigable(e));
      if (e.tipo === "comando") grupo.pasos.push(pasoAmigable({ ...e, texto: e.texto.slice(2) }));
      grupo.crudo.push(e.texto);
    }
    const nodos = partes.map((p, i) => {
      if (p instanceof Node) return p;
      const ultimo = enCurso && i === partes.length - 1;
      const pasos = [...new Set(p.pasos)];
      const resumen = pasos.at(-1) ?? "Trabajando…";
      return h("details.pasos", { open: false },
        h("summary", ultimo ? h("span.giro") : h("span.ok-txt", "✓"), h("span", resumen), pasos.length > 1 ? h("span.tenue", ` · ${pasos.length} pasos`) : null),
        h("ol", pasos.map((x) => h("li", x))),
        p.crudo.length ? h("details.crudo", h("summary", "Detalles técnicos"), h("pre", p.crudo.join("\n"))) : null);
    });
    if (enCurso && !(partes.at(-1) && !(partes.at(-1) instanceof Node))) nodos.push(h("div.escribiendo", h("i"), h("i"), h("i")));
    const tarjeta = !enCurso && tarjetaResultado(t);
    const el = h("div.turno", { "data-id": t.id },
      h("div.yo", h("div.burbuja.mia", yo), h("div.meta-turno", [titulos[t.meta?.tarea], t.meta?.creada && t.meta.version, tiempoRelativo(t.inicio), t.meta?.previo && "con el mensaje anterior"].filter(Boolean).join(" · "))),
      h("div.ia-fila", h("div.av.on.chico", { style: { "--c": COLOR[ag] ?? "#888" } }, LETRA[ag] ?? "·"), h("div.ia-cuerpo", etiquetaIA(CAT, info, t), nodos, tarjeta,
        t.meta?.consumo && h("div.consumo", { title: `Entrada ${kTok(t.meta.consumo.entrada)} · reutilizado (caché) ${kTok(t.meta.consumo.cache)} · respuesta ${kTok(t.meta.consumo.salida)}` }, "⛁ ", textoConsumo(t.meta.consumo)),
        enCurso && h("button.btn.chico.peligro", { on: { click: () => api(`/api/trabajos/${t.id}/detener`, { method: "POST" }) } }, "■ Detener"))));
    const prev = turnos.get(t.id);
    if (prev) prev.el.replaceWith(el); else lista.append(el);
    turnos.set(t.id, { el, t });
  }
  function tarjetaResultado(t) {
    const m = t.meta ?? {};
    if (t.estado === "error" && m.diagnostico) return h("div.resultado.mal", h("b", m.diagnostico.mensaje), h("div.tenue", m.diagnostico.arreglo),
      h("div.fila", h("a.btn.chico", { href: "#/cuentas", on: { click: () => cerrar() } }, "Abrir Cuentas")));
    if (t.estado === "error") return h("div.resultado.mal", h("b", "No se completó"), h("div.tenue", "Revisa el último mensaje. Puedes reformular el pedido o probar con otro agente."));
    const cuerpo = [];
    if (m.creada) {
      const r = m.revision;
      cuerpo.push(h("b", `✔ Versión ${m.creada} lista`), h("div.tenue", `Creada desde ${m.version === m.creada ? "la anterior" : m.version}. Las versiones anteriores no se tocaron.`));
      if (r) cuerpo.push(h("div", { class: r.errores ? "error-txt" : r.avisos.length ? "aviso-txt" : "ok-txt" }, r.errores ? `${r.errores} errores de reglas` : r.avisos.length ? `${r.avisos.length} avisos` : "Reglas de la marca: todo bien"),
        r.avisos.length ? h("details", h("summary.tenue", "Ver avisos"), h("ul", r.avisos.map((a) => h("li", a)))) : null);
      if (m.validacion) cuerpo.push(h("div", { class: m.validacion.ok ? "ok-txt" : "error-txt" }, m.validacion.ok ? `Validación: ${m.validacion.resumen}` : `Validación: ${m.validacion.resumen}. Pide una corrección con lo que falló.`));
      if (m.retencion) cuerpo.push(cajaSugerencias({ slug: m.slug, version: m.retencion.version, datos: m.retencion }));
      cuerpo.push(h("div.fila", h("a.btn.prim.chico", { href: `#/editor/${m.slug}/${m.creada}`, on: { click: () => cerrar() } }, `Abrir ${m.creada} en el editor`)));
    } else if (m.tarea === "aprender" && m.tecnicas) {
      cuerpo.push(h("b", `✔ ${m.tecnicas.length} técnicas aprendidas`), h("div.etiquetas", m.tecnicas.map((s) => h("span.chip", s))),
        h("div.fila", h("a.btn.prim.chico", { href: "#/learner", on: { click: () => cerrar() } }, "Ver en el Learner")));
    } else if (m.propuesta) {
      const p = m.propuesta, n = Object.keys(p.cambios ?? {}).length + (p.nunca_nuevas?.length ? 1 : 0);
      cuerpo.push(h("b", n ? "✔ Propuesta de marca lista" : "✔ Tus reels coinciden con la marca"), h("div.tenue", n ? "No se aplicó nada todavía: revísala y decide en Marca." : "El agente no vio nada que cambiar."),
        p.errores?.length ? h("div.error-txt", `La propuesta no pasa el esquema (${p.errores.length}); no se podrá aplicar tal cual.`) : null,
        h("div.fila", h("a.btn.prim.chico", { href: `#/marca/${p.perfil}`, on: { click: () => cerrar() } }, "Revisar en Marca")));
    } else if (m.retencion) {
      cuerpo.push(h("b", `✔ Revisión de retención de ${m.retencion.version}`), cajaSugerencias({ slug: m.slug, version: m.retencion.version, datos: m.retencion }));
    } else if (m.etiquetas) {
      cuerpo.push(h("b", "✔ Guardado en la biblioteca"), h("div.etiquetas", m.etiquetas.map((s) => h("span.chip", s))));
    } else if (m.url) {
      cuerpo.push(h("b", "▶ Vista previa abierta"), h("a.btn.chico", { href: m.url, target: "_blank" }, "Abrir ↗"));
    } else if (t.tipo === "agente") {
      cuerpo.push(h("b.ok-txt", "✔ Terminado"));
    } else cuerpo.push(h("b.ok-txt", `✔ ${t.titulo}`));
    return h("div.resultado", cuerpo);
  }
  function escuchar(t) {
    const oir = (ev) => {
      const r = turnos.get(t.id); if (!r) return;
      const d = ev.detail;
      (r.t.eventos ??= []).push(typeof d === "string" ? { tipo: "proceso", texto: d } : { tipo: d.tipo, texto: d.linea });
      programar(r.t);
    };
    const fin = (ev) => { const r = turnos.get(t.id); if (!r) return; Object.assign(r.t, ev.detail); pintarTurno(r.t); bajar(); pintarPie(); };
    document.addEventListener("log-" + t.id, oir);
    document.addEventListener("fin-" + t.id, fin);
    limpiezas.push(() => { document.removeEventListener("log-" + t.id, oir); document.removeEventListener("fin-" + t.id, fin); });
  }
  let pendiente = null;
  const programar = (t) => { if (pendiente) return; pendiente = requestAnimationFrame(() => { pendiente = null; const pegado = lista.scrollHeight - lista.scrollTop - lista.clientHeight < 80; pintarTurno(t); if (pegado) bajar(); }); };
  const bajar = () => (lista.scrollTop = lista.scrollHeight);

  // ---------- pie: tarea, versión y mensaje ----------
  const pie = h("div.chat-pie");
  const texto = h("textarea", { rows: 1, placeholder: "" });
  texto.addEventListener("input", () => { texto.style.height = "auto"; texto.style.height = `${Math.min(160, texto.scrollHeight)}px`; });
  texto.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } });
  const btnEnviar = h("button.enviar", { title: "Enviar (Enter)", on: { click: () => enviar() } }, "↑");
  // Solo el último intercambio va como contexto (≈300 tokens), nunca todo el chat.
  let recordar = true;
  const ultimoTurno = () => [...turnos.values()].map((x) => x.t).filter((t) => t.tipo === "agente" && t.estado !== "corriendo").at(-1);
  function pintarPie() {
    const T = info.tareas[tarea] ?? {};
    const chipsTarea = tareasCtx.length > 1 ? h("div.chips-tarea", tareasCtx.map((k) => h("button.chip", { class: k === tarea ? "on" : "", on: { click: () => { tarea = k; pintarPie(); } } }, corto[k]))) : null;
    const selVer = (T.version || T.versionExistente) && versiones.length ? h("select.mini", versiones.slice().reverse().map((v) => h("option", { value: v, selected: v === version }, T.version ? `desde ${v}` : v))) : null;
    if (selVer) selVer.onchange = () => (version = selVer.value);
    const nota = T.version ? `Crea una versión nueva desde ${version ?? "la última"}; no toca las anteriores.` : T.versionExistente ? "Revisa la versión sin cambiarla." :
      tarea === "aprender" ? "Pega un link (Instagram, YouTube…) y, si quieres, en qué fijarse." : tarea === "libre" ? "Consulta sin cambiar archivos ni crear versiones." : "";
    texto.placeholder = tarea === "aprender" ? "https://… y en qué fijarse (opcional)" : T.texto || tarea === "corregir" ? "Escribe qué quieres cambiar…" : "Indicaciones extra (opcional) — Enter para enviar";
    const vacio = !turnos.size;
    const sug = vacio && SUGERENCIAS[tarea] ? h("div.sugerencias", SUGERENCIAS[tarea].map((s) => h("button.chip", { on: { click: () => { texto.value = s; texto.focus(); texto.dispatchEvent(new Event("input")); } } }, s))) : null;
    const ult = !["aprender", "describir"].includes(tarea) && ultimoTurno();
    const chipPrevio = ult ? h("button.chip.recordar", { class: recordar ? "on" : "", title: "Le pasa al agente un resumen corto de tu último mensaje y su respuesta. Apágalo si cambias de tema.", on: { click: () => { recordar = !recordar; pintarPie(); } } }, recordar ? "↩ Sigue del anterior" : "○ Sin contexto") : null;
    const contexto = o.contexto && version === o.contexto.version && tarea === "corregir" ? h("div.chat-contexto", `Momento ${Number(o.contexto.segundo).toFixed(2)} s · ${o.contexto.pista ?? "escena completa"} · ${version}`) : null;
    // Fila de IA: agente (avatares arriba), modelo, esfuerzo y estado de la cuenta.
    const A = CAT.agentes[agente] ?? { modelos: [{ id: "" }], esfuerzos: [] };
    const rec = recomendadoDe(CAT, tarea, agente);
    const mSel = A.modelos.find((m) => m.id === modelo) ?? A.modelos[0];
    const esfuerzos = mSel?.esfuerzos ?? A.esfuerzos;
    const def = A.por_defecto_cli ?? {};
    const noDisp = (m) => !!(m.no_disponible || (!m.id && def.modelo && A.rechazados?.[def.modelo]));
    const selModelo = h("select.mini", { title: "Modelo" }, A.modelos.map((m) => h("option", { value: m.id, selected: m.id === modelo, disabled: noDisp(m) },
      `${m.id ? m.nombre : `El de tu configuración${def.modelo ? ` (${def.modelo})` : ""}`}${m.id && m.id === rec.modelo ? " · recomendado" : ""}${noDisp(m) ? " · no disponible" : ""}`)));
    selModelo.onchange = () => { modelo = selModelo.value; const m = A.modelos.find((x) => x.id === modelo); if (esfuerzo && m?.esfuerzos && !m.esfuerzos.includes(esfuerzo)) esfuerzo = ""; errorEnvio = null; guardarEleccion(clave, { agente, modelo, esfuerzo }); pintarPie(); };
    const selEsfuerzo = esfuerzos.length ? h("select.mini", { title: "Esfuerzo (cuánto piensa antes de responder)" },
      h("option", { value: "", selected: !esfuerzo }, `Esfuerzo: el de tu configuración${def.esfuerzo ? ` (${nombreEsfuerzo(CAT, def.esfuerzo).toLowerCase()})` : ""}`),
      esfuerzos.map((e) => h("option", { value: e, selected: e === esfuerzo }, `Esfuerzo ${nombreEsfuerzo(CAT, e).toLowerCase()}${e === rec.esfuerzo && modelo === rec.modelo ? " · recomendado" : ""}`))) : h("span.tenue", "sin esfuerzo ajustable");
    if (selEsfuerzo.tagName === "SELECT") selEsfuerzo.onchange = () => { esfuerzo = selEsfuerzo.value; errorEnvio = null; guardarEleccion(clave, { agente, modelo, esfuerzo }); pintarPie(); };
    const usarRec = (rec.modelo !== modelo || rec.esfuerzo !== esfuerzo) ? h("button.chip", { title: `Recomendado para «${corto[tarea]}»: ${nombreModelo(CAT, agente, rec.modelo)}${rec.esfuerzo ? `, esfuerzo ${nombreEsfuerzo(CAT, rec.esfuerzo).toLowerCase()}` : ""}`,
      on: { click: () => { ({ modelo, esfuerzo } = rec); guardarEleccion(clave, { agente, modelo, esfuerzo }); pintarPie(); } } }, "★ Recomendado") : null;
    const cta = cuentasEstado?.[agente];
    const listo = info.agentes[agente]?.instalado && cta?.sesion?.ok !== false;
    const estadoCta = !info.agentes[agente]?.instalado ? h("span.error-txt", "no instalado")
      : !cta ? h("span.tenue", "comprobando cuenta…")
      : cta.sesion.ok === false ? h("a.error-txt", { href: "#/cuentas", on: { click: () => cerrar() } }, "sin sesión · Conectar")
      : cta.sesion.ok ? h("span.ok-txt", { title: cta.sesion.detalle }, "● conectado") : h("span.aviso-txt", { title: cta.sesion.detalle }, "● sin comprobar");
    const avisoCta = cta?.avisos?.length && !modelo ? h("div.aviso-txt.nota-ia", cta.avisos[0]) : null;
    btnEnviar.disabled = !listo;
    btnEnviar.title = listo ? "Enviar (Enter)" : `${info.agentes[agente]?.nombre ?? agente} no está listo: ${!info.agentes[agente]?.instalado ? "no está instalado" : cta?.sesion?.detalle}`;
    const err = errorEnvio ? h("div.burbuja.error.error-envio", h("b", errorEnvio), h("div", h("a.btn.chico", { href: "#/cuentas", style: { marginTop: "6px" }, on: { click: () => cerrar() } }, "Abrir Cuentas"))) : null;
    pie.replaceChildren(err ?? "", contexto ?? "", sug ?? "", chipsTarea ?? "", h("div.caja-msg", texto,
      h("div.fila-ia", h("b", { style: { color: COLOR[agente] } }, info.agentes[agente]?.nombre ?? agente), selModelo, selEsfuerzo, usarRec ?? "", h("div.espacio"), estadoCta),
      avisoCta ?? "",
      h("div.fila-msg", selVer ?? "", chipPrevio ?? "", h("span.tenue.nota", nota), h("div.espacio"), btnEnviar)));
  }
  const enviar = intentar(async () => {
    const v = texto.value.trim();
    if (btnEnviar.disabled) return;
    btnEnviar.disabled = true;
    try {
      let t;
      // Siempre se manda lo elegido (agente, modelo y esfuerzo); el servidor lo valida o explica por qué no.
      const ia = { agente, modelo, esfuerzo };
      try {
        if (tarea === "aprender") {
          const url = v.match(/https?:\/\/\S+/)?.[0];
          if (!url) throw new Error("Pega el link del video (o usa «Subir MP4» en el Learner)");
          t = await api("/api/learner", { json: { url, ...ia, texto: v.replace(url, "").trim() } });
        } else {
          if ((info.tareas[tarea]?.texto || tarea === "corregir") && !v) throw new Error("Escribe qué quieres que haga");
          t = await api("/api/agente", { json: { ...ia, tarea, slug: o.slug, version, texto: v, item: o.item, perfil: o.perfil, contexto: tarea === "corregir" && version === o.contexto?.version ? o.contexto : undefined, previo: recordar ? ultimoTurno()?.id : undefined } });
        }
      } catch (e) {
        if (!/ya hay un agente/.test(e.message) && /sesión|instalado|modelo|esfuerzo|agente|cuenta/i.test(e.message)) { errorEnvio = e.message; pintarPie(); return; }
        throw e;
      }
      errorEnvio = null;
      texto.value = ""; texto.style.height = "auto";
      agregar({ ...t, eventos: [] }); seguir(t); bajar(); pintarPie();
    } finally { pintarPie(); }
  });
  const agregar = (t) => { lista.querySelector(".chat-vacio")?.remove(); pintarTurno(t); if (t.estado === "corriendo") escuchar(t); };

  // ---------- montaje ----------
  const limpiezas = [];
  const el = h("aside.chat", cab, lista, pie);
  document.body.append(el);
  document.body.classList.add("con-chat");
  const tecla = (e) => { if (e.key === "Escape" && !e.target.closest?.("input, textarea, select")) cerrar(); };
  addEventListener("keydown", tecla);
  function cerrar(reemplazo = false) {
    limpiezas.forEach((f) => f()); removeEventListener("keydown", tecla);
    el.remove(); if (!reemplazo) document.body.classList.remove("con-chat");
    abierto = null;
  }
  abierto = { el, clave, cerrar };

  // Historial (o un solo trabajo, si se abre desde la bandeja).
  const desde = leerDesde(clave);
  const todo = o.trabajo ? [await api(`/api/trabajos/${o.trabajo}`)] : (await api(`/api/chat/${clave}`)).filter((t) => !desde || t.inicio > desde);
  const historia = todo.slice(-VISIBLES);
  if (todo.length > historia.length) lista.append(h("button.btn.chico.ver-mas", { on: { click: (e) => { e.target.remove(); for (const t of todo.slice(0, -VISIBLES).reverse()) { const n = turnos.size; pintarTurno(t); const r = turnos.get(t.id); if (turnos.size > n) lista.insertBefore(r.el, lista.children[0]); } } } }, `Ver ${todo.length - historia.length} mensajes anteriores`));
  if (!historia.length) lista.append(h("div.chat-vacio", h("div.av.on.grande", { style: { "--c": COLOR[agente] } }, LETRA[agente]),
    h("b", clave === "learner" ? "Enséñale un video" : o.slug ? `¿Qué hacemos con «${proy?.tema ?? o.slug}»?` : "¿En qué te ayudo?"),
    h("div.tenue", clave === "learner" ? "Pega un link y el agente aprende sus técnicas de edición." : "Pide cambios como se los pedirías a tu editor. Cada cambio crea una versión nueva; nunca se pisa nada."),
    h("div.tenue.ahorro", "Cada mensaje arranca limpio: el agente no recibe este chat, solo (si quieres) un resumen del mensaje anterior. Así no se acumulan tokens.")));
  for (const t of historia) agregar(t);
  pintarPie(); bajar();
  if (o.texto) { texto.value = o.texto; }
  texto.focus();
  return abierto;
}
