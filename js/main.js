import { Board, buildPalette, setupBoardDrop } from "./board.js";
import {
  resetSignals,
  stepSimulation,
  createParticleSystem,
  updateParticles,
} from "./simulation.js";
import { History } from "./history.js";
import { copySelection, pasteClipboard, hasClipboard } from "./clipboard.js";
import {
  downloadCircuit,
  pickAndLoadCircuit,
  saveToLocalStorage,
  loadFromLocalStorage,
} from "./persistence.js";
import { loadSample, buildSamplesMenu } from "./samples.js";
import { ProbeTool } from "./probe.js";
import { Oscilloscope } from "./scope.js";
import { hideTooltip } from "./tooltip.js";

const boardEl = document.getElementById("board");
const wiresSvg = document.getElementById("wires");
const particlesSvg = document.getElementById("particles");
const paletteEl = document.getElementById("palette");
const statusEl = document.getElementById("status");

const board = new Board(boardEl, wiresSvg, particlesSvg, () => {
  if (running) syncSimulation();
  scheduleAutosave();
});

const history = new History();
let running = false;
let lastTime = 0;
let particleSys = createParticleSystem();
const speedInput = document.getElementById("speed");
let autosaveTimer = null;
let activeTool = "edit";

const probe = new ProbeTool(document.getElementById("probe-panel"));
const scope = new Oscilloscope(document.getElementById("scope-panel"));
scope.onTracesChange = () => {
  board.setScopeWireIds(scope.traces.map((t) => t.wireId));
};

board.onProbePin = (compId, pinId) => {
  probe.probePin(compId, pinId, board.components);
};
board.onProbeWire = (wireId) => {
  probe.probeWire(wireId, board.components, board.wires);
};
board.onScopeWire = (wireId) => {
  scope.toggleWire(wireId, board.components, board.wires);
  board.setScopeWireIds(scope.traces.map((t) => t.wireId));
};

board.setHistoryCallback((snap) => {
  history.push(snap);
  updateUndoRedoButtons();
});
board.setWireStatusCallback((msg) => {
  statusEl.textContent = msg;
});

function clearHistory() {
  history.clear();
  updateUndoRedoButtons();
}

updateUndoRedoButtons();
statusEl.textContent =
  "Drag from pin to pin to wire · drag component body to move";

buildPalette(paletteEl, board);
setupBoardDrop(boardEl, board);

function setActiveTool(mode) {
  activeTool = activeTool === mode ? "edit" : mode;
  board.setToolMode(activeTool);
  document.getElementById("btn-probe").classList.toggle("active", activeTool === "probe");
  document.getElementById("btn-scope").classList.toggle("active", activeTool === "scope");
  hideTooltip();
  if (activeTool === "probe") {
    statusEl.textContent = "Probe — click a pin or wire to read HIGH/LOW";
  } else if (activeTool === "scope") {
    statusEl.textContent = "Scope — click wires to trace signals (max 4)";
  } else if (!running) {
    statusEl.textContent =
      "Paused — drag pin to pin to wire · drag body to move";
  }
}

document.getElementById("btn-probe").addEventListener("click", () => setActiveTool("probe"));
document.getElementById("btn-scope").addEventListener("click", () => setActiveTool("scope"));

const sampleHintEl = document.getElementById("sample-hint");
buildSamplesMenu(document.getElementById("sample-select"), (sampleId) => {
  if (running) stopSimulation();
  if (
    board.components.length > 0 &&
    !confirm("Load sample circuit? Current board will be replaced.")
  ) {
    return;
  }
  try {
    const sample = loadSample(board, sampleId);
    clearHistory();
    board.pasteCount = 0;
    particleSys = createParticleSystem();
    statusEl.textContent = `Loaded: ${sample.name} — ${sample.blurb}`;
    sampleHintEl.textContent = sample.blurb;
  } catch (err) {
    statusEl.textContent = `Sample failed: ${err.message}`;
  }
});

