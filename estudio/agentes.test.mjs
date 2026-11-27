// Pruebas de la fase 1: agente, modelo y esfuerzo. Uso: node --test estudio/
import assert from "node:assert/strict";
import { test } from "node:test";
import { argsDe, catalogo, coincideModelo, diagnosticar, validarEleccion } from "./agentes.mjs";

const cat = catalogo();

test("Claude recibe --model y --effort al final", () => {
  const a = argsDe("claude", { modelo: "opus", esfuerzo: "high" }, cat);
  assert.deepEqual(a.slice(-4), ["--model", "opus", "--effort", "high"]);
});

test("Codex recibe -m y -c antes del «-» que lee el prompt", () => {
  const id = cat.agentes.codex.modelos.find((m) => m.id && !m.no_disponible && !cat.agentes.codex.rechazados[m.id])?.id;
  if (!id) return; // sin caché de modelos de Codex en este equipo
  const a = argsDe("codex", { modelo: id, esfuerzo: "high" }, cat);
  assert.equal(a.at(-1), "-");
  assert.deepEqual(a.slice(-5, -1), ["-m", id, "-c", "model_reasoning_effort=high"]);
});

test("Gemini recibe -m y no admite esfuerzo", () => {
  assert.deepEqual(argsDe("gemini", { modelo: "gemini-2.5-pro" }, cat).slice(-2), ["-m", "gemini-2.5-pro"]);
  assert.throws(() => validarEleccion("gemini", { modelo: "", esfuerzo: "high" }, cat), /no permite elegir el esfuerzo/);
});

test("vacío = configuración del CLI (sin flags extra)", () => {
  assert.equal(argsDe("claude", { modelo: "", esfuerzo: "" }, cat).includes("--model"), false);
});

test("rechaza valores con caracteres de shell o fuera del catálogo", () => {
  assert.throws(() => validarEleccion("claude", { modelo: "opus & del" }, cat), /no válidos/);
  assert.throws(() => validarEleccion("claude", { modelo: "inventado" }, cat), /no tiene el modelo/);
  assert.throws(() => validarEleccion("claude", { modelo: "opus", esfuerzo: "turbo" }, cat), /no admite el esfuerzo/);
  assert.throws(() => validarEleccion("nadie", {}, cat), /agente desconocido/);
});

test("modelo marcado como no disponible no se puede elegir", () => {
  const c = structuredClone(cat);
  c.agentes.claude.modelos.find((m) => m.id === "haiku").no_disponible = { motivo: "prueba" };
  assert.throws(() => validarEleccion("claude", { modelo: "haiku" }, c), /rechazó/);
});

test("alias frente a nombre completo", () => {
  assert.equal(coincideModelo("opus", "claude-opus-5-5"), true);
  assert.equal(coincideModelo("haiku", "claude-haiku-5-5"), true);
  assert.equal(coincideModelo("opus", "claude-sonnet-5-5"), false);
  assert.equal(coincideModelo("", "claude-sonnet-5-5"), true);
});

test("diagnóstico de errores reales de los CLI", () => {
  assert.equal(diagnosticar("claude", "Failed to authenticate: OAuth session expired and could not be refreshed").tipo, "sesion");
  assert.equal(diagnosticar("codex", `✗ {"error":{"message":"The 'gpt-6.2-sol' model is not supported when using Codex with a ChatGPT account.","code":"model_not_found"}}`).tipo, "modelo");
  assert.equal(diagnosticar("gemini", "IneligibleTierError: This client is no longer supported for Gemini Code Assist for individuals").tipo, "cuenta");
  assert.equal(diagnosticar("claude", "✔ terminado"), null);
});
