// Reglas de edición compartidas por generar.mjs, validar.mjs y el Estudio (navegador).
// Sin imports de Node: este archivo también se carga en el navegador.
import { RECETAS, parametros, rasgosDe } from "./efectos.mjs";

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const r3 = (n) => Math.round(n * 1000) / 1000;

// Completa valores por defecto y ordena por tiempo. No cambia el significado de nada.
export function normalizarEdicion(ed, brand) {
  const E = structuredClone(ed ?? {});
  const S = brand?.subtitulos ?? {};
  E.duracion = r3(num(E.duracion));
  E.recorte = !!E.recorte;
  E.posiciones_subtitulo = { normal: S.centro_y_px ?? 1240, alto: 600, ...(E.posiciones_subtitulo ?? {}) };
  E.sin_partir ??= [];
  const ord = (a) => (a ?? []).map((x) => ({ ...x, inicio: r3(num(x.inicio)), fin: r3(num(x.fin, num(x.inicio))) })).sort((a, b) => a.inicio - b.inicio);
  E.subtitulos = ord(E.subtitulos).map((s) => ({ pos: "normal", ...s, texto: String(s.texto ?? "") }));
  E.fondos = ord(E.fondos).map((f, i) => ({ id: f.id || `fondo-${i + 1}`, ...f }));
  E.tarjetas = ord(E.tarjetas).map((t, i) => ({ id: t.id || `tarjeta-${i + 1}`, y: 250, estilo: "blanca", ...t }));
  E.motion = ord(E.motion).map((m, i) => ({ id: m.id || `motion-${i + 1}`, ...m }));
  E.zooms = ord(E.zooms);
  E.efectos = ord(E.efectos).map((e, i) => ({ id: e.id || `efx-${i + 1}`, params: {}, ...e }));
  E.encuadre = (E.encuadre ?? []).map((e) => ({ ...e, inicio: r3(num(e.inicio)) })).sort((a, b) => a.inicio - b.inicio);
  E.audio ??= { musica: null };
  return E;
}

// Estimación del ancho de texto (Montserrat 800 ≈ 0,6 em por carácter). Sirve para avisos en vivo;
// la medición real la hace validar.mjs con el navegador de HyperFrames.
export function estimarLineas(texto, tamano, anchoMax, factor = 0.6) {
  const palabras = String(texto).split(/\s+/).filter(Boolean);
  // 0,6 em avisa de más en algún caso límite; 0,56 dejó pasar uno de 3 líneas (gymshark v8). Mejor avisar de más.
  const porCaracter = tamano * factor; // en MAYÚSCULAS cada letra ocupa más (≈ 0,7 em)
  let lineas = 1, actual = 0;
  for (const p of palabras) {
    const w = (p.length + (actual ? 1 : 0)) * porCaracter;
    if (actual && actual + w > anchoMax) { lineas++; actual = p.length * porCaracter; }
    else actual += w;
  }
  return lineas;
}

export function cajaSubtitulo(s, E, brand) {
  const S = brand.subtitulos;
  const tam = s.tamano ?? S.tamano_base_px;
  const factor = S.mayusculas ? 0.7 : 0.6;
  const lineas = estimarLineas(s.texto, tam, S.ancho_max_px, factor);
  const y = s.y ?? E.posiciones_subtitulo?.[s.pos] ?? S.centro_y_px;
  const alto = lineas * tam * 1.12;
  const largo = Math.max(...String(s.texto).split(/\s+/).map((p) => p.length), 0);
  const ancho = Math.min(S.ancho_max_px, Math.max(largo, lineas > 1 ? 1e9 : String(s.texto).length) * tam * factor);
  return { x0: 540 - ancho / 2, x1: 540 + ancho / 2, y0: y - alto / 2, y1: y + alto / 2, lineas };
}