function initDemo() {
  board._suppressHistory = true;
  board.clear({ silent: true });
  const bat = board.addComponent("battery", 80, 200);
  const res = board.addComponent("resistor", 220, 208);
  const led = board.addComponent("led", 380, 192);
  board.wires = [];
  board.addWire(bat.id, "out", res.id, "a");
  board.addWire(res.id, "b", led.id, "in");
  board._suppressHistory = false;
  clearHistory();
  board.selectOnly(null);
}

function loadDefaultCircuit() {
  try {
    const sample = loadSample(board, "full-adder");
    clearHistory();
    board.pasteCount = 0;
    sampleHintEl.textContent = sample.blurb;
    statusEl.textContent = `Loaded: ${sample.name} — toggle switches for inputs`;
    board.selectOnly(null);
  } catch (err) {
    initDemo();
    statusEl.textContent = "Could not load default circuit — showing starter demo";
  }
}

if (!loadFromLocalStorage(board)) {
  loadDefaultCircuit();
} else {
  clearHistory();
  statusEl.textContent = "Restored last autosaved circuit";
}

document.getElementById("btn-undo").addEventListener("click", () => undo());
document.getElementById("btn-redo").addEventListener("click", () => redo());

document.getElementById("btn-run").addEventListener("click", () => {
  if (running) stopSimulation();
  else startSimulation();
});

function startSimulation() {
  running = true;
  board.setSimulationLocked(true);
  paletteEl.classList.add("sim-locked");
  const btn = document.getElementById("btn-run");
  btn.textContent = "⏸ Pause";
  btn.classList.toggle("primary", false);
  for (const c of board.components) {
    if (c.type === "battery") c.simRunning = true;
    if (c.type === "clock") c.state = { elapsed: 0, tick: 0 };
  }
  statusEl.textContent = "Simulation running — use buttons & switches; pause to edit";
  updateUndoRedoButtons();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function stopSimulation() {
  running = false;
  board.setSimulationLocked(false);
  paletteEl.classList.remove("sim-locked");
  const btn = document.getElementById("btn-run");
  btn.textContent = "▶ Run";
  btn.classList.toggle("primary", true);
  for (const c of board.components) {
    if (c.type === "battery") c.simRunning = false;
  }
  syncSimulation();
  statusEl.textContent =
    "Paused — drag pin to pin to wire · drag body to move";
  updateUndoRedoButtons();
}

document.getElementById("btn-reset").addEventListener("click", () => {
  stopSimulation();
  resetSignals(board.components);
  particleSys = createParticleSystem();
  particlesSvg.innerHTML = "";
  board.applyWireStates(new Map());
  board.updateAllVisuals();
  statusEl.textContent = "Simulation reset";
});

document.getElementById("btn-clear").addEventListener("click", () => {
  if (!confirm("Clear the entire board?")) return;
  board.clear();
  particleSys = createParticleSystem();
  stopSimulation();
  board.pasteCount = 0;
});

document.getElementById("btn-save").addEventListener("click", () => {
  downloadCircuit(board);
  statusEl.textContent = "Circuit downloaded as circuit.json";
});

document.getElementById("btn-load").addEventListener("click", async () => {
  try {
    const ok = await pickAndLoadCircuit(board);
    if (ok) {
      stopSimulation();
      clearHistory();
      particleSys = createParticleSystem();
      statusEl.textContent = "Circuit loaded";
    }
  } catch (err) {
    statusEl.textContent = `Load failed: ${err.message}`;
  }
});

document.getElementById("btn-new").addEventListener("click", () => {
  if (!confirm("Start a new blank board? Unsaved changes will be lost.")) return;
  initDemo();
  statusEl.textContent = "New board";
});

boardEl.addEventListener("mousemove", (e) => board.onMouseMove(e));
window.addEventListener("mouseup", (e) => board.onMouseUp(e));

document.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;
  const tag = e.target.tagName;

  if (mod && e.key === "z" && !e.shiftKey) {
    e.preventDefault();
    undo();
    return;
  }
  if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
    e.preventDefault();
    redo();
    return;
  }
  if (mod && e.key === "c" && tag !== "INPUT") {
    e.preventDefault();
    if (copySelection(board, board.getSelectedIds())) {
      statusEl.textContent = `Copied ${board.getSelectedIds().length} part(s)`;
    }
    return;
  }
  if (mod && e.key === "v" && tag !== "INPUT") {
    e.preventDefault();
    if (running) {
      statusEl.textContent = "Pause simulation to paste parts";
      return;
    }
    if (!hasClipboard()) {
      statusEl.textContent = "Nothing to paste — copy a selection first";
      return;
    }
    const ids = pasteClipboard(board, 48, 48);
    board.selectedIds = new Set(ids);
    board.highlightSelection();
    statusEl.textContent = `Pasted ${ids.length} part(s)`;
    return;
  }
  if (mod && e.key === "a" && tag !== "INPUT") {
    e.preventDefault();
    board.selectedIds = new Set(board.components.map((c) => c.id));
    board.highlightSelection();
    return;
  }
  if (mod && e.key === "s") {
    e.preventDefault();
    downloadCircuit(board);
    saveToLocalStorage(board);
    statusEl.textContent = "Saved to file and autosave";
    return;
  }

  if (
    (e.key === "Delete" || e.key === "Backspace") &&
    tag !== "INPUT"
  ) {
    e.preventDefault();
    if (running) {
      statusEl.textContent = "Pause simulation to delete parts";
      return;
    }
    board.removeSelected();
  }
  if (e.code === "Space" && tag !== "INPUT") {
    e.preventDefault();
    for (const c of board.components) {
      if (c.type === "button") board.setButtonPressed(c.id, true);
    }
    if (running) syncSimulation();
  }
  if (e.key === "Escape") {
    if (activeTool !== "edit") {
      setActiveTool(activeTool);
    } else {
      board.cancelWire();
    }
  }
  if (e.key === "p" && tag !== "INPUT") {
    setActiveTool("probe");
  }
  if (e.key === "o" && tag !== "INPUT") {
    setActiveTool("scope");
  }
});

