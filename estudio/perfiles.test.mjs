// Pruebas de la fase 2: la marca como perfil. Uso: node --test estudio/perfiles.test.mjs
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { escribirReel, fijarActivo, listaPerfiles, resolverPerfil, rutasMisReels } from "../herramientas/perfiles.mjs";

function proyecto() {
  const raiz = mkdtempSync(join(tmpdir(), "estudio-perfiles-"));
  mkdirSync(join(raiz, "perfiles", "ejemplo"), { recursive: true });
  mkdirSync(join(raiz, "marca"));
  writeFileSync(join(raiz, "perfiles", "indice.json"), JSON.stringify({ activo: "andres", perfiles: [
    { id: "andres", nombre: "Andres", ruta: "marca" }, { id: "ejemplo", nombre: "Ejemplo", ruta: "perfiles/ejemplo" }] }));
  mkdirSync(join(raiz, "reels", "viejo"), { recursive: true });
  mkdirSync(join(raiz, "reels", "nuevo"), { recursive: true });
  return raiz;
}
const conRaiz = (fn) => { const raiz = proyecto(); try { fn(raiz); } finally { rmSync(raiz, { recursive: true, force: true }); } };

test("un reel sin reel.json es del perfil andres (marca/)", () => conRaiz((raiz) => {
  const p = resolverPerfil({ raiz, slug: "viejo" });
  assert.equal(p.id, "andres");
  assert.equal(p.dir, join(raiz, "marca"));
}));

test("reel.json manda sobre el perfil activo y --perfil manda sobre reel.json", () => conRaiz((raiz) => {
  escribirReel("nuevo", { perfil: "ejemplo" }, raiz);
  assert.equal(resolverPerfil({ raiz, slug: "nuevo" }).id, "ejemplo");
  assert.equal(resolverPerfil({ raiz, slug: "nuevo", id: "andres" }).id, "andres");
  assert.throws(() => escribirReel("nuevo", { perfil: "andres" }, raiz), /ya es del perfil/);
  assert.equal(JSON.parse(readFileSync(join(raiz, "reels", "nuevo", "reel.json"), "utf8")).perfil, "ejemplo");
}));

test("sin reel: perfil activo, y cambiarlo no toca los reels", () => conRaiz((raiz) => {
  const antes = process.env.REELS_PERFIL; delete process.env.REELS_PERFIL;
  try {
    assert.equal(resolverPerfil({ raiz }).id, "andres");
    fijarActivo("ejemplo", raiz);
    assert.equal(resolverPerfil({ raiz }).id, "ejemplo");
    assert.equal(resolverPerfil({ raiz, slug: "viejo" }).id, "andres");
    assert.deepEqual(listaPerfiles(raiz).filter((p) => p.activo).map((p) => p.id), ["ejemplo"]);
  } finally { if (antes !== undefined) process.env.REELS_PERFIL = antes; }
}));

test("perfil desconocido o fuera del proyecto se rechaza", () => conRaiz((raiz) => {
  assert.throws(() => resolverPerfil({ raiz, id: "nadie" }), /No existe el perfil/);
  assert.throws(() => fijarActivo("nadie", raiz), /No existe el perfil/);
  writeFileSync(join(raiz, "perfiles", "indice.json"), JSON.stringify({ activo: "malo", perfiles: [{ id: "malo", nombre: "x", ruta: "../afuera" }] }));
  assert.throws(() => resolverPerfil({ raiz }), /fuera del proyecto/);
}));

test("sin indice.json la base sigue funcionando con andres → marca/", () => {
  const raiz = mkdtempSync(join(tmpdir(), "estudio-perfiles-"));
  try { assert.equal(resolverPerfil({ raiz, id: "andres" }).dir, join(raiz, "marca")); }
  finally { rmSync(raiz, { recursive: true, force: true }); }
});

test("mis-reels de todos los perfiles son de solo lectura", () => conRaiz((raiz) => {
  assert.deepEqual(rutasMisReels(raiz), ["marca/mis-reels/", "perfiles/ejemplo/mis-reels/"]);
}));

test("el perfil ejemplo de la base es válido y sin datos personales", () => {
  const b = JSON.parse(readFileSync(new URL("../perfiles/ejemplo/brand.json", import.meta.url), "utf8"));
  // Las claves se comparan con la marca original si está (en una instalación nueva no hay marca/).
  const rutaOriginal = new URL("../marca/brand.json", import.meta.url);
  const andres = existsSync(rutaOriginal) ? JSON.parse(readFileSync(rutaOriginal, "utf8")) : b;
  const claves = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => v && typeof v === "object" && !Array.isArray(v) ? claves(v, `${pre}${k}.`) : [`${pre}${k}`]);
  const faltan = claves(andres).filter((k) => !claves(b).includes(k));
  assert.deepEqual(faltan, [], "el ejemplo tiene todas las claves que leen las herramientas");
  assert.equal(b.creador.nombre, "Tu nombre");
  assert.ok(!JSON.stringify(b).includes("Andres"));
});
