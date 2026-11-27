// Adaptadores de agentes: Claude Code, Codex y Gemini con la misma interfaz.
// El prompt siempre va por stdin (nunca en la línea de comandos), así el texto del creador no pasa por el shell.
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const EST = dirname(fileURLToPath(import.meta.url));
const leer = (p, d = null) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return d; } };
const RUTA_NO_DISP = join(EST, "modelos-no-disponibles.json");

// Sandbox de Codex (workspace-write): escribe solo en el proyecto, más lo que las herramientas necesitan.
// - Red: npx baja hyperframes@0.9.5 y el creador puede pedir descargar imágenes.
// - Caché de npm y carpeta temporal: npx y ffmpeg escriben ahí.
// - Windows: el sandbox «elevated» corre como otro usuario (CodexSandboxOnline) que no puede leer
//   %LOCALAPPDATA%\Microsoft\WinGet, donde está ffmpeg; «unelevated» usa tu usuario con permisos recortados.
function permisosCodex() {
  const comillas = (p) => `"${p}"`; // el CLI se lanza con shell: true
  let cache = join(process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"), "npm-cache");
  try { const r = spawnSync("npm", ["config", "get", "cache"], { shell: true, windowsHide: true, encoding: "utf8", timeout: 10000 }); if (r.status === 0 && r.stdout.trim()) cache = r.stdout.trim(); } catch {}
  return [
    "-c", "sandbox_workspace_write.network_access=true",
    ...(process.platform === "win32" ? ["-c", "windows.sandbox=unelevated"] : []),
    "--add-dir", comillas(cache), "--add-dir", comillas(tmpdir()),
  ];
}

export const AGENTES = {
  claude: {
    nombre: "Claude Code",
    comando: "claude",
    // acceptEdits: puede editar archivos; Bash solo para las herramientas del proyecto.
    args: ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits",
      "--allowedTools", '"Bash(node:*)"', '"Bash(npx:*)"', '"Bash(ffmpeg:*)"', '"Bash(ffprobe:*)"', "Read", "Write", "Edit", "Glob", "Grep", "Task"],
    skills: true,
  },
  codex: {
    nombre: "Codex",
    comando: "codex",
    args: ["exec", "--skip-git-repo-check", "-s", "workspace-write", ...permisosCodex(), "--json", "-"],
    skills: false,
  },
  gemini: {
    nombre: "Gemini",
    comando: "gemini",
    args: ["-p", '"Sigue las instrucciones recibidas por la entrada estándar."', "--approval-mode", "auto_edit", "--skip-trust", "-o", "stream-json"],
    skills: false,
  },
};

// ---------- modelos y esfuerzo ----------
// Catálogo editable (estudio/modelos.json). Codex añade los modelos visibles de tu cuenta (~/.codex/models_cache.json).
// Los modelos que el CLI rechazó (p. ej. "no disponible con tu cuenta") se recuerdan en modelos-no-disponibles.json.
export function catalogo() {
  const c = leer(join(EST, "modelos.json"), {});
  const noDisp = leer(RUTA_NO_DISP, {});
  const salida = { nombres_esfuerzo: c.nombres_esfuerzo ?? {}, recomendado: c.recomendado ?? {}, agentes: {} };
  for (const id of Object.keys(AGENTES)) {
    const a = c[id] ?? { modelos: [{ id: "", nombre: "El de tu configuración" }], esfuerzos: [], flags: {} };
    let modelos = [...(a.modelos ?? [])];
    let esfuerzos = [...(a.esfuerzos ?? [])];
    if (a.modelos_desde === "codex_cache") {
      const cache = leer(join(process.env.CODEX_HOME || join(homedir(), ".codex"), "models_cache.json"), {});
      for (const m of cache.models ?? []) {
        if (m.visibility !== "list" || modelos.some((x) => x.id === m.slug)) continue;
        modelos.push({ id: m.slug, nombre: m.display_name ?? m.slug, esfuerzos: (m.supported_reasoning_levels ?? []).map((r) => r.effort ?? r) });
      }
      const todos = new Set(modelos.flatMap((m) => m.esfuerzos ?? []));
      if (todos.size) esfuerzos = [...todos];
    }
    modelos = modelos.map((m) => (noDisp[id]?.[m.id] ? { ...m, no_disponible: noDisp[id][m.id] } : m));
    salida.agentes[id] = { modelos, rechazados: noDisp[id] ?? {}, esfuerzos, flags: a.flags ?? {}, confirma_modelo: !!a.confirma_modelo, por_defecto_cli: modeloConfigurado(id) };
  }
  return salida;
}

