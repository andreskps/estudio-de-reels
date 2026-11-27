// Pruebas de la fase 3: esquema de brand.json y perfiles creados desde el asistente. Uso: node --test estudio/marca.test.mjs
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ESTILOS_SUBTITULO, FUENTES_OFL, fusionarPropuesta, idDesdeNombre, marcaDesdeAsistente, OPCIONES_NUNCA, textoMarca, validarMarca } from "../herramientas/marca-esquema.mjs";
import { archivarPerfil, crearPerfil, fijarActivo, guardarMarca, listaPerfiles, resolverPerfil } from "../herramientas/perfiles.mjs";

const leer = (rel) => JSON.parse(readFileSync(new URL(`../${rel}`, import.meta.url), "utf8"));
const EJEMPLO = leer("perfiles/ejemplo/brand.json");
const respuestas = (extra = {}) => ({ nombre: "Lucía Cocina", plataformas: ["instagram", "tiktok"], fuente: { familia: "Poppins" },
  colores: { principal: "#ffffff", acento: "#ff5a36", contorno: "#1a1a1a" }, estilo: "limpio", nunca: OPCIONES_NUNCA.filter((o) => o.defecto).map((o) => o.id), ...extra });

test("las marcas de la base pasan el esquema", () => {
  if (existsSync(new URL("../marca/brand.json", import.meta.url))) assert.deepEqual(validarMarca(leer("marca/brand.json")), []);
  assert.deepEqual(validarMarca(EJEMPLO), []);
});

test("el esquema rechaza lo que rompería las herramientas", () => {
  const roto = (f) => { const b = structuredClone(EJEMPLO); f(b); return validarMarca(b); };
  assert.match(roto((b) => { b.colores.principal = "blanco"; }).join(), /colores\.principal/);
  assert.match(roto((b) => { delete b.fuentes.subtitulos; }).join(), /fuentes\.subtitulos/);
  assert.match(roto((b) => { b.subtitulos.ancho_max_px = 1000; }).join(), /no cabe en la zona segura/);
  assert.match(roto((b) => { b.subtitulos.centro_y_px = 1500; }).join(), /fuera de la zona segura/);
  assert.match(roto((b) => { b.subtitulos.resaltado = { modo: "palabra", color: null }; b.colores.acento = null; }).join(), /resaltado/);
  assert.match(roto((b) => { b.fuentes.titulos.archivo = "../../secreto.ttf"; }).join(), /dentro del perfil/);
  assert.match(roto((b) => { b.creador.plataformas = ["myspace"]; }).join(), /plataforma desconocida/);
  assert.match(roto((b) => { b.subtitulos.tamano_minimo_px = 90; }).join(), /tamano_minimo_px/);
  assert.ok(validarMarca(null).length > 0);
});

test("el asistente arma una marca válida con cada estilo y cada fuente OFL", () => {
  for (const e of ESTILOS_SUBTITULO) for (const f of FUENTES_OFL) {
    const b = marcaDesdeAsistente(respuestas({ estilo: e.id, fuente: { familia: f.familia } }), EJEMPLO);
    assert.deepEqual(validarMarca(b), [], `${e.id} + ${f.familia}`);
    assert.ok(f.pesos.includes(b.fuentes.subtitulos.peso), `${f.familia}: peso ${b.fuentes.subtitulos.peso} existe`);
  }
  const r = marcaDesdeAsistente(respuestas({ estilo: "resaltado" }), EJEMPLO);
  assert.equal(r.subtitulos.resaltado.modo, "palabra");
  assert.equal(r.subtitulos.resaltado.color, "#FF5A36");
  assert.equal(marcaDesdeAsistente(respuestas({ estilo: "mayusculas" }), EJEMPLO).subtitulos.mayusculas, true);
  assert.equal(marcaDesdeAsistente(respuestas({ estilo: "caja" }), EJEMPLO).subtitulos.caja, true);
  assert.equal(EJEMPLO.subtitulos.caja, false, "no toca la base");
});

