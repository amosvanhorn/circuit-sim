/** Copy / paste selection */

import { cloneComponentData } from "./components.js";

let clipboard = null;

export function hasClipboard() {
  return clipboard !== null && clipboard.components.length > 0;
}

export function copySelection(board, selectedIds) {
  const ids = new Set(selectedIds);
  if (!ids.size) return false;

  const components = board.components
    .filter((c) => ids.has(c.id))
    .map((c) => cloneComponentData(c));

  const wires = board.wires
    .filter((w) => ids.has(w.from.compId) && ids.has(w.to.compId))
    .map((w) => ({
      from: { ...w.from },
      to: { ...w.to },
    }));

  if (!components.length) return false;

  let minX = Infinity;
  let minY = Infinity;
  for (const c of components) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
  }

  clipboard = { components, wires, originX: minX, originY: minY };
  board.pasteCount = 0;
  return true;
}

export function pasteClipboard(board, baseX = 40, baseY = 40) {
  if (!hasClipboard()) return [];

  const n = board.pasteCount ?? 0;
  const dx = baseX + n * 24;
  const dy = baseY + n * 24;
  const idMap = new Map();
  const newIds = [];

  board.recordHistory();
  board._suppressHistory = true;

  for (const src of clipboard.components) {
    const x = src.x - clipboard.originX + dx;
    const y = src.y - clipboard.originY + dy;
    const c = board.addComponent(src.type, x, y, {
      state: structuredClone(src.state),
    });
    idMap.set(src.id, c.id);
    newIds.push(c.id);
  }

  for (const w of clipboard.wires) {
    const fromId = idMap.get(w.from.compId);
    const toId = idMap.get(w.to.compId);
    if (fromId && toId) {
      board.addWire(fromId, w.from.pinId, toId, w.to.pinId);
    }
  }

  board._suppressHistory = false;
  board.pasteCount = n + 1;
  return newIds;
}
