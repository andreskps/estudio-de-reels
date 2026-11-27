// Recetas de efectos: cómo se hace cada técnica en HyperFrames. Las usan generar.mjs (HTML + GSAP),
// reglas.mjs (avisos de marca) y el editor del Estudio (vista previa aproximada).
// Sin imports de Node: este archivo también se carga en el navegador.
//
// Un efecto en edicion.json:  {"id":"efx-1","receta":"flash-corte","inicio":12.4,"fin":12.65,"params":{"color":"#ffffff"},"tecnica":"flash-corte"}
//
// Dos tipos de receta:
//  - capa: dibuja un overlay en compositions/efectos.html (encima del B-roll y del creador, debajo de tarjetas y subtítulos).
//          Los filtros (blanco y negro, desenfoque) usan backdrop-filter en el overlay: afectan a todo lo que hay debajo.
//  - cuadro: mueve el cuadro (#fx envuelve al creador y #fondos al B-roll) desde la línea de tiempo principal.
// Regla de GSAP: nunca fromTo con estado "from" no neutro en la línea principal (al buscar hacia atrás se quedaría pegado);
// las capas no tienen ese problema porque fuera de su ventana el clip está oculto.

const r3 = (n) => Math.round(n * 1000) / 1000;
const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const facil = (p) => 1 - (1 - p) ** 2;

export const CATEGORIAS = {
  cortes: "Cortes y ritmo",
  transiciones: "Transiciones",
  efectos: "Efectos visuales",
  motion: "Motion graphics",
  textos: "Textos y subtítulos",
  sonido: "Sonido",
  "sin-ordenar": "Sin ordenar",
};

