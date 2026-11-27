// Esquema de brand.json: validación, opciones del asistente de marca y armado de la marca desde sus respuestas.
// Sin dependencias de Node: lo usan las herramientas, el servidor del Estudio y el navegador (/herramientas/marca-esquema.mjs).

export const VERSION_ESQUEMA = 1;
export const PLATAFORMAS = ["instagram", "tiktok", "shorts"];

// Fuentes OFL incluidas en HyperFrames (se resuelven por nombre al renderizar, sin archivo).
// `pesos`: los que trae la familia; `titulos`: peso por defecto de títulos y tarjetas.
export const FUENTES_OFL = [
  { familia: "Montserrat", pesos: [400, 500, 600, 700, 800, 900], subtitulos: 800, titulos: 800, tipo: "geométrica, todoterreno" },
  { familia: "Inter", pesos: [400, 500, 600, 700, 800, 900], subtitulos: 700, titulos: 800, tipo: "neutra, muy legible" },
  { familia: "Poppins", pesos: [400, 500, 600, 700, 800, 900], subtitulos: 700, titulos: 800, tipo: "redonda, amable" },
  { familia: "Outfit", pesos: [400, 500, 600, 700, 800, 900], subtitulos: 700, titulos: 800, tipo: "moderna, limpia" },
  { familia: "Nunito", pesos: [400, 600, 700, 800, 900], subtitulos: 800, titulos: 900, tipo: "redondeada, cercana" },
  { familia: "Lato", pesos: [400, 700, 900], subtitulos: 900, titulos: 900, tipo: "clásica, seria" },
  { familia: "Oswald", pesos: [400, 500, 600, 700], subtitulos: 600, titulos: 700, tipo: "condensada, impacto" },
  { familia: "League Gothic", pesos: [400], subtitulos: 400, titulos: 400, tipo: "muy condensada, titulares" },
  { familia: "Archivo Black", pesos: [400], subtitulos: 400, titulos: 400, tipo: "gruesa, contundente" },
  { familia: "Playfair Display", pesos: [400, 500, 600, 700, 800, 900], subtitulos: 700, titulos: 800, tipo: "serif, elegante" },
];

// Estilos de subtítulo del asistente. `aplicar` recibe la marca y la modifica.
export const ESTILOS_SUBTITULO = [
  { id: "limpio", nombre: "Frase limpia", descripcion: "Texto con contorno y sombra suave, sin adornos.",
    aplicar: (b) => Object.assign(b.subtitulos, { mayusculas: false, caja: false, resaltado: { modo: "ninguno", color: null, escala: 1 } }) },
  { id: "resaltado", nombre: "Palabra resaltada", descripcion: "Una palabra clave de cada frase en el color de acento.",
    aplicar: (b) => Object.assign(b.subtitulos, { mayusculas: false, caja: false, resaltado: { modo: "palabra", color: b.colores.acento ?? "#FFD43B", escala: 1.06 } }) },
  { id: "caja", nombre: "Con caja", descripcion: "Texto sobre una caja oscura redondeada; se lee sobre cualquier fondo.",
    aplicar: (b) => Object.assign(b.subtitulos, { mayusculas: false, caja: true, contorno_px: 0, resaltado: { modo: "ninguno", color: null, escala: 1 } }) },
  { id: "mayusculas", nombre: "Mayúsculas", descripcion: "Todo en mayúsculas, más compacto y con más presencia.",
    aplicar: (b) => Object.assign(b.subtitulos, { mayusculas: true, caja: false, tamano_base_px: Math.min(b.subtitulos.tamano_base_px, 60), resaltado: { modo: "ninguno", color: null, escala: 1 } }) },
];

