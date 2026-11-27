import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { siguientePaso, huellaVersion, corregirVocabulario, motivoBloqueoRender, pasoAutomatico, creaVersion, TAREAS } from './flujo.mjs';
import { normalizarEdicion, revisarEdicion } from '../herramientas/reglas.mjs';

// La marca del perfil original si existe; en una instalación nueva, la del perfil ejemplo.
const rutaBrand = ["../marca/brand.json", "../perfiles/ejemplo/brand.json"].map((r) => new URL(r, import.meta.url)).find((u) => existsSync(u));
const brand = JSON.parse(readFileSync(rutaBrand, 'utf8'));
const problemas = e => revisarEdicion(normalizarEdicion(e, brand), brand);
test('una entrega antigua no completa una edición nueva', () => {
  const p = siguientePaso({ entrada:true, ultima:'v9', editable:true, entregada:'v5', final:'final-v5.mp4', final_actual:false });
  assert.equal(p.accion, 'accion:validar'); assert.match(p.detalle, /v9.*v5/);
});
test('preparación precede al plan en un proyecto vacío', () => {
  assert.equal(siguientePaso({entrada:true}).accion, 'accion:preparar');
  assert.equal(siguientePaso({entrada:true,transcripcion:true}).accion, 'agente:plan');
});
test('el plan requiere aprobación antes de proponer', () => {
  assert.equal(siguientePaso({entrada:true,transcripcion:true,plan:true}).accion, 'plan');
  assert.equal(siguientePaso({entrada:true,transcripcion:true,plan:true,plan_aprobado:true}).accion, 'agente:proponer');
});
test('una versión exportada propone ver la entrega', () => {
  assert.equal(siguientePaso({entrada:true,ultima:'v4',final_actual:true}).accion, 'entrega');
});
test('todos los intervalos deben terminar dentro del clip', () => {
  for (const tipo of ['subtitulos','tarjetas','fondos','motion','zooms','efectos']) {
    assert.ok(problemas({duracion:10,[tipo]:[{inicio:9,fin:14,texto:'Una frase corta',archivo:'a.mp4',receta:'vineta'}]}).some(p=>p.nivel==='error' && p.tipo===tipo), tipo);
  }
});
test('no se permite escala negativa ni flash prohibido', () => {
  assert.ok(problemas({duracion:10,encuadre:[{inicio:0,escala:-1}]}).some(p=>p.nivel==='error'));
  assert.ok(problemas({duracion:10,efectos:[{inicio:1,fin:1.2,receta:'flash-corte'}]}).some(p=>p.nivel==='error'));
});
test('subtítulo válido conserva sus tiempos', () => {
  const e = {duracion:10,subtitulos:[{inicio:1,fin:3,texto:'Una frase corta'}]};
  assert.equal(problemas(e).filter(p=>p.nivel==='error').length,0);
});
test('vocabulario compuesto conserva el intervalo completo', () => {
  const salida = corregirVocabulario([{text:'Jin',start:1,end:1.2},{text:'Char',start:1.2,end:1.8},{text:'creció',start:2,end:2.5}], {'Jin Char':'Gymshark'});
  assert.deepEqual(salida[0],{id:'w0',text:'Gymshark',start:1,end:1.8});
  assert.equal(salida[1].text,'creció');
});
test('las aprobaciones caducan al cambiar edición o marca', () => {
  const raiz = mkdtempSync(join(tmpdir(),'estudio-flujo-'));
  try {
    mkdirSync(join(raiz,'marca'));
    writeFileSync(join(raiz,'marca','brand.json'),'{}'); writeFileSync(join(raiz,'marca','brand.md'),'Marca');
    const c = join(raiz,'reels','prueba','composicion','v1'); mkdirSync(c,{recursive:true});
    writeFileSync(join(c,'edicion.json'),'{}'); writeFileSync(join(c,'index.html'),'<div id="root"></div>');
    const a = huellaVersion(raiz,'prueba','v1');
    writeFileSync(join(c,'index.html'),'<div id="root" data-hf-id="preview-1"></div>');
    assert.equal(huellaVersion(raiz,'prueba','v1'),a,'la selección de preview no invalida');
    writeFileSync(join(c,'edicion.json'),'{"duracion":10}');
    const b = huellaVersion(raiz,'prueba','v1'); assert.notEqual(a,b);
    writeFileSync(join(raiz,'marca','brand.md'),'Otra marca'); assert.notEqual(huellaVersion(raiz,'prueba','v1'),b);
  } finally { rmSync(raiz,{recursive:true,force:true}); }
});