document.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    for (const c of board.components) {
      if (c.type === "button") board.setButtonPressed(c.id, false);
    }
    if (running) syncSimulation();
  }
});

function undo() {
  const snap = history.undo(board.getSnapshot());
  if (!snap) return;
  board.loadSnapshot(snap);
  updateUndoRedoButtons();
  statusEl.textContent = "Undo";
}

function redo() {
  const snap = history.redo(board.getSnapshot());
  if (!snap) return;
  board.loadSnapshot(snap);
  updateUndoRedoButtons();
  statusEl.textContent = "Redo";
}

function updateUndoRedoButtons() {
  document.getElementById("btn-undo").disabled =
    running || !history.canUndo();
  document.getElementById("btn-redo").disabled =
    running || !history.canRedo();
}

function syncSimulation() {
  const speed = parseFloat(speedInput.value);
  const states = stepSimulation(board.components, board.wires, {
    running: false,
    speed,
  });
  board.applyWireStates(states);
  board.updateAllVisuals();
  probe.refresh(board.components, board.wires);
}

function loop(now) {
  if (!running) return;
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  const speed = parseFloat(speedInput.value);
  const states = stepSimulation(board.components, board.wires, {
    running: true,
    dt,
    speed,
  });
  board.applyWireStates(states);
  board.updateAllVisuals();

  updateParticles(
    particleSys,
    board.wires,
    states,
    board.components,
    dt,
    speed
  );
  board.drawParticles(particleSys.particles);
  probe.refresh(board.components, board.wires);
  if (scope.hasTraces()) {
    scope.sample(board.components, board.wires, dt);
  }

  requestAnimationFrame(loop);
}

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => saveToLocalStorage(board), 800);
}