// Casillas «Nunca» del asistente. `texto` va a brand.nunca; `rasgos` a animaciones.rasgos_prohibidos
// (mismos nombres que herramientas/efectos.mjs); `aplicar` ajusta otras claves.
export const OPCIONES_NUNCA = [
  { id: "emojis", texto: "emojis o stickers", defecto: true },
  { id: "texto-cara", texto: "texto sobre la cara", defecto: true },
  { id: "transiciones", texto: "transiciones decorativas (wipes, barridos)", rasgos: ["wipe", "transicion-decorativa"], defecto: true },
  { id: "flash", texto: "flashes", rasgos: ["flash"], defecto: true },
  { id: "sacudidas", texto: "sacudidas, rebotes o glitch", rasgos: ["shake", "rebote", "glitch"], defecto: true },
  { id: "zoom-golpe", texto: "zooms de golpe (solo zooms suaves)", rasgos: ["pop"], defecto: true },
  { id: "sfx", texto: "efectos de sonido (SFX)", aplicar: (b, si) => { b.audio.sfx = !si; }, defecto: true },
  { id: "logo", texto: "logo en pantalla", aplicar: (b, si) => { if (si) b.logo.posicion = "ninguna"; }, defecto: true },
  { id: "musica", texto: "música de fondo (salvo que el reel la pida)", aplicar: (b, si) => { b.audio.musica = si ? "solo si se pide en el reel" : "permitida, a −20 dB bajo la voz"; }, defecto: true },
  { id: "mayusculas", texto: "TODO EN MAYÚSCULAS", defecto: false },
];

