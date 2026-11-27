// Learner: pega un link o sube un video de referencia → un agente aprende sus técnicas de edición → quedan guardadas
// con su ejemplo para usarlas en tus reels (las que tienen receta se arrastran a la pista Efectos del editor).
import { $, $$, agentes, api, archivo, confirmar, dur, h, intentar, pedirAgente, seguir, toast } from "./comun.js";

const filtro = { cat: "", q: "", compatibles: false };
let marcaCache;

export async function verLearner(principal, biblioteca) {
  const [L, info] = await Promise.all([api("/api/tecnicas"), agentes()]);
  marcaCache = (await api("/api/marca")).brand; // perfil activo (puede cambiar entre visitas)
  const prohibidos = marcaCache.animaciones?.rasgos_prohibidos ?? [];
  const { tecnicas, fuentes, recetas, categorias } = L;

  // ---------- entrada ----------
  let agente = info.config.por_tarea.aprender || info.config.por_defecto;
  const selAg = h("select", { title: "Agente que mira el video" }, Object.entries(info.agentes).map(([id, a]) => h("option", { value: id, selected: id === agente, disabled: !a.instalado }, a.nombre)));
  selAg.onchange = () => (agente = selAg.value);
  const link = h("input", { type: "url", placeholder: L.ytdlp ? "Pega el link de un reel o de un video de YouTube" : "Para pegar links instala yt-dlp (winget install yt-dlp); mientras, sube el MP4", disabled: !L.ytdlp });
  const nota = h("input", { type: "text", placeholder: "Opcional: en qué fijarse (ej.: las transiciones entre B-roll)" });
  const empezar = async (cuerpo) => {
    const t = await api("/api/learner", { json: { ...cuerpo, agente, texto: nota.value } });
    seguir(t);
    pedirAgente({ tarea: "aprender" });
  };
  const btnLink = h("button.btn.prim", { disabled: !L.ytdlp, on: { click: intentar(async () => { if (!link.value.trim()) throw new Error("pega un link"); await empezar({ url: link.value.trim() }); link.value = ""; }) } }, "Aprender");
  link.addEventListener("keydown", (e) => e.key === "Enter" && btnLink.click());
  const subir = h("input", { type: "file", accept: "video/*", style: { display: "none" }, on: { change: intentar(async () => {
    const f = subir.files[0]; if (!f) return;
    toast(`Subiendo ${f.name}…`);
    const r = await fetch(`/api/subir?tipo=inspiracion&nombre=${encodeURIComponent(f.name)}`, { method: "POST", body: f });
    const d = await r.json(); if (!r.ok) throw new Error(d.error);
    await empezar({ ruta: d.ruta });
  }) } });
  const refs = Object.values(biblioteca.items).filter((i) => i.clase === "video" && (i.tipo === "inspiracion" || /\/referencia\//.test(i.ruta)));
  const estudiados = new Set(fuentes.map((f) => f.video));
  const selRef = h("select", h("option", { value: "" }, `Elegir un referente de tu biblioteca (${refs.length})…`),
    refs.map((i) => h("option", { value: i.ruta }, `${estudiados.has(i.ruta) ? "✓ " : ""}${i.nombre} · ${i.ruta.split("/").slice(-3, -2)[0] ?? ""}`)));
  selRef.onchange = intentar(async () => { const v = selRef.value; selRef.value = ""; if (v) await empezar({ ruta: v }); });

  const entrada = h("div.learner-entrada",
    h("div.fila", h("span.ico-link", "🔗"), link, selAg, btnLink),
    h("div.fila", h("button.btn", { on: { click: () => subir.click() } }, "⬆ Subir MP4"), subir, selRef, nota),
    h("div.tenue", { style: { fontSize: "12px" } }, "El video se guarda solo en tu computador para estudiarlo. Se aprende la técnica, nunca se reutiliza el material del otro creador."));

  // ---------- filtros ----------
  const cuenta = {};
  tecnicas.forEach((t) => (cuenta[t.categoria] = (cuenta[t.categoria] ?? 0) + 1));
  const rejilla = h("div.rejilla.tecnicas");
  const buscar = h("input", { type: "search", placeholder: "Buscar técnica…", value: filtro.q });
  const chipsCat = h("div.etiquetas", h("span.chip", { class: !filtro.cat ? "on" : "", "data-c": "" }, "Todas", h("span.tenue", tecnicas.length)),
    Object.entries(categorias).filter(([k]) => cuenta[k] || k !== "sin-ordenar").map(([k, n]) => h("span.chip", { class: filtro.cat === k ? "on" : "", "data-c": k }, n, h("span.tenue", cuenta[k] ?? 0))));
  chipsCat.addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (!c) return; filtro.cat = c.dataset.c; $$(".chip", chipsCat).forEach((x) => x.classList.toggle("on", x === c)); pintar(); });
  const compat = h("button.chip", { class: filtro.compatibles ? "on" : "", on: { click: () => { filtro.compatibles = !filtro.compatibles; compat.classList.toggle("on"); pintar(); } } }, "✓ Solo las que encajan con mi marca");
  buscar.oninput = () => { filtro.q = buscar.value; pintar(); };

  function pintar() {
    const w = filtro.q.toLowerCase().split(/\s+/).filter(Boolean);
    const vis = tecnicas.filter((t) => (!filtro.cat || t.categoria === filtro.cat) && (!filtro.compatibles || t.compatible_marca) &&
      w.every((x) => `${t.slug} ${t.nombre} ${t.descripcion} ${(t.etiquetas ?? []).join(" ")}`.toLowerCase().includes(x)));
    rejilla.replaceChildren(...(vis.length ? vis.map((t) => tarjeta(t)) : [h("div.vacio", { style: { gridColumn: "1/-1" } },
      tecnicas.length ? "Nada coincide con el filtro." : "Aún no hay técnicas. Pega un link, sube un MP4 o elige un referente de tu biblioteca.")]));
  }
  function tarjeta(t) {
    const vista = h("div.vista", { style: { backgroundImage: t.miniatura ? `url("${archivo(t.miniatura)}")` : "none" } },
      h("div.insignias", t.receta ? h("span.pill.ok", "✓ receta") : h("span.pill", "solo inspiración"), !t.compatible_marca && h("span.pill.aviso", "⚠ marca")),
      t.favorito && h("span.fav", "★"));
    let v;
    vista.addEventListener("mouseenter", () => { if (!t.ejemplos?.[0]) return; v = h("video", { src: archivo(t.ejemplos[0].clip), muted: true, autoplay: true, loop: true, playsInline: true }); vista.append(v); });
    vista.addEventListener("mouseleave", () => { v?.remove(); v = null; });
    return h("div.item", { on: { click: () => detalle(t) } }, vista,
      h("div.info", h("div.slug", t.slug), h("div.nombre", t.nombre), h("div.tags", `${categorias[t.categoria] ?? t.categoria} · ${t.veces ?? 0} ejemplo${t.veces === 1 ? "" : "s"} · ${t.fuentes?.length ?? 0} video${t.fuentes?.length === 1 ? "" : "s"}`)));
  }

  // ---------- detalle ----------
  function detalle(t) {
    $(".detalle")?.remove();
    let ej = 0;
    const player = h("video", { src: archivo(t.ejemplos?.[0]?.clip), controls: true, autoplay: true, muted: true, loop: true, playsInline: true });
    const fuenteDe = (e) => fuentes.find((f) => f.id === e.fuente);
    const pieEj = h("div.tenue", { style: { fontSize: "12px" } });
    const ponerEj = (i) => { ej = i; const e = t.ejemplos[i]; player.src = archivo(e.clip); pieEj.textContent = `${fuenteDe(e)?.titulo ?? e.video} · ${dur(e.inicio)}–${dur(e.fin)}`; $$(".ejs img", panel).forEach((x, j) => x.classList.toggle("on", j === i)); };
    const ejs = h("div.ejs", (t.ejemplos ?? []).map((e, i) => h("img", { src: archivo(e.miniatura), title: fuenteDe(e)?.titulo ?? "", on: { click: () => ponerEj(i) } })));
    const nombre = h("input", { type: "text", value: t.nombre });
    const cat = h("select", Object.entries(categorias).map(([k, n]) => h("option", { value: k, selected: k === t.categoria }, n)));
    const desc = h("textarea", { rows: 3 }, t.descripcion ?? "");
    const como = h("textarea", { rows: 3 }, t.como_se_hace ?? "");
    const selRec = h("select", h("option", { value: "" }, "Sin receta (solo inspiración)"), Object.entries(recetas).map(([k, r]) => h("option", { value: k, selected: k === t.receta }, `${r.nombre} · ${categorias[r.categoria]}`)));
    const params = { ...(t.parametros ?? {}) };
    const cajaParams = h("div.rejilla2");
    const pintarParams = () => {
      const R = recetas[selRec.value];
      cajaParams.replaceChildren(...(R ? Object.entries(R.params).map(([k, d]) => {
        const val = params[k] ?? d.def;
        const el = d.tipo === "opcion" ? h("select", d.opciones.map((o) => h("option", { value: o, selected: o === val }, o))) :
          h("input", { type: d.tipo === "num" ? "number" : d.tipo === "color" ? "color" : "text", step: d.paso, min: d.min, max: d.max, value: val });
        el.onchange = () => (params[k] = d.tipo === "num" ? Number(el.value) : el.value);
        return h("label.campo", d.nombre, el);
      }) : []));
      const choca = R ? (R.rasgos ?? []).filter((x) => prohibidos.includes(x)) : [];
      avisoRec.textContent = choca.length ? `⚠ Tu marca dice «Nunca» a: ${choca.join(", ")}. Puedes usarla, pero el editor avisará.` : "";
    };
    const avisoRec = h("div.aviso-txt", { style: { fontSize: "12px" } });
    selRec.onchange = () => { for (const k in params) delete params[k]; pintarParams(); };
    const comp = h("input", { type: "checkbox", checked: t.compatible_marca });
    const motivo = h("input", { type: "text", value: t.motivo_marca ?? "" });
    const etq = h("input", { type: "text", value: (t.etiquetas ?? []).join(", ") });
    const guardar = intentar(async () => {
      await api(`/api/tecnica/${t.slug}`, { json: { nombre: nombre.value, categoria: cat.value, descripcion: desc.value, como_se_hace: como.value, receta: selRec.value || null,
        parametros: params, compatible_marca: comp.checked, motivo_marca: motivo.value, etiquetas: etq.value.split(",") } });
      toast("Técnica guardada"); panel.remove(); verLearner(principal, biblioteca);
    });
    const usar = h("select", h("option", { value: "" }, "Usar en un reel…"));
    api("/api/proyectos").then((ps) => ps.filter((p) => p.etapas.editable).forEach((p) => usar.append(h("option", { value: `${p.slug}/${p.etapas.ultima}` }, `${p.tema} (${p.etapas.ultima})`))));
    usar.onchange = () => {
      if (!usar.value) return;
      if (!t.receta) { usar.value = ""; return toast("Esta técnica aún no tiene receta: elige una arriba y guarda, o úsala como referencia en «Pedir al agente».", true); }
      sessionStorage.setItem("insertarTecnica", t.slug); panel.remove(); location.hash = `#/editor/${usar.value}`;
    };
    const panel = h("div.detalle",
      h("div.fila", h("div", h("div.slug", t.slug), h("b", t.nombre)), h("div.espacio"),
        h("button.btn.chico", { title: "Favorito", on: { click: intentar(async () => { await api(`/api/tecnica/${t.slug}`, { json: { favorito: !t.favorito } }); t.favorito = !t.favorito; toast(t.favorito ? "★ Favorito" : "Quitado de favoritos"); }) } }, t.favorito ? "★" : "☆"),
        h("button.btn.chico", { on: { click: () => panel.remove() } }, "✕")),
      t.ejemplos?.length ? player : h("div.vacio", "Sin ejemplo en video"), pieEj, t.ejemplos?.length > 1 && ejs,
      h("div.fila", usar),
      h("label.campo", "Nombre", nombre), h("label.campo", "Categoría", cat),
      h("label.campo", "Qué es", desc), h("label.campo", "Cómo se hace", como),
      h("label.campo", "Receta del editor", selRec), avisoRec, cajaParams,
      h("label.fila", comp, "Encaja con mi marca"), h("label.campo", "Por qué", motivo),
      h("label.campo", "Etiquetas", etq),
      h("div.fila", h("button.btn.peligro", { on: { click: intentar(async () => {
        if (!(await confirmar(`Mover «${t.nombre}» a biblioteca/tecnicas/.papelera? (no se borra)`, { si: "Quitar" }))) return;
        await api(`/api/tecnica/${t.slug}/quitar`, { json: {} }); panel.remove(); toast("Movida a la papelera"); verLearner(principal, biblioteca);
      }) } }, "Quitar"), h("div.espacio"), h("button.btn.prim", { on: { click: guardar } }, "Guardar")));
    document.body.append(panel);
    if (t.ejemplos?.length) ponerEj(0);
    pintarParams();
  }

  // ---------- videos estudiados y recetas ----------
  const listaFuentes = fuentes.length ? h("div.fuentes", fuentes.map((f) => h("div.fuente",
    h("div.mini", { style: { backgroundImage: f.miniatura ? `url("${archivo(f.miniatura)}")` : "none" } }),
    h("div", h("b", f.titulo), h("div.tenue", `${f.url ? new URL(f.url).hostname.replace(/^www\./, "") + " · " : ""}${f.duracion ? dur(f.duracion) : ""} · ${f.cortes} cortes · plano medio ${f.plano_medio_s} s`),
      h("div", { style: { fontSize: "13px", margin: "4px 0" } }, f.resumen),
      h("div.etiquetas", (f.tecnicas ?? []).map((s) => { const t = tecnicas.find((x) => x.slug === s); return t ? h("span.chip", { on: { click: () => detalle(t) } }, t.nombre) : null; }))))))
    : h("div.tenue", "Todavía no has estudiado ningún video.");
  const listaRecetas = h("div.recetas", Object.entries(recetas).map(([k, r]) => {
    const choca = (r.rasgos ?? []).filter((x) => prohibidos.includes(x));
    return h("div.receta", h("div.fila", h("b", r.nombre), h("div.espacio"), choca.length ? h("span.pill.aviso", { title: `Tu marca dice «Nunca» a: ${choca.join(", ")}` }, "⚠ marca") : h("span.pill.ok", "✓ marca")),
      h("div.slug", k), h("div.tenue", { style: { fontSize: "12.5px" } }, r.descripcion));
  }));

  principal.replaceChildren(h("div.pagina",
    h("div.cabecera", h("h1", "Learner"), h("span.sub", `${tecnicas.length} técnicas aprendidas de ${fuentes.length} video${fuentes.length === 1 ? "" : "s"} de referencia. Toca una para verla.`)),
    entrada, h("div.filtros", buscar, compat), chipsCat, rejilla,
    h("h2", { style: { marginTop: "34px" } }, "Videos estudiados"), listaFuentes,
    h("h2", { style: { marginTop: "34px" } }, "Recetas del editor"),
    h("p.tenue", "Lo que el editor sabe reproducir. Una técnica con receta se arrastra a la pista Efectos de cualquier reel."), listaRecetas));
  pintar();
}
