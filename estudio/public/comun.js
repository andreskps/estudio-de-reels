// Utilidades compartidas del Estudio.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export async function api(ruta, opciones = {}) {
  const o = { ...opciones };
  if (o.json !== undefined) { o.method ??= "POST"; o.body = JSON.stringify(o.json); o.headers = { "Content-Type": "application/json" }; delete o.json; }
  const r = await fetch(ruta, o);
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d?.error) throw new Error(d?.error ?? `error ${r.status}`);
  return d;
}
export const archivo = (ruta) => (ruta ? `/archivo/${ruta.split("/").map(encodeURIComponent).join("/")}` : "");

// Crea elementos: h("div.clase#id", {atributos, on: {click}}, ...hijos)
export function h(tag, props = {}, ...hijos) {
  if (props == null || typeof props !== "object" || props instanceof Node || Array.isArray(props)) { hijos.unshift(props); props = {}; }
  const [, nombre = "div", resto = ""] = /^([\w-]*)(.*)$/.exec(tag);
  const el = document.createElement(nombre || "div");
  for (const m of resto.matchAll(/([.#])([\w-]+)/g)) m[1] === "." ? el.classList.add(m[2]) : (el.id = m[2]);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "on") for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "class") el.className += " " + v;
    else if (k === "html") el.innerHTML = v;
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of hijos.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

export function toast(texto, error = false) {
  const t = h("div.toast", { role: "status", "aria-live": "polite", class: error ? "error" : "" }, texto);
  document.body.append(t);
  setTimeout(() => t.remove(), error ? 5000 : 2600);
}
export const intentar = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { toast(e.message, true); } };

export function modal(titulo, ...contenido) {
  const cerrar = () => velo.remove();
  const velo = h("div.velo", { on: { mousedown: (e) => e.target === velo && cerrar() } },
    h("div.modal", h("div.fila", h("h2", titulo), h("div.espacio"), h("button.btn.chico", { on: { click: cerrar } }, "✕")), ...contenido));
  document.body.append(velo);
  return { cerrar, el: velo };
}

// Confirmación dentro de la app (los diálogos nativos no funcionan en todos los navegadores embebidos).
export function confirmar(texto, { si = "Sí", no = "Cancelar" } = {}) {
  return new Promise((ok) => {
    const m = modal("Confirmar", h("div", texto), h("div.fila", h("div.espacio"),
      h("button.btn", { on: { click: () => { m.cerrar(); ok(false); } } }, no),
      h("button.btn.prim", { on: { click: () => { m.cerrar(); ok(true); } } }, si)));
  });
}
export function preguntar(texto, valor = "") {
  return new Promise((ok) => {
    const i = h("input", { type: "text", value: valor });
    const fin = (v) => { m.cerrar(); ok(v); };
    i.addEventListener("keydown", (e) => e.key === "Enter" && fin(i.value.trim() || null));
    const m = modal(texto, i, h("div.fila", h("div.espacio"), h("button.btn", { on: { click: () => fin(null) } }, "Cancelar"), h("button.btn.prim", { on: { click: () => fin(i.value.trim() || null) } }, "Aceptar")));
    i.focus();
  });
}

export const esc =(t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// Markdown mínimo (títulos, listas, negritas, código, tablas, citas).
export function md(texto) {
  if (!texto) return "";
  const lineas = esc(texto).split(/\r?\n/);
  let out = "", lista = null, tabla = false, pre = false;
  const inl = (s) => s.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|\W)_([^_]+)_(?=\W|$)/g, "$1<i>$2</i>");
  const cerrar = () => { if (lista) { out += `</${lista}>`; lista = null; } if (tabla) { out += "</table>"; tabla = false; } };
  for (const l of lineas) {
    if (l.startsWith("```")) { cerrar(); out += pre ? "</pre>" : "<pre>"; pre = !pre; continue; }
    if (pre) { out += l + "\n"; continue; }
    let m;
    if ((m = /^(#{1,4})\s+(.*)/.exec(l))) { cerrar(); out += `<h${m[1].length}>${inl(m[2])}</h${m[1].length}>`; }
    else if (/^\s*\|/.test(l)) { if (/^\s*\|[\s:|-]+\|\s*$/.test(l)) continue; if (!tabla) { cerrar(); out += "<table>"; tabla = true; } out += "<tr>" + l.trim().replace(/^\||\|$/g, "").split("|").map((c) => `<td>${inl(c.trim())}</td>`).join("") + "</tr>"; }
    else if ((m = /^\s*[-*]\s+(.*)/.exec(l))) { if (lista !== "ul") { cerrar(); out += "<ul>"; lista = "ul"; } out += `<li>${inl(m[1])}</li>`; }
    else if ((m = /^\s*\d+[.)]\s+(.*)/.exec(l))) { if (lista !== "ol") { cerrar(); out += "<ol>"; lista = "ol"; } out += `<li>${inl(m[1])}</li>`; }
    else if ((m = /^&gt;\s?(.*)/.exec(l))) { cerrar(); out += `<blockquote class="tenue">${inl(m[1])}</blockquote>`; }
    else if (!l.trim()) cerrar();
    else { cerrar(); out += `<p>${inl(l)}</p>`; }
  }
  cerrar();
  return out;
}
export const tiempo = (s) => { s = Math.max(0, s || 0); const m = Math.floor(s / 60); return `${m}:${(s % 60).toFixed(2).padStart(5, "0")}`; };
export const dur = (s) => (s == null ? "" : s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : `${s.toFixed(1)} s`);
export const mb = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);

// ---------- trabajos ----------
const vivos = new Map();
const alTerminar = new Set();
export const cuandoTermine = (fn) => { alTerminar.add(fn); return () => alTerminar.delete(fn); };
export function seguir(t, { abrir = false } = {}) {
  if (vivos.has(t.id)) { if (abrir) verLog(t.id); return; }
  const bandeja = $("#bandeja");
  const tarjeta = h("div.trabajo", { on: { click: () => verLog(t.id) } }, h("div.t", h("span.giro"), t.titulo), h("div.u", "empezando…"));
  bandeja.prepend(tarjeta);
  const ev = new EventSource(`/api/trabajos/${t.id}/eventos`);
  const lineas = [];
  vivos.set(t.id, { tarjeta, lineas, ev, t });
  ev.onmessage = (e) => {
    const d = JSON.parse(e.data);
    lineas.push(d.linea);
    // En la bandeja, una frase corta: lo que dice el agente o el paso en palabras normales.
    if (d.tipo !== "proceso") import("./chat.js").then((m) => { $(".u", tarjeta).textContent = d.tipo === "agente" ? d.linea.replace(/[*_`#>]|^\s*- /gm, "").replace(/\s+/g, " ").slice(0, 120) : m.pasoAmigable({ tipo: d.tipo ?? "paso", texto: d.tipo === "comando" ? d.linea.slice(2) : d.linea }); });
    document.dispatchEvent(new CustomEvent("log-" + t.id, { detail: d }));
  };
  ev.addEventListener("fin", (e) => {
    ev.close();
    const fin = JSON.parse(e.data || "{}");
    const ok = fin.estado === "ok";
    tarjeta.classList.add(ok ? "ok" : "error");
    $(".t", tarjeta).replaceChildren(ok ? "✔ " : "✗ ", t.titulo);
    vivos.get(t.id).fin = fin;
    document.dispatchEvent(new CustomEvent("fin-" + t.id, { detail: fin }));
    for (const fn of alTerminar) fn({ ...t, ...fin });
    setTimeout(() => tarjeta.remove(), ok ? 12000 : 40000);
  });
  if (abrir) verLog(t.id);
}
// Ver un trabajo: se abre en el panel de chat (pasos resumidos; los detalles técnicos quedan plegados).
export async function verLog(id) {
  const { abrirChat } = await import("./chat.js");
  const t = await api(`/api/trabajos/${id}`);
  const ch = t.meta?.chat ?? "";
  if (ch.startsWith("marca-")) return abrirChat({ trabajo: id, perfil: t.meta?.perfil ?? ch.slice(6), tarea: t.meta?.tarea });
  abrirChat({ trabajo: id, slug: t.meta?.chat && t.meta.chat !== "general" && t.meta.chat !== "learner" && t.meta.chat !== "biblioteca" ? t.meta.chat : t.meta?.slug, clave: t.meta?.chat, tarea: t.meta?.tarea });
}
export async function accion(datos, opciones) {
  const t = await api("/api/accion", { json: datos });
  seguir(t, opciones);
  return t;
}

// ---------- pedir a un agente ----------
let infoAgentes;
export async function agentes() { return (infoAgentes ??= await api("/api/agentes")); }
export function olvidarAgentes() { infoAgentes = null; }
// Pedir algo a un agente = abrir el chat del proyecto con la tarea elegida.
export async function pedirAgente({ tarea = "corregir", slug, version, item, versiones = [], tareas: soloTareas, texto, contexto } = {}) {
  const { abrirChat } = await import("./chat.js");
  return abrirChat({ tarea: soloTareas?.[0] ?? tarea, slug, version, item, versiones, texto, contexto });
}

export function tiempoRelativo(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  return s < 60 ? "hace un momento" : s < 3600 ? `hace ${Math.round(s / 60)} min` : s < 86400 ? `hace ${Math.round(s / 3600)} h` : new Date(iso).toLocaleDateString();
}