const HEX = /^#[0-9a-f]{6}$/i;
const COLOR = /^(#[0-9a-f]{6}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/i;
const esNum = (v) => typeof v === "number" && Number.isFinite(v);
const tipoDe = (v) => (Array.isArray(v) ? "lista" : v === null ? "nulo" : typeof v);

// Devuelve la lista de errores (vacía = válida). Mensajes en español, con la clave exacta.
export function validarMarca(b) {
  const e = [];
  const ok = (cond, msg) => { if (!cond) e.push(msg); return cond; };
  if (!ok(b && typeof b === "object" && !Array.isArray(b), "brand.json debe ser un objeto")) return e;
  const obj = (k) => ok(b[k] && typeof b[k] === "object" && !Array.isArray(b[k]), `falta «${k}» (objeto)`);
  const num = (v, k, min, max) => ok(esNum(v) && v >= min && v <= max, `«${k}» debe ser un número entre ${min} y ${max} (es ${JSON.stringify(v)})`);
  const str = (v, k) => ok(typeof v === "string" && v.trim().length > 0, `«${k}» debe ser un texto no vacío`);
  const bool = (v, k) => ok(typeof v === "boolean", `«${k}» debe ser true o false`);
  const archivo = (v, k) => ok(v === null || v === undefined || (typeof v === "string" && /^[\p{L}\p{N}_./ -]+$/u.test(v) && !v.split(/[\\/]/).includes("..") && !/^([a-z]:|\/)/i.test(v)), `«${k}» debe ser null o una ruta dentro del perfil`);

  ok(b.version_esquema === undefined || b.version_esquema === VERSION_ESQUEMA, `«version_esquema» debe ser ${VERSION_ESQUEMA}`); // las marcas anteriores al esquema no lo traen
  if (obj("creador")) {
    str(b.creador.nombre, "creador.nombre");
    if (ok(Array.isArray(b.creador.plataformas) && b.creador.plataformas.length > 0, "«creador.plataformas» debe tener al menos una plataforma"))
      for (const p of b.creador.plataformas) ok(PLATAFORMAS.includes(p), `plataforma desconocida «${p}» (usa ${PLATAFORMAS.join(", ")})`);
    ok(/^[a-z]{2}(-[A-Z]{2})?$/.test(b.creador.idioma ?? ""), "«creador.idioma» debe ser un código como «es» o «en»");
  }
  if (obj("video")) { ok(b.video.ancho === 1080 && b.video.alto === 1920, "«video» debe ser 1080×1920"); num(b.video.fps, "video.fps", 24, 60); }
  let z = null;
  if (obj("zona_segura")) {
    z = b.zona_segura;
    num(z.arriba, "zona_segura.arriba", 0, 600); num(z.abajo, "zona_segura.abajo", 0, 900);
    num(z.derecha, "zona_segura.derecha", 0, 300); num(z.izquierda, "zona_segura.izquierda", 0, 300);
  }
  if (obj("colores")) {
    const c = b.colores;
    ok(HEX.test(c.principal ?? ""), "«colores.principal» debe ser un color #RRGGBB");
    ok(HEX.test(c.contorno ?? ""), "«colores.contorno» debe ser un color #RRGGBB");
    ok(c.acento === null || HEX.test(c.acento ?? ""), "«colores.acento» debe ser null o un color #RRGGBB");
    ok(COLOR.test(c.sombra ?? ""), "«colores.sombra» debe ser #RRGGBB o rgba(…)");
    ok(COLOR.test(c.fondo_tarjeta ?? ""), "«colores.fondo_tarjeta» debe ser #RRGGBB o rgba(…)");
  }
  if (obj("fuentes")) for (const k of ["subtitulos", "titulos"]) {
    const f = b.fuentes[k];
    if (!ok(f && typeof f === "object", `falta «fuentes.${k}»`)) continue;
    str(f.familia, `fuentes.${k}.familia`);
    ok(esNum(f.peso) && f.peso >= 100 && f.peso <= 900 && f.peso % 100 === 0, `«fuentes.${k}.peso» debe ser 100, 200… 900`);
    archivo(f.archivo, `fuentes.${k}.archivo`);
    if (f.archivo) ok(/\.(woff2?|ttf|otf)$/i.test(f.archivo), `«fuentes.${k}.archivo» debe ser .woff2, .woff, .ttf u .otf`);
  }
  if (obj("subtitulos")) {
    const s = b.subtitulos;
    ok(Array.isArray(s.palabras_por_grupo) && s.palabras_por_grupo.length === 2 && s.palabras_por_grupo.every((n) => Number.isInteger(n) && n >= 1 && n <= 15) && s.palabras_por_grupo[0] <= s.palabras_por_grupo[1],
      "«subtitulos.palabras_por_grupo» debe ser [mínimo, máximo] entre 1 y 15");
    num(s.lineas_max, "subtitulos.lineas_max", 1, 3);
    bool(s.mayusculas, "subtitulos.mayusculas"); bool(s.caja, "subtitulos.caja");
    num(s.tamano_base_px, "subtitulos.tamano_base_px", 36, 110);
    if (num(s.tamano_minimo_px, "subtitulos.tamano_minimo_px", 30, 110)) ok(s.tamano_minimo_px <= s.tamano_base_px, "«subtitulos.tamano_minimo_px» no puede ser mayor que «tamano_base_px»");
    num(s.contorno_px, "subtitulos.contorno_px", 0, 12);
    if (num(s.ancho_max_px, "subtitulos.ancho_max_px", 300, 1080) && z) ok(s.ancho_max_px <= 1080 - z.izquierda - z.derecha, `«subtitulos.ancho_max_px» (${s.ancho_max_px}) no cabe en la zona segura (máx. ${1080 - z.izquierda - z.derecha})`);
    if (num(s.centro_y_px, "subtitulos.centro_y_px", 0, 1920) && z) ok(s.centro_y_px > z.arriba && s.centro_y_px < 1920 - z.abajo, `«subtitulos.centro_y_px» (${s.centro_y_px}) cae fuera de la zona segura (${z.arriba}–${1920 - z.abajo})`);
    if (ok(s.resaltado && typeof s.resaltado === "object", "falta «subtitulos.resaltado»")) {
      ok(["ninguno", "palabra"].includes(s.resaltado.modo), "«subtitulos.resaltado.modo» debe ser «ninguno» o «palabra»");
      if (s.resaltado.modo === "palabra") {
        ok(HEX.test(s.resaltado.color ?? "") || HEX.test(b.colores?.acento ?? ""), "con «resaltado.modo: palabra» hace falta «resaltado.color» o «colores.acento»");
        num(s.resaltado.escala ?? 1, "subtitulos.resaltado.escala", 1, 1.4);
      }
    }
  }
  if (obj("animaciones")) {
    ok(Array.isArray(b.animaciones.rasgos_prohibidos) && b.animaciones.rasgos_prohibidos.every((x) => typeof x === "string"), "«animaciones.rasgos_prohibidos» debe ser una lista de textos");
    const zp = b.animaciones.zoom_punch_in;
    if (ok(zp && typeof zp === "object", "falta «animaciones.zoom_punch_in»")) { num(zp.escala, "animaciones.zoom_punch_in.escala", 1, 1.5); num(zp.duracion_s, "animaciones.zoom_punch_in.duracion_s", 0.1, 5); }
  }
  if (obj("logo")) { archivo(b.logo.archivo, "logo.archivo"); str(b.logo.posicion, "logo.posicion"); }
  if (obj("audio")) { num(b.audio.lufs, "audio.lufs", -30, -6); num(b.audio.true_peak, "audio.true_peak", -6, 0); bool(b.audio.sfx, "audio.sfx"); }
  ok(Array.isArray(b.nunca) && b.nunca.every((x) => typeof x === "string"), `«nunca» debe ser una lista de textos (es ${tipoDe(b.nunca)})`);
  return e;
}

// Arma un brand.json completo a partir de las respuestas del asistente, partiendo de una marca base
// (la del perfil `ejemplo`, o la del perfil que se duplica). No toca la base: devuelve una copia.
// r = { nombre, usuario?, plataformas[], idioma?, logo?: "logo/x.png", fuente: { familia, peso?, archivo? },
//       colores: { principal, acento, contorno }, estilo: id de ESTILOS_SUBTITULO, nunca: [id de OPCIONES_NUNCA] }
export function marcaDesdeAsistente(r, base) {
  const b = JSON.parse(JSON.stringify(base));
  b.version_esquema = VERSION_ESQUEMA;
  b.estado = `creada con el asistente del Estudio (${new Date().toISOString().slice(0, 10)}); afínala con tus reels cuando quieras`;
  b.creador = { ...b.creador, nombre: String(r.nombre ?? "").trim(), usuario: String(r.usuario ?? "").trim(), plataformas: (r.plataformas ?? []).filter((p) => PLATAFORMAS.includes(p)), idioma: r.idioma || b.creador?.idioma || "es" };
  const f = r.fuente ?? {};
  const ofl = FUENTES_OFL.find((x) => x.familia === f.familia);
  const peso = Number(f.peso) || ofl?.subtitulos || 700;
  const pesoTit = ofl ? Math.max(peso, ofl.titulos) : Math.max(peso, 700);
  b.fuentes = { subtitulos: { familia: f.familia, archivo: f.archivo ?? null, peso }, titulos: { familia: f.familia, archivo: f.archivo ?? null, peso: f.archivo ? peso : pesoTit } };
  const c = r.colores ?? {};
  b.colores = { ...b.colores, principal: (c.principal ?? b.colores.principal).toUpperCase(), acento: c.acento ? c.acento.toUpperCase() : null, contorno: (c.contorno ?? b.colores.contorno).toUpperCase() };
  b.logo = { archivo: r.logo ?? null, posicion: "ninguna" };
  const estilo = ESTILOS_SUBTITULO.find((x) => x.id === r.estilo) ?? ESTILOS_SUBTITULO[0];
  b.subtitulos.tamano_base_px = Number(r.tamano) || base.subtitulos.tamano_base_px; // Pequeño / Mediano / Grande (el estilo Mayúsculas lo limita a 60)
  b.subtitulos.contorno_px = base.subtitulos.contorno_px || 4;
  estilo.aplicar(b);
  b.subtitulos.tamano_minimo_px = Math.min(b.subtitulos.tamano_minimo_px, b.subtitulos.tamano_base_px);
  b.subtitulos.estilo = estilo.id;
  const elegidas = new Set(r.nunca ?? []);
  const rasgos = new Set();
  const nunca = [`más de ${b.subtitulos.lineas_max} líneas de subtítulo en pantalla`];
  for (const o of OPCIONES_NUNCA) {
    const si = elegidas.has(o.id) && !(o.id === "mayusculas" && b.subtitulos.mayusculas);
    if (si) { nunca.push(o.texto); for (const x of o.rasgos ?? []) rasgos.add(x); }
    o.aplicar?.(b, si);
  }
  b.nunca = nunca;
  b.animaciones = { ...b.animaciones, rasgos_prohibidos: [...rasgos] };
  return b;
}

// brand.md legible para el creador y para los agentes (la regla «Nunca» manda ante la referencia).
export function textoMarca(b) {
  const est = ESTILOS_SUBTITULO.find((x) => x.id === b.subtitulos.estilo);
  const f = b.fuentes.subtitulos;
  return `# Marca de ${b.creador.nombre}

${b.creador.tipo ? b.creador.tipo[0].toUpperCase() + b.creador.tipo.slice(1) : "Marca"} · ${b.creador.plataformas.join(", ")}. Creada con el asistente del Estudio; afínala con tus reels (Marca → «Afinar con mis reels») o con \`/marca\`.

## Look
- Fuente: **${f.familia}** (peso ${f.peso})${f.archivo ? ` desde \`${f.archivo}\`` : " — incluida en HyperFrames, licencia OFL"}.
- Colores: texto \`${b.colores.principal}\`, contorno \`${b.colores.contorno}\`${b.colores.acento ? `, acento \`${b.colores.acento}\`` : ", sin acento"}.
- Logo: ${b.logo.archivo ? `\`${b.logo.archivo}\` (no se pone en pantalla salvo que se pida)` : "ninguno"}.