// params: {clave: {nombre, def, tipo: "num"|"color"|"texto"|"opcion", min, max, paso, opciones}}
export const RECETAS = {
  "flash-corte": {
    nombre: "Flash en el corte", categoria: "transiciones", tipo: "capa", duracion: 0.25,
    descripcion: "Destello de luz que sube rápido y se apaga; tapa un corte seco.",
    rasgos: ["flash", "transicion-decorativa"],
    params: { color: { nombre: "Color", def: "#ffffff", tipo: "color" }, intensidad: { nombre: "Intensidad", def: 0.85, tipo: "num", min: 0.1, max: 1, paso: 0.05 } },
    capa: (e, P, a, d) => ({
      html: `<div id="${e.dom}" class="clip efx-full" data-start="${a}" data-duration="${d}" style="background: ${P.color}; opacity: 0"></div>`,
      js: [`tl.fromTo("#${e.dom}", {opacity: 0}, {opacity: ${P.intensidad}, duration: ${r3(d * 0.3)}, ease: "power2.out"}, ${a});`,
        `tl.to("#${e.dom}", {opacity: 0, duration: ${r3(d * 0.7)}, ease: "power2.in"}, ${r3(a + d * 0.3)});`],
    }),
    vista: (P, p) => ({ capa: { background: P.color, opacity: P.intensidad * (p < 0.3 ? facil(p / 0.3) : 1 - (p - 0.3) / 0.7) } }),
  },
  "fundido-negro": {
    nombre: "Fundido a negro", categoria: "transiciones", tipo: "capa", duracion: 0.6,
    descripcion: "Baja a negro y vuelve. Separa dos ideas sin cortar en seco.",
    rasgos: ["fundido"],
    params: { color: { nombre: "Color", def: "#000000", tipo: "color" } },
    capa: (e, P, a, d) => ({
      html: `<div id="${e.dom}" class="clip efx-full" data-start="${a}" data-duration="${d}" style="background: ${P.color}; opacity: 0"></div>`,
      js: [`tl.fromTo("#${e.dom}", {opacity: 0}, {opacity: 1, duration: ${r3(d / 2)}, ease: "power1.inOut"}, ${a});`,
        `tl.to("#${e.dom}", {opacity: 0, duration: ${r3(d / 2)}, ease: "power1.inOut"}, ${r3(a + d / 2)});`],
    }),
    vista: (P, p) => ({ capa: { background: P.color, opacity: p < 0.5 ? p * 2 : (1 - p) * 2 } }),
  },
  barrido: {
    nombre: "Barrido (wipe)", categoria: "transiciones", tipo: "capa", duracion: 0.5,
    descripcion: "Un panel cruza la pantalla de lado a lado y tapa el corte a mitad de camino.",
    rasgos: ["wipe", "transicion-decorativa"],
    params: { color: { nombre: "Color", def: "#000000", tipo: "color" }, direccion: { nombre: "Dirección", def: "derecha", tipo: "opcion", opciones: ["derecha", "izquierda"] } },
    capa: (e, P, a, d) => {
      const [x0, x1] = P.direccion === "izquierda" ? [1080, -1080] : [-1080, 1080];
      return {
        html: `<div id="${e.dom}" class="clip efx-full" data-start="${a}" data-duration="${d}" style="background: ${P.color}; transform: translateX(${x0}px)"></div>`,
        js: [`tl.fromTo("#${e.dom}", {x: ${x0}}, {x: ${x1}, duration: ${d}, ease: "power2.inOut"}, ${a});`],
      };
    },
    vista: (P, p) => {
      const q = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      const [x0, x1] = P.direccion === "izquierda" ? [1080, -1080] : [-1080, 1080];
      return { capa: { background: P.color, transform: `translateX(${x0 + (x1 - x0) * q}px)` } };
    },
  },
  "desenfoque-entrada": {
    nombre: "Entrada desenfocada", categoria: "transiciones", tipo: "capa", duracion: 0.35,
    descripcion: "El plano entra borroso y se enfoca; suaviza la llegada de un plano nuevo.",
    rasgos: ["blur", "transicion-decorativa"],
    params: { fuerza: { nombre: "Desenfoque (px)", def: 18, tipo: "num", min: 2, max: 60, paso: 1 } },
    capa: (e, P, a, d) => ({
      html: `<div id="${e.dom}" class="clip efx-full" data-start="${a}" data-duration="${d}" style="backdrop-filter: blur(${P.fuerza}px)"></div>`,
      js: [`tl.fromTo("#${e.dom}", {backdropFilter: "blur(${P.fuerza}px)"}, {backdropFilter: "blur(0px)", duration: ${d}, ease: "power2.out"}, ${a});`],
    }),
    vista: (P, p) => ({ capa: { backdropFilter: `blur(${P.fuerza * (1 - facil(p))}px)` } }),
  },
  "blanco-negro": {
    nombre: "Blanco y negro", categoria: "efectos", tipo: "capa", duracion: 2,
    descripcion: "Quita el color durante un tramo (recuerdo, contraste, momento serio).",
    rasgos: ["color"],
    params: { cantidad: { nombre: "Cantidad", def: 1, tipo: "num", min: 0.1, max: 1, paso: 0.05 } },
    capa: (e, P, a, d) => ({
      html: `<div id="${e.dom}" class="clip efx-full" data-start="${a}" data-duration="${d}" style="backdrop-filter: grayscale(${P.cantidad})"></div>`,
      js: [],
    }),
    vista: (P) => ({ capa: { backdropFilter: `grayscale(${P.cantidad})` } }),
  },
  vineta: {
    nombre: "Viñeta", categoria: "efectos", tipo: "capa", duracion: 3,
    descripcion: "Oscurece los bordes para llevar la mirada al centro; entra y sale con fundido.",
    rasgos: [],
    params: { intensidad: { nombre: "Intensidad", def: 0.55, tipo: "num", min: 0.1, max: 1, paso: 0.05 } },
    capa: (e, P, a, d) => {
      const f = r3(Math.min(0.3, d / 3));
      return {
        html: `<div id="${e.dom}" class="clip efx-full" data-start="${a}" data-duration="${d}" style="background: radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,${P.intensidad}) 100%); opacity: 0"></div>`,
        js: [`tl.fromTo("#${e.dom}", {opacity: 0}, {opacity: 1, duration: ${f}, ease: "power1.out"}, ${a});`,
          `tl.to("#${e.dom}", {opacity: 0, duration: ${f}, ease: "power1.in"}, ${r3(a + d - f)});`],
      };
    },
    vista: (P, p, d) => {
      const f = Math.min(0.3, d / 3) / d;
      return { capa: { background: `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,${P.intensidad}) 100%)`, opacity: p < f ? p / f : p > 1 - f ? (1 - p) / f : 1 } };
    },
  },
  "texto-golpe": {
    nombre: "Palabra grande", categoria: "textos", tipo: "capa", duracion: 1.2,
    descripcion: "Una palabra o cifra grande que aparece en el centro para remarcar una idea.",
    rasgos: (P) => (P.entrada === "golpe" ? ["texto-grande", "pop"] : ["texto-grande"]),
    params: {
      texto: { nombre: "Texto", def: "Palabra", tipo: "texto" },
      y: { nombre: "Centro Y (px)", def: 760, tipo: "num", min: 0, max: 1920, paso: 10 },
      tamano: { nombre: "Tamaño (px)", def: 120, tipo: "num", min: 40, max: 260, paso: 2 },
      entrada: { nombre: "Entrada", def: "fundido", tipo: "opcion", opciones: ["fundido", "golpe"] },
    },
    capa: (e, P, a, d, ctx) => {
      const ent = P.entrada === "golpe"
        ? `tl.fromTo("#${e.dom} > span", {opacity: 0, scale: 0.6}, {opacity: 1, scale: 1, duration: 0.18, ease: "back.out(2)"}, ${a});`
        : `tl.fromTo("#${e.dom} > span", {opacity: 0, y: 12}, {opacity: 1, y: 0, duration: 0.2, ease: "power2.out"}, ${a});`;
      return {
        html: `<div id="${e.dom}" class="clip efx-texto" data-start="${a}" data-duration="${d}" style="top: ${P.y - P.tamano}px; height: ${P.tamano * 2}px"><span style="font-size: ${P.tamano}px">${esc(P.texto)}</span></div>`,
        js: [ent, `tl.to("#${e.dom} > span", {opacity: 0, duration: 0.12, ease: "power2.in"}, ${r3(a + d - 0.12)});`],
      };
    },
    // caja aproximada para revisar la zona segura (0,6 em por carácter)
    caja: (P) => {
      const w = Math.min(960, String(P.texto).length * P.tamano * 0.6);
      return { x0: 540 - w / 2, x1: 540 + w / 2, y0: P.y - P.tamano * 0.6, y1: P.y + P.tamano * 0.6 };
    },
    vista: (P, p, d) => {
      const t = p * d;
      const o = t < 0.2 ? t / 0.2 : t > d - 0.12 ? (d - t) / 0.12 : 1;
      const s = P.entrada === "golpe" && t < 0.18 ? 0.6 + 0.4 * facil(t / 0.18) : 1;
      return { texto: { texto: P.texto, y: P.y, tamano: P.tamano, opacity: o, transform: `scale(${s})` } };
    },
  },
  "zoom-golpe": {
    nombre: "Zoom de golpe", categoria: "cortes", tipo: "cuadro", duracion: 0.8,
    descripcion: "Acercamiento casi instantáneo que se mantiene; marca el remate como un corte de plano.",
    rasgos: ["zoom", "pop"],
    params: { escala: { nombre: "Escala", def: 1.15, tipo: "num", min: 1.02, max: 1.6, paso: 0.01 }, origen: { nombre: "Origen", def: "50% 40%", tipo: "texto" } },
    cuadro: (e, P, a, d) => [
      `tl.fromTo("#fx", {scale: 1, transformOrigin: "${P.origen}"}, {scale: ${P.escala}, duration: 0.08, ease: "power3.out", immediateRender: false}, ${a});`,
      `tl.set("#fx", {scale: 1}, ${r3(a + d)});`,
    ],
    vista: (P, p, d) => ({ cuadro: { transformOrigin: P.origen, transform: `scale(${1 + (P.escala - 1) * Math.min(1, (p * d) / 0.08)})` } }),
  },
  sacudida: {
    nombre: "Sacudida", categoria: "efectos", tipo: "cuadro", duracion: 0.3,
    descripcion: "Temblor corto del cuadro para un impacto.",
    rasgos: ["shake"],
    params: { fuerza: { nombre: "Fuerza (px)", def: 14, tipo: "num", min: 2, max: 60, paso: 1 } },
    cuadro: (e, P, a, d) => {
      const pasos = Math.max(2, Math.round(d / 0.04)), js = [];
      let x = 0, y = 0;
      for (let i = 0; i < pasos; i++) {
        const k = P.fuerza * (1 - i / pasos), nx = r3((i % 2 ? -1 : 1) * k * 0.9), ny = r3(((i * 7) % 3 - 1) * k * 0.6);
        js.push(`tl.fromTo("#fx, #fondos", {x: ${x}, y: ${y}}, {x: ${nx}, y: ${ny}, duration: 0.04, ease: "none", immediateRender: false}, ${r3(a + i * 0.04)});`);
        x = nx; y = ny;
      }
      js.push(`tl.set("#fx, #fondos", {x: 0, y: 0}, ${r3(a + d)});`);
      return js;
    },
    vista: (P, p, d) => {
      const i = Math.floor((p * d) / 0.04), pasos = Math.max(2, Math.round(d / 0.04)), k = P.fuerza * (1 - i / pasos);
      return { cuadro: { transform: `translate(${(i % 2 ? -1 : 1) * k * 0.9}px, ${((i * 7) % 3 - 1) * k * 0.6}px)` } };
    },
  },
};