// ---------- fase 4: flujo guiado con la misma calidad ----------
const editada = (rev, extra = {}) => ({ entrada: true, ultima: 'v2', editable: true, rev, ...extra });
test('después de editar: validar → retención → ver y aprobar → exportar → QA', () => {
  assert.equal(siguientePaso(editada({})).accion, 'accion:validar');
  assert.equal(siguientePaso(editada({ validada: true })).accion, 'agente:retencion');
  const ver = siguientePaso(editada({ validada: true, retencion: true, sugerencias: 3 }));
  assert.equal(ver.accion, 'preview'); assert.match(ver.detalle, /3 sugerencias/);
  assert.equal(siguientePaso(editada({ validada: true, retencion: true, aprobada: true })).accion, 'accion:render');
  assert.equal(siguientePaso(editada({ validada: true, retencion: true, aprobada: true, render: true })).accion, 'accion:qa');
  assert.equal(siguientePaso(editada({ validada: true, retencion: true, aprobada: true, render: true }, { final_actual: true })).accion, 'entrega');
});
test('el render queda bloqueado sin validación, retención y aprobación de esa versión', () => {
  assert.match(motivoBloqueoRender({}), /Valida/);
  assert.match(motivoBloqueoRender({ validada: true }), /retención/);
  assert.match(motivoBloqueoRender({ validada: true, retencion: true }), /apruébala/);
  assert.equal(motivoBloqueoRender({ validada: true, retencion: true, aprobada: true }), null);
});
test('una versión nueva no aparece como entregada por un final viejo', () => {
  const p = siguientePaso(editada({ validada: true, retencion: true, aprobada: true }, { entregada: 'v1', final: 'reels/x/salida/final-v1.mp4', final_actual: false }));
  assert.notEqual(p.accion, 'entrega');
});
test('solo las tareas que editan crean versión; una consulta no', () => {
  assert.deepEqual(Object.keys(TAREAS).filter(creaVersion).sort(), ['corregir', 'proponer']);
  for (const t of ['libre', 'plan', 'retencion', 'referencia', 'describir']) assert.equal(creaVersion(t), false, t);
});
test('sin paradas: avanza solo por los pasos y se detiene donde hace falta el creador', () => {
  assert.equal(pasoAutomatico({ entrada: false }), null, 'sin clip no hay nada que hacer');
  assert.deepEqual(pasoAutomatico({ entrada: true }), { tipo: 'accion', accion: 'preparar' });
  assert.deepEqual(pasoAutomatico({ entrada: true, transcripcion: true }), { tipo: 'agente', tarea: 'plan' });
  assert.deepEqual(pasoAutomatico({ entrada: true, transcripcion: true, plan: true }), { tipo: 'aprobar', que: 'plan' });
  assert.deepEqual(pasoAutomatico({ entrada: true, transcripcion: true, plan: true, plan_aprobado: true }), { tipo: 'agente', tarea: 'proponer' });
  assert.deepEqual(pasoAutomatico(editada({ validada: true })), { tipo: 'agente', tarea: 'retencion' });
  assert.deepEqual(pasoAutomatico(editada({ validada: true, retencion: true })), { tipo: 'aprobar', que: 'preview' });
  assert.deepEqual(pasoAutomatico(editada({ validada: true, retencion: true, aprobada: true })), { tipo: 'accion', accion: 'render' });
  assert.equal(pasoAutomatico(editada({}, { final_actual: true })), null, 'entregado: se detiene');
  assert.equal(pasoAutomatico({ entrada: true, ultima: 'v1', editable: false }).accion, 'migrar');
});