test("las casillas «Nunca» llegan a la marca y a los rasgos prohibidos", () => {
  const b = marcaDesdeAsistente(respuestas({ nunca: ["flash", "sfx", "emojis"] }), EJEMPLO);
  assert.ok(b.nunca.includes("flashes") && b.nunca.includes("emojis o stickers"));
  assert.deepEqual(b.animaciones.rasgos_prohibidos, ["flash"]);
  assert.equal(b.audio.sfx, false);
  const libre = marcaDesdeAsistente(respuestas({ nunca: [] }), EJEMPLO);
  assert.equal(libre.audio.sfx, true);
  assert.deepEqual(libre.animaciones.rasgos_prohibidos, []);
  assert.match(textoMarca(b), /## Nunca[\s\S]*Flashes\./);
});

test("utilidades: id desde el nombre y propuestas parciales", () => {
  assert.equal(idDesdeNombre("Lucía Cocina!"), "lucia-cocina");
  const f = fusionarPropuesta(EJEMPLO, { subtitulos: { tamano_base_px: 70 }, inventada: 1, version_esquema: 9 });
  assert.equal(f.subtitulos.tamano_base_px, 70);
  assert.equal(f.subtitulos.ancho_max_px, EJEMPLO.subtitulos.ancho_max_px);
  assert.ok(!("inventada" in f));
  assert.equal(f.version_esquema, 1);
});

function proyecto() {
  const raiz = mkdtempSync(join(tmpdir(), "estudio-marca-"));
  mkdirSync(join(raiz, "perfiles", "ejemplo", "mis-reels"), { recursive: true });
  mkdirSync(join(raiz, "perfiles", "ejemplo", "logo"), { recursive: true });
  writeFileSync(join(raiz, "perfiles", "ejemplo", "brand.json"), JSON.stringify(EJEMPLO));
  writeFileSync(join(raiz, "perfiles", "ejemplo", "logo", "logo.png"), "png");
  writeFileSync(join(raiz, "perfiles", "ejemplo", "mis-reels", "reel.mp4"), "original");
  mkdirSync(join(raiz, "marca"));
  writeFileSync(join(raiz, "perfiles", "indice.json"), JSON.stringify({ activo: "andres", perfiles: [
    { id: "andres", nombre: "Andres", ruta: "marca" }, { id: "ejemplo", nombre: "Ejemplo", ruta: "perfiles/ejemplo" }] }));
  return raiz;
}
const conRaiz = (fn) => { const raiz = proyecto(); try { fn(raiz); } finally { rmSync(raiz, { recursive: true, force: true }); } };

test("crear y duplicar un perfil: copia la marca, nunca los reels propios ni un id existente", () => conRaiz((raiz) => {
  const p = crearPerfil({ id: "lucia", nombre: "Lucía", desde: "ejemplo" }, raiz);
  assert.equal(p.ruta, "perfiles/lucia");
  assert.ok(existsSync(join(raiz, "perfiles", "lucia", "brand.json")));
  assert.ok(existsSync(join(raiz, "perfiles", "lucia", "logo", "logo.png")));
  assert.deepEqual(readdirSync(join(raiz, "perfiles", "lucia", "mis-reels")), [".gitkeep"]);
  assert.equal(readFileSync(join(raiz, "perfiles", "ejemplo", "mis-reels", "reel.mp4"), "utf8"), "original");
  const dup = crearPerfil({ id: "lucia-2", nombre: "Lucía 2", desde: "lucia" }, raiz);
  assert.equal(dup.desde, "lucia");
  assert.throws(() => crearPerfil({ id: "lucia", nombre: "x" }, raiz), /Ya existe/);
  assert.throws(() => crearPerfil({ id: "Mal Id", nombre: "x" }, raiz), /minúsculas/);
  assert.throws(() => crearPerfil({ id: "otro", nombre: "x", desde: "nadie" }, raiz), /No existe/);
  mkdirSync(join(raiz, "perfiles", "suelta"));
  assert.throws(() => crearPerfil({ id: "suelta", nombre: "x" }, raiz), /ya existe/);
}));

test("archivar oculta el perfil sin borrarlo y protege el activo", () => conRaiz((raiz) => {
  crearPerfil({ id: "lucia", nombre: "Lucía" }, raiz);
  assert.throws(() => archivarPerfil("andres", true, raiz), /perfil activo/);
  archivarPerfil("lucia", true, raiz);
  assert.ok(!listaPerfiles(raiz).some((p) => p.id === "lucia"));
  assert.ok(listaPerfiles(raiz, { archivados: true }).some((p) => p.id === "lucia"));
  assert.ok(existsSync(join(raiz, "perfiles", "lucia", "brand.json")));
  assert.equal(resolverPerfil({ raiz, id: "lucia" }).id, "lucia", "los reels del perfil archivado siguen funcionando");
  assert.throws(() => fijarActivo("lucia", raiz), /No existe/);
  archivarPerfil("lucia", false, raiz);
  assert.equal(fijarActivo("lucia", raiz).id, "lucia");
}));

test("guardar marca valida antes de escribir y deja la anterior en historial/", () => conRaiz((raiz) => {
  crearPerfil({ id: "lucia", nombre: "Lucía" }, raiz);
  const b = marcaDesdeAsistente(respuestas(), EJEMPLO);
  const malo = structuredClone(b); malo.colores.principal = "rojo";
  assert.throws(() => guardarMarca("lucia", malo, null, raiz), /no es válida[\s\S]*colores\.principal/);
  assert.deepEqual(JSON.parse(readFileSync(join(raiz, "perfiles", "lucia", "brand.json"), "utf8")), EJEMPLO, "lo inválido no se escribe");
  guardarMarca("lucia", b, textoMarca(b), raiz);
  assert.equal(JSON.parse(readFileSync(join(raiz, "perfiles", "lucia", "brand.json"), "utf8")).creador.nombre, "Lucía Cocina");
  assert.ok(readdirSync(join(raiz, "perfiles", "lucia", "historial")).some((f) => f.endsWith("brand.json")));
  assert.match(readFileSync(join(raiz, "perfiles", "lucia", "brand.md"), "utf8"), /# Marca de Lucía Cocina/);
}));

test("tamaño de subtítulos del asistente (Pequeño / Mediano / Grande)", () => {
  assert.equal(marcaDesdeAsistente(respuestas({ tamano: 72 }), EJEMPLO).subtitulos.tamano_base_px, 72);
  assert.equal(marcaDesdeAsistente(respuestas({ tamano: 72, estilo: "mayusculas" }), EJEMPLO).subtitulos.tamano_base_px, 60);
  assert.equal(marcaDesdeAsistente(respuestas(), EJEMPLO).subtitulos.tamano_base_px, EJEMPLO.subtitulos.tamano_base_px);
  assert.deepEqual(validarMarca(marcaDesdeAsistente(respuestas({ tamano: 56 }), EJEMPLO)), []);
});