## Subtítulos
- Estilo **${est?.nombre ?? "propio"}**: ${est?.descripcion ?? ""}
- ${b.subtitulos.mayusculas ? "En mayúsculas" : "Tipo frase (mayúscula al inicio y en nombres propios)"}; ${b.subtitulos.caja ? "sobre caja oscura" : `contorno de ${b.subtitulos.contorno_px} px y sombra suave`}${b.subtitulos.resaltado.modo === "palabra" ? `; una palabra clave por frase en \`${b.subtitulos.resaltado.color ?? b.colores.acento}\`` : ""}.
- Máximo ${b.subtitulos.lineas_max} líneas, grupos de ${b.subtitulos.palabras_por_grupo.join("–")} palabras, cortados por frase o pausa. Tamaño ≈ ${b.subtitulos.tamano_base_px} px, centro en y = ${b.subtitulos.centro_y_px} px, siempre dentro de la zona segura.

## Animaciones y ritmo
- ${b.animaciones.filosofia ?? "Edición que acompaña, no compite."}
- Zooms suaves (${b.animaciones.zoom_punch_in.escala}×, entrada y salida ≥ ${b.animaciones.zoom_punch_in.duracion_min_s ?? 0.6} s).

## Sonido
- Audio final a ${b.audio.lufs} LUFS. ${b.audio.sfx ? "SFX permitidos con licencia clara." : "Sin SFX."} Música: ${b.audio.musica}.

## Nunca
${b.nunca.map((x) => `- ${x[0].toUpperCase()}${x.slice(1)}.`).join("\n")}

## Historial de correcciones
- ${new Date().toISOString().slice(0, 10)} — marca creada con el asistente del Estudio.
`;
}

// id de perfil a partir de un nombre («Mi Marca» → «mi-marca»).
export const idDesdeNombre = (n) => String(n ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "marca";

// Fusiona una propuesta parcial (del agente «Afinar con mis reels») sobre una marca, sin claves nuevas de primer nivel.
export function fusionarPropuesta(b, cambios) {
  const out = JSON.parse(JSON.stringify(b));
  const unir = (dst, src) => {
    for (const [k, v] of Object.entries(src ?? {})) {
      if (v && typeof v === "object" && !Array.isArray(v) && dst[k] && typeof dst[k] === "object" && !Array.isArray(dst[k])) unir(dst[k], v);
      else dst[k] = v;
    }
  };
  const permitidas = Object.fromEntries(Object.entries(cambios ?? {}).filter(([k]) => k in out && k !== "version_esquema"));
  unir(out, permitidas);
  return out;
}