// Devuelve [{nivel: "error"|"aviso", tipo, indice, mensaje}]
export function revisarEdicion(E, brand) {
  const out = [];
  const z = brand.zona_segura, fps = brand.video?.fps ?? 30, S = brand.subtitulos;
  const D = E.duracion;
  const add = (nivel, tipo, indice, mensaje) => out.push({ nivel, tipo, indice, mensaje });
  if (!(D > 0)) add("error", "general", -1, "duracion debe ser mayor que 0");

  // Todas las pistas comparten los mismos límites temporales.
  for (const tipo of ["subtitulos", "fondos", "tarjetas", "motion", "zooms", "efectos"]) {
    E[tipo].forEach((x, i) => {
      if (x.inicio < 0 || x.fin > D + 0.011 || x.fin <= x.inicio)
        add("error", tipo, i, `${tipo} ${i + 1}: el intervalo debe estar entre 0 y ${D} s`);
    });
  }
  E.encuadre.forEach((x,i) => {
    if (!(x.escala > 0) || x.inicio < 0 || x.inicio >= D)
      add("error", "encuadre", i, `encuadre ${i+1}: usa escala positiva y un tiempo dentro del clip; no se permite invertir al creador`);
  });
  E.subtitulos.forEach((s, i) => {
    const n = `subtítulo ${i + 1} "${s.texto.slice(0, 30)}"`;
    if (!s.texto.trim()) add("error", "subtitulos", i, `${n}: está vacío`);
    if (s.fin <= s.inicio) add("error", "subtitulos", i, `${n}: termina antes de empezar`);
    else if ((s.fin - s.inicio) * fps < 4) add("error", "subtitulos", i, `${n}: dura menos de 4 fotogramas`);
    if (s.inicio < 0 || s.inicio >= D) add("error", "subtitulos", i, `${n}: fuera de la duración del video`);
    const sig = E.subtitulos[i + 1];
    if (sig && s.fin > sig.inicio + 0.001) add("aviso", "subtitulos", i, `${n}: se solapa con el siguiente (se recortará a ${sig.inicio}s)`);
    const c = cajaSubtitulo(s, E, brand);
    // Estimado: es aviso; la medición exacta la hace validar.mjs.
    if (c.lineas > (S.lineas_max ?? 2)) add("aviso", "subtitulos", i, `${n}: podría ocupar ~${c.lineas} líneas (máx. ${S.lineas_max})`);
    if (c.y0 < z.arriba || c.y1 > 1920 - z.abajo) add("error", "subtitulos", i, `${n}: sale de la zona segura (y ${Math.round(c.y0)}–${Math.round(c.y1)})`);
    if (s.texto === s.texto.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{4,}/.test(s.texto)) add("aviso", "subtitulos", i, `${n}: TODO EN MAYÚSCULAS está en la lista "Nunca"`);
  });

  E.tarjetas.forEach((t, i) => {
    const n = `tarjeta "${t.id}"`;
    if (t.fin <= t.inicio) add("error", "tarjetas", i, `${n}: termina antes de empezar`);
    const alto = (t.titulo ? 63 : 0) + (t.texto ? 59 * Math.max(1, estimarLineas(t.texto, 46, 1080 - z.izquierda - z.derecha - 80)) : 0) + 46;
    if (t.y < z.arriba || t.y + alto > 1920 - z.abajo) add("error", "tarjetas", i, `${n}: sale de la zona segura (y ${t.y}–${Math.round(t.y + alto)})`);
  });

  E.fondos.forEach((f, i) => {
    if (!f.archivo) add("error", "fondos", i, `fondo "${f.id}": falta archivo`);
    if (f.fin <= f.inicio) add("error", "fondos", i, `fondo "${f.id}": termina antes de empezar`);
    if (f.fin > D + 0.011) add("aviso", "fondos", i, `fondo "${f.id}": pasa del final del video`);
  });
  E.motion.forEach((m, i) => {
    if (!m.archivo) add("error", "motion", i, `motion "${m.id}": falta archivo`);
    if (m.fin <= m.inicio) add("error", "motion", i, `motion "${m.id}": termina antes de empezar`);
  });

  const zp = brand.animaciones?.zoom_punch_in ?? {};
  if (zp.max_por_video != null && E.zooms.length > zp.max_por_video)
    add("error", "zooms", -1, `hay ${E.zooms.length} zooms; la marca permite ${zp.max_por_video} por video`);
  E.zooms.forEach((zz, i) => {
    if (zz.fin <= zz.inicio) add("error", "zooms", i, `zoom ${i + 1}: termina antes de empezar`);
    if (zp.escala && (zz.escala ?? 1.04) > zp.escala * 1.5) add("aviso", "zooms", i, `zoom ${i + 1}: escala ${zz.escala} muy por encima de la marca (${zp.escala})`);
    if (zp.duracion_min_s && zz.fin - zz.inicio < zp.duracion_min_s) add("aviso", "zooms", i, `zoom ${i + 1}: entra en ${(zz.fin - zz.inicio).toFixed(2)} s; la marca pide zooms suaves (≥ ${zp.duracion_min_s} s)`);
    const sig = E.zooms[i + 1];
    if (sig && sig.inicio < zz.fin + (zz.vuelta ?? 0.6)) add("aviso", "zooms", i, `zoom ${i + 1}: el siguiente empieza antes de que este termine de volver (se cortaría)`);
  });

  const prohibidos = brand.animaciones?.rasgos_prohibidos ?? [];
  E.efectos.forEach((e, i) => {
    const R = RECETAS[e.receta];
    const n = `efecto "${R?.nombre ?? e.receta}" (${e.inicio}s)`;
    if (!R) { add("error", "efectos", i, `${n}: receta desconocida`); return; }
    if (e.fin <= e.inicio) add("error", "efectos", i, `${n}: termina antes de empezar`);
    if (e.inicio < 0 || e.inicio >= D) add("error", "efectos", i, `${n}: fuera de la duración del video`);
    const choca = rasgosDe(e).filter((r) => prohibidos.includes(r));
    if (choca.length) add("error", "efectos", i, `${n}: la marca dice «Nunca» a ${choca.join(", ")} (${brand.animaciones?.transiciones ?? "ver brand.md"})`);
    if (R.caja) {
      const c = R.caja(parametros(e));
      if (c.y0 < z.arriba || c.y1 > 1920 - z.abajo || c.x0 < z.izquierda || c.x1 > 1080 - z.derecha) add("error", "efectos", i, `${n}: el texto sale de la zona segura`);
      const tx = String(parametros(e).texto ?? "");
      if (tx === tx.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{4,}/.test(tx)) add("aviso", "efectos", i, `${n}: TODO EN MAYÚSCULAS está en la lista "Nunca"`);
    }
  });

  if (E.recorte) {
    let t = 0;
    for (const f of E.fondos) {
      if (f.inicio - t > 0.05) add("aviso", "fondos", -1, `sin fondo entre ${t}s y ${f.inicio}s: se verá negro detrás del creador`);
      t = Math.max(t, f.fin);
    }
    if (D - t > 0.05) add("aviso", "fondos", -1, `sin fondo entre ${t}s y ${D}s: se verá negro detrás del creador`);
  }
  return out;
}

// Elementos activos en el instante t (para el visor del Estudio).
export function activosEn(E, t) {
  const en = (x) => x.inicio <= t && t < x.fin;
  const subIdx = E.subtitulos.findIndex((s, i) => s.inicio <= t && t < Math.min(s.fin, E.subtitulos[i + 1]?.inicio ?? Infinity));
  let encuadre = null;
  for (const e of E.encuadre) if (e.inicio <= t) encuadre = e;
  return {
    subtitulo: subIdx >= 0 ? subIdx : null,
    fondo: E.fondos.findLastIndex(en), // si se solapan, gana el último (también queda encima al generar)
    tarjetas: E.tarjetas.map((x, i) => (en(x) ? i : -1)).filter((i) => i >= 0),
    motion: E.motion.map((x, i) => (en(x) ? i : -1)).filter((i) => i >= 0),
    zoom: E.zooms.find(en) ?? null,
    efectos: E.efectos.map((x, i) => (en(x) ? i : -1)).filter((i) => i >= 0),
    encuadre,
  };
}
