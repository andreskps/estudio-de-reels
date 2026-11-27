// Piezas del flujo guiado (fase 4) que comparten el chat y la página del proyecto:
// sugerencias de retención como botones y el modo sin paradas.
import { api, confirmar, h, intentar, modal, seguir, toast } from "./comun.js";

// Agente, modelo y esfuerzo elegidos en el chat de este reel (los mismos que usa el chat; nunca se cambian en silencio).
const ELECCION = "chat-ia-";
export const eleccionDe = (slug) => { try { return JSON.parse(localStorage.getItem(ELECCION + slug) || "null") ?? {}; } catch { return {}; } };
const textoEleccion = (e) => (e.agente ? [e.agente, e.modelo || "modelo del CLI", e.esfuerzo && `esfuerzo ${e.esfuerzo}`].filter(Boolean).join(" · ") : "el agente por defecto con el modelo recomendado");

// Lista de sugerencias con casillas: «Aplicar seleccionadas» (una sola vN+1) o «Descartar».
export function cajaSugerencias({ slug, version, datos, decididas = {}, alHacer }) {
  if (!datos?.sugerencias?.length) return datos?.veredicto ? h("div.tenue", `Retención: ${datos.veredicto} · sin sugerencias`) : null;
  const elegidas = new Set();
  const pendientes = datos.sugerencias.filter((s) => !decididas[s.id]);
  const filas = datos.sugerencias.map((s) => {
    const hecha = decididas[s.id];
    return h("label.sugerencia", { class: hecha ? "hecha" : "" },
      hecha ? h("span.tenue", hecha.startsWith("aplicada") ? "✔" : "✕") : h("input", { type: "checkbox", on: { change: (e) => { e.target.checked ? elegidas.add(s.id) : elegidas.delete(s.id); pintarBotones(); } } }),
      h("span", s.segundo != null ? h("b", `${Number(s.segundo).toFixed(1)} s · `) : null, s.texto, s.choca_marca ? h("span.aviso-txt", " (choca con tu marca)") : null, hecha ? h("span.tenue", ` — ${hecha}`) : null));
  });
  const botones = h("div.fila");
  const hacer = (accion) => intentar(async () => {
    const ids = [...elegidas];
    if (accion === "aplicar" && !(await confirmar(`¿Aplicar ${ids.length} sugerencia(s) en una versión nueva? Usará ${textoEleccion(eleccionDe(slug))}. ${version} no se toca.`, { si: "Aplicar" }))) return;
    const r = await api(`/api/proyecto/${slug}/sugerencias`, { json: { version, ids, accion, ...eleccionDe(slug) } });
    if (accion === "aplicar") { seguir(r, { abrir: true }); toast(`Aplicando en ${r.meta?.creada ?? "una versión nueva"}…`); }
    else toast("Sugerencias descartadas");
    alHacer?.();
  });
  function pintarBotones() {
    botones.replaceChildren(h("div.espacio"),
      h("button.btn.chico", { disabled: !elegidas.size, on: { click: hacer("descartar") } }, "Descartar"),
      h("button.btn.chico.prim", { disabled: !elegidas.size, on: { click: hacer("aplicar") } }, `Aplicar${elegidas.size ? ` (${elegidas.size})` : ""}`));
  }
  pintarBotones();
  return h("div.sugerencias-ret", h("div", h("b", "Retención: "), datos.veredicto || "—", pendientes.length ? h("span.tenue", ` · ${pendientes.length} por decidir`) : null),
    filas, pendientes.length ? botones : null);
}

// Botón del modo sin paradas: el servidor encadena los pasos y aprueba los checkpoints solo; las reglas no se saltan.
export function botonSinParadas(slug, sp, alCambiar) {
  if (sp?.activo) return h("div.fila", h("span.chip.on", "⏩ Sin paradas en marcha"),
    h("button.btn.chico", { on: { click: intentar(async () => { await api(`/api/proyecto/${slug}/sin-paradas`, { json: { activo: false } }); toast("Sin paradas detenido"); alCambiar?.(); }) } }, "Detener"));
  return h("div.fila",
    h("button.btn.chico", { title: "Encadena todos los pasos hasta el MP4 final sin esperar tus aprobaciones", on: { click: () => {
      const e = eleccionDe(slug);
      const m = modal("Sin paradas",
        h("p", "El Estudio hará solo los pasos que faltan: preparar, plan, primera edición, validación, retención y exportación. Aprobará el plan y la vista previa por ti."),
        h("p.tenue", "Lo que no cambia: si la validación falla o un paso no avanza, se detiene y te dice por qué. Las sugerencias de retención no se aplican solas: quedan para que las decidas."),
        h("p", "Agente: ", h("b", textoEleccion(e)), h("span.tenue", e.agente ? " (lo último que elegiste en el chat de este reel)" : " (aún no elegiste uno en el chat de este reel; cámbialo ahí si quieres otro)")),
        h("div.fila", h("div.espacio"), h("button.btn", { on: { click: () => m.cerrar() } }, "Cancelar"),
          h("button.btn.prim", { on: { click: intentar(async () => { await api(`/api/proyecto/${slug}/sin-paradas`, { json: { activo: true, ...e } }); m.cerrar(); toast("Sin paradas: en marcha"); alCambiar?.(); }) } }, "Empezar")));
    } } }, "⏩ Sin paradas"),
    sp?.motivo ? h("span.tenue", `Última vez: ${sp.motivo}`) : null);
}
