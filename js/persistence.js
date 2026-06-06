/** Save / load circuits as JSON */

import { COMPONENT_TYPES } from "./components.js";

const FORMAT_VERSION = 1;

export function exportCircuit(board) {
  return {
    version: FORMAT_VERSION,
    savedAt: new Date().toISOString(),
    components: board.components.map((c) => ({
      id: c.id,
      type: c.type,
      x: c.x,
      y: c.y,
      state: c.state ?? {},
    })),
    wires: board.wires.map((w) => ({
      id: w.id,
      from: { ...w.from },
      to: { ...w.to },
    })),
  };
}

export function importCircuit(data, board) {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid circuit file");
  }
  if (!Array.isArray(data.components) || !Array.isArray(data.wires)) {
    throw new Error("Circuit file is missing components or wires");
  }
  for (const c of data.components) {
    if (!c.type || !COMPONENT_TYPES[c.type]) {
      throw new Error(`Unknown component type: ${c.type}`);
    }
  }
  board.loadFromData(data);
  return true;
}

export function downloadCircuit(board, filename = "circuit.json") {
  const json = JSON.stringify(exportCircuit(board), null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function pickAndLoadCircuit(board) {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(false);
        return;
      }
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        importCircuit(data, board);
        resolve(true);
      } catch (err) {
        reject(err);
      }
    };
    input.click();
  });
}

export function saveToLocalStorage(board, key = "circuit-sim-autosave") {
  try {
    localStorage.setItem(key, JSON.stringify(exportCircuit(board)));
    return true;
  } catch {
    return false;
  }
}

export function loadFromLocalStorage(board, key = "circuit-sim-autosave") {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    importCircuit(JSON.parse(raw), board);
    return true;
  } catch {
    return false;
  }
}