// Recomendado para una tarea: { modelo, esfuerzo }.
export function recomendado(tarea, agente, cat = catalogo()) {
  return cat.recomendado?.[tarea]?.[agente] ?? cat.recomendado?._todas?.[agente] ?? { modelo: "", esfuerzo: "" };
}

// Modelo que el CLI usa si no se le pasa ninguno (solo informativo).
export function modeloConfigurado(id) {
  try {
    if (id === "codex") {
      const t = readFileSync(join(process.env.CODEX_HOME || join(homedir(), ".codex"), "config.toml"), "utf8");
      const top = t.split(/^\[/m)[0];
      return { modelo: /^model\s*=\s*"([^"]+)"/m.exec(top)?.[1] ?? "", esfuerzo: /^model_reasoning_effort\s*=\s*"([^"]+)"/m.exec(top)?.[1] ?? "" };
    }
    if (id === "claude") {
      const s = leer(join(homedir(), ".claude", "settings.json"), {});
      return { modelo: s.model ?? "", esfuerzo: s.effortLevel ?? "" };
    }
    if (id === "gemini") {
      const s = leer(join(homedir(), ".gemini", "settings.json"), {});
      return { modelo: s.model?.name ?? (typeof s.model === "string" ? s.model : ""), esfuerzo: "" };
    }
  } catch {}
  return { modelo: "", esfuerzo: "" };
}

// Valida lo elegido contra el catálogo. Devuelve { modelo, esfuerzo } limpios o lanza un error explicado.
export function validarEleccion(id, { modelo = "", esfuerzo = "" } = {}, cat = catalogo()) {
  const a = cat.agentes[id];
  if (!a) throw new Error(`agente desconocido: ${id}`);
  modelo = String(modelo ?? ""); esfuerzo = String(esfuerzo ?? "");
  const SEGURO = /^[\w.\-]*$/; // nada que el shell pueda interpretar
  if (!SEGURO.test(modelo) || !SEGURO.test(esfuerzo)) throw new Error("modelo o esfuerzo con caracteres no válidos");
  const def = a.por_defecto_cli?.modelo;
  if (!modelo && def && a.rechazados?.[def]) throw new Error(`Tu configuración de ${AGENTES[id].nombre} usa «${def}», que tu cuenta rechazó. Elige un modelo en el selector.`);
  if (modelo && a.rechazados?.[modelo]) throw new Error(`${AGENTES[id].nombre} rechazó «${modelo}» antes: ${a.rechazados[modelo].motivo} Elige otro modelo o pruébalo de nuevo en Cuentas.`);
  const m = a.modelos.find((x) => x.id === modelo);
  if (!m) throw new Error(`${AGENTES[id].nombre} no tiene el modelo «${modelo}» en el catálogo (estudio/modelos.json).`);
  if (m.no_disponible) throw new Error(`${AGENTES[id].nombre} rechazó «${modelo}» antes: ${m.no_disponible.motivo}. Elige otro modelo o pruébalo de nuevo en Cuentas.`);
  if (esfuerzo) {
    const permitidos = m.esfuerzos ?? a.esfuerzos;
    if (!a.flags.esfuerzo) throw new Error(`${AGENTES[id].nombre} no permite elegir el esfuerzo.`);
    if (!permitidos.includes(esfuerzo)) throw new Error(`«${modelo || "este modelo"}» no admite el esfuerzo «${esfuerzo}».`);
  }
  return { modelo, esfuerzo };
}

// Argumentos del CLI para un agente con modelo y esfuerzo ya validados.
export function argsDe(id, eleccion = {}, cat = catalogo()) {
  const { modelo, esfuerzo } = validarEleccion(id, eleccion, cat);
  const f = cat.agentes[id].flags;
  const extra = [
    ...(modelo && f.modelo ? f.modelo.map((x) => x.replace("{m}", modelo)) : []),
    ...(esfuerzo && f.esfuerzo ? f.esfuerzo.map((x) => x.replace("{e}", esfuerzo)) : []),
  ];
  const base = [...AGENTES[id].args];
  // Codex lee el prompt de "-" (último argumento): las opciones van antes.
  if (base.at(-1) === "-") base.splice(base.length - 1, 0, ...extra); else base.push(...extra);
  return base;
}

// Modelo que el CLI dice estar usando (Claude: evento system/init y mensajes del asistente).
export function modeloInformado(linea) {
  const t = linea.trim();
  if (!t.startsWith("{")) return null;
  try {
    const e = JSON.parse(t);
    if (e.type === "system" && e.subtype === "init" && e.model) return e.model;
    if (e.type === "init" && e.model) return e.model; // Gemini stream-json
  } catch {}
  return null;
}

// ¿Lo que pidió el creador coincide con lo que confirmó el CLI? Los alias (opus) se comparan por contenido.
export function coincideModelo(pedido, confirmado) {
  if (!pedido || !confirmado) return true;
  const p = pedido.toLowerCase(), c = confirmado.toLowerCase();
  return c === p || c.includes(p);
}

// Errores conocidos de cuenta o modelo → qué pasó y cómo arreglarlo.
export function diagnosticar(id, texto) {
  const t = String(texto ?? "");
  if (/model_not_found|model_not_in_accessible_catalog|is not supported when using|unknown model|invalid model|model .* (not found|does not exist)|There's an issue with the selected model/i.test(t))
    return { tipo: "modelo", mensaje: "Tu cuenta no tiene acceso a ese modelo.", arreglo: "Elige otro modelo en el selector (o «El de tu configuración»)." };
  if (/OAuth session expired|Failed to authenticate|not logged in|run \/login|Invalid API key|Please run .*login|401/i.test(t))
    return { tipo: "sesion", mensaje: `${AGENTES[id]?.nombre ?? id} no tiene la sesión iniciada.`, arreglo: "Abre Cuentas y pulsa «Conectar»; cuando termines, «Probar»." };
  if (/IneligibleTier|UNSUPPORTED_CLIENT|no longer supported for Gemini Code Assist/i.test(t))
    return { tipo: "cuenta", mensaje: "Gemini no acepta esta cuenta con el CLI.", arreglo: "Crea una clave en Google AI Studio y guárdala como variable GEMINI_API_KEY (Cuentas explica cómo), o usa otro agente." };
  if (/rate limit|usage limit|quota|429/i.test(t))
    return { tipo: "limite", mensaje: "Llegaste al límite de uso de tu cuenta.", arreglo: "Espera a que se renueve o usa otro agente." };
  return null;
}

export function marcarNoDisponible(id, modelo, motivo) {
  if (!modelo) return;
  const d = leer(RUTA_NO_DISP, {});
  (d[id] ??= {})[modelo] = { motivo: String(motivo).slice(0, 200), fecha: new Date().toISOString() };
  writeFileSync(RUTA_NO_DISP, JSON.stringify(d, null, 2));
}
export function quitarNoDisponible(id, modelo) {
  const d = leer(RUTA_NO_DISP, {});
  if (d[id]?.[modelo]) { delete d[id][modelo]; writeFileSync(RUTA_NO_DISP, JSON.stringify(d, null, 2)); }
}

// Tokens y costo que informa cada CLI al terminar.
export function consumoDe(linea) {
  const t = linea.trim();
  if (!t.startsWith("{")) return null;
  let e; try { e = JSON.parse(t); } catch { return null; }
  // Claude: result.usage · Codex: turn.completed.usage · Gemini: result.stats
  const u = e.type === "result" || e.type === "turn.completed" ? e.usage ?? e.stats : null;
  if (!u) return null;
  const cache = u.cache_read_input_tokens ?? u.cached_input_tokens ?? u.cached ?? 0;
  // Codex cuenta lo cacheado dentro de input_tokens; Claude lo cuenta aparte.
  const entrada = (u.input_tokens ?? u.input ?? 0) + (u.cache_creation_input_tokens ?? 0) - (e.type === "turn.completed" ? cache : 0);
  const salida = u.output_tokens ?? u.output ?? 0;
  return { entrada, cache, salida, tokens: u.total_tokens ?? entrada + cache + salida, costo: e.total_cost_usd ?? null };
}

const instalado = new Map();
export function disponible(id) {
  if (!instalado.has(id)) {
    const r = spawnSync(process.platform === "win32" ? "where" : "which", [AGENTES[id].comando], { encoding: "utf8" });
    instalado.set(id, r.status === 0);
  }
  return instalado.get(id);
}

// Convierte una línea de salida (JSON o texto) en algo legible.
export function legible(linea) {
  const t = linea.trim();
  if (!t) return null;
  if (!t.startsWith("{")) return t;
  let e;
  try { e = JSON.parse(t); } catch { return t; }
  // Claude stream-json
  if (e.type === "assistant" && e.message?.content) {
    return e.message.content.map((c) =>
      c.type === "text" ? c.text :
      c.type === "tool_use" ? `🛠 ${c.name}: ${resumenHerramienta(c.input)}` : null).filter(Boolean).join("\n") || null;
  }
  if (e.type === "result") return `✔ ${e.subtype === "success" ? "terminado" : e.subtype}${e.total_cost_usd ? ` · $${e.total_cost_usd.toFixed(3)}` : ""}`;
  if (e.type === "user" || e.type === "system") return null;
  // Codex --json
  const it = e.item ?? e.msg;
  if (it) {
    if (it.type === "agent_message" || it.type === "assistant_message") return it.text ?? it.message ?? null;
    if (it.type === "command_execution" && e.type?.endsWith("started")) return `🛠 ${it.command}`;
    if (it.type === "file_change") return `✎ ${(it.changes ?? []).map((c) => c.path).join(", ")}`;
    if (it.type === "reasoning") return null;
  }
  // Gemini stream-json
  if (e.type === "message" && e.role !== "user") return e.content ?? null;
  if (e.type === "tool_use") return `🛠 ${e.tool_name ?? e.name}: ${resumenHerramienta(e.parameters ?? e.args)}`;
  if (e.type === "error") return `✗ ${e.message ?? JSON.stringify(e)}`;
  return null;
}
function resumenHerramienta(i) {
  if (!i) return "";
  return String(i.command ?? i.file_path ?? i.path ?? i.pattern ?? i.description ?? JSON.stringify(i)).slice(0, 160);
}

// Tipo de una línea legible del agente, para el chat del Estudio.
export const tipoAgente = (l) => (/Failed to authenticate|OAuth session expired|not logged in|IneligibleTier|run \/login|API key|model_not_found|not supported when using/i.test(l) ? "error" : /^🛠|^✎/.test(l) ? "paso" : /^· /.test(l) ? "proceso" : /^✔ (terminado|\w)/.test(l) && l.length < 60 ? "estado" : /^✗/.test(l) ? "error" : "agente");

// Lanza el agente. onLinea(texto) recibe salida legible; devuelve una promesa con el código de salida.
// modelo/esfuerzo: lo que eligió el creador ("" = lo de su configuración). Se pasan tal cual; nunca se cambian en silencio.
export function ejecutarAgente(id, prompt, { cwd, onLinea, onProceso, onConsumo, onModelo, modelo = "", esfuerzo = "", env = {} }) {
  const a = AGENTES[id];
  if (!a) throw new Error(`agente desconocido: ${id}`);
  if (!disponible(id)) throw new Error(`${a.nombre} no está instalado (no encuentro "${a.comando}" en PATH)`);
  const args = argsDe(id, { modelo, esfuerzo });
  return new Promise((resolve) => {
    // Cada agente arranca completo: sus skills, herramientas y MCP; el modelo y el esfuerzo son los elegidos.
    const p = spawn(a.comando, args, { cwd, shell: true, windowsHide: true, env: { ...process.env, ...env, FORCE_COLOR: "0", NO_COLOR: "1" } });
    onProceso?.(p);
    let resto = "";
    let informado = false;
    const trocear = (buf) => {
      resto += buf.toString("utf8");
      const lineas = resto.split(/\r?\n/);
      resto = lineas.pop();
      for (const l of lineas) {
        if (!informado) { const m = modeloInformado(l); if (m) { informado = true; onModelo?.(m); } }
        const c = consumoDe(l); if (c) onConsumo?.(c); const x = legible(l); if (x) onLinea(x);
      }
    };
    p.stdout.on("data", trocear);
    // Ruido conocido de los CLI (MCP sin sesión, avisos de skills duplicadas) no se muestra.
    const ruido = /rmcp::transport|Skill conflict detected|Ripgrep is not available|^\s*at /;
    p.stderr.on("data", (b) => { for (const l of b.toString("utf8").split(/\r?\n/)) if (l.trim() && !ruido.test(l)) onLinea(`· ${l}`); });
    p.on("error", (err) => { onLinea(`✗ ${err.message}`); resolve(1); });
    p.on("close", (code) => { if (resto) { const c = consumoDe(resto); if (c) onConsumo?.(c); const x = legible(resto); if (x) onLinea(x); } resolve(code ?? 1); });
    p.stdin.end(prompt);
  });
}