export function parametros(e) {
  const R = RECETAS[e.receta];
  const P = {};
  if (!R) return { ...(e.params ?? {}) };
  for (const [k, def] of Object.entries(R.params)) P[k] = e.params?.[k] ?? def.def;
  return P;
}
export function rasgosDe(e) {
  const R = RECETAS[e.receta];
  if (!R) return [];
  return typeof R.rasgos === "function" ? R.rasgos(parametros(e)) : R.rasgos;
}

// Para generar.mjs: devuelve {capa: {html[], js[]}, cuadro: js[]}
export function construirEfectos(lista) {
  const capa = { html: [], js: [] }, cuadro = [];
  lista.forEach((e, i) => {
    const R = RECETAS[e.receta];
    if (!R) throw new Error(`efecto "${e.id}": receta desconocida "${e.receta}"`);
    const P = parametros(e), a = r3(e.inicio), d = r3(e.fin - e.inicio);
    const x = { ...e, dom: `efx-${i}-${String(e.id).replace(/[^\w-]/g, "-")}` };
    if (R.tipo === "capa") {
      const c = R.capa(x, P, a, d);
      capa.html.push("    " + c.html);
      capa.js.push(...c.js.map((l) => "  " + l));
    } else cuadro.push(...R.cuadro(x, P, a, d).map((l) => "      " + l));
  });
  return { capa, cuadro };
}

// Para el editor: estilos aproximados en el instante t (coordenadas de la escena 1080×1920).
export function vistaEfecto(e, t) {
  const R = RECETAS[e.receta];
  if (!R?.vista) return {};
  const d = Math.max(0.01, e.fin - e.inicio);
  return R.vista(parametros(e), Math.min(1, Math.max(0, (t - e.inicio) / d)), d);
}
