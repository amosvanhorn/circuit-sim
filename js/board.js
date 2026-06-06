/** DOM rendering, drag-drop, wiring, snapshots */

import {
  COMPONENT_TYPES,
  createComponent,
  getPinPosition,
  pinCanConnectFrom,
  pinCanConnectTo,
  syncIdCounters,
  allocWireId,
} from "./components.js";
import {
  wirePathPoints,
  pointOnWire,
  pathPointsBetween,
  pathPointsToD,
} from "./simulation.js";
import {
  bindComponentTooltip,
  bindPinTooltip,
  bindPaletteTooltip,
} from "./tooltip.js";

export class Board {
  constructor(boardEl, wiresSvg, particlesSvg, onChange) {
    this.boardEl = boardEl;
    this.wiresSvg = wiresSvg;
    this.particlesSvg = particlesSvg;
    this.onChange = onChange;
    this.onHistory = null;
    this.onWireStatus = null;
    this.components = [];
    this.wires = [];
    this.wireDrag = null;
    this.selectedIds = new Set();
    this.drag = null;
    this.previewSvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    this.previewSvg.setAttribute("class", "wire-preview-layer");
    this.previewSvg.setAttribute("aria-hidden", "true");
    this.boardEl.appendChild(this.previewSvg);
    this.wirePreviewPath = null;
    this._boundWireMove = (e) => this.onWireDragMove(e);
    this._boundWireUp = (e) => this.onWireDragEnd(e);
    this._heldButtonId = null;
    this._boundButtonUp = (e) => this.onButtonMouseUp(e);
    this._pendingSwitchId = null;
    this._switchPressX = 0;
    this._switchPressY = 0;
    this.DRAG_THRESHOLD = 6;
    this.wireStates = new Map();
    this.pasteCount = 0;
    this._suppressHistory = false;
    this.simulationLocked = false;
    this.toolMode = "edit";
    this.probeTarget = null;
    this.scopeWireIds = new Set();
    this.onProbePin = null;
    this.onProbeWire = null;
    this.onScopeWire = null;
  }

  setToolMode(mode) {
    this.toolMode = mode;
    this.boardEl.classList.toggle("tool-probe", mode === "probe");
    this.boardEl.classList.toggle("tool-scope", mode === "scope");
    if (mode !== "probe") this.clearProbeHighlight();
    this.redrawWires(this.wireStates);
  }

  setScopeWireIds(ids) {
    this.scopeWireIds = new Set(ids);
    this.redrawWires(this.wireStates);
  }

  setProbeHighlight(target) {
    this.probeTarget = target;
    this.boardEl.querySelectorAll(".pin.probe-target").forEach((p) => {
      p.classList.remove("probe-target");
    });
    if (target?.kind === "pin") {
      this.getComponentEl(target.compId)
        ?.querySelector(`[data-pin-id="${target.pinId}"]`)
        ?.classList.add("probe-target");
    }
    this.redrawWires(this.wireStates);
  }

  clearProbeHighlight() {
    this.probeTarget = null;
    this.boardEl.querySelectorAll(".pin.probe-target").forEach((p) => {
      p.classList.remove("probe-target");
    });
    this.redrawWires(this.wireStates);
  }

  setSimulationLocked(locked) {
    this.simulationLocked = locked;
    this.boardEl.classList.toggle("sim-running", locked);
    if (locked) {
      this.endWireDrag(false);
      this.drag = null;
      this._pendingSwitchId = null;
      this.onButtonMouseUp();
    }
  }

  setHistoryCallback(fn) {
    this.onHistory = fn;
  }

  setWireStatusCallback(fn) {
    this.onWireStatus = fn;
  }

  recordHistory() {
    if (this._suppressHistory || !this.onHistory) return;
    this.onHistory(this.getSnapshot());
  }

  getSnapshot() {
    return {
      components: this.components.map((c) => ({
        id: c.id,
        type: c.type,
        x: c.x,
        y: c.y,
        state: structuredClone(c.state ?? {}),
      })),
      wires: this.wires.map((w) => ({
        id: w.id,
        from: { ...w.from },
        to: { ...w.to },
      })),
      selectedIds: [...this.selectedIds],
    };
  }

  loadFromData(data) {
    this._suppressHistory = true;
    this.clear({ silent: true });
    syncIdCounters(data.components, data.wires);

    for (const raw of data.components) {
      const c = createComponent(raw.type, raw.x, raw.y, {
        id: raw.id,
        state: raw.state,
      });
      this.components.push(c);
      this.renderComponent(c);
    }

    for (const raw of data.wires) {
      this.wires.push({
        id: raw.id,
        from: { ...raw.from },
        to: { ...raw.to },
      });
    }

    this.selectedIds = new Set(data.selectedIds ?? []);
    this.highlightSelection();
    this.redrawWires();
    this.pasteCount = 0;
    this._suppressHistory = false;
    this.onChange?.();
  }

  loadSnapshot(snap) {
    this.endWireDrag(false);
    this.loadFromData(snap);
  }

  getSelectedIds() {
    return [...this.selectedIds];
  }

  selectOnly(id) {
    this.selectedIds = id ? new Set([id]) : new Set();
    this.highlightSelection();
  }

  toggleSelect(id) {
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
    this.highlightSelection();
  }

  addComponent(type, x, y, opts = {}) {
    if (this.simulationLocked) return null;
    this.recordHistory();
    const c = createComponent(type, x, y, opts);
    this.components.push(c);
    this.renderComponent(c);
    this.onChange?.();
    return c;
  }

  addWire(fromCompId, fromPinId, toCompId, toPinId) {
    if (this.simulationLocked) return null;
    const exists = this.wires.some(
      (w) =>
        w.from.compId === fromCompId &&
        w.from.pinId === fromPinId &&
        w.to.compId === toCompId &&
        w.to.pinId === toPinId
    );
    if (exists) return null;
    this.recordHistory();
    const wire = {
      id: allocWireId(),
      from: { compId: fromCompId, pinId: fromPinId },
      to: { compId: toCompId, pinId: toPinId },
    };
    this.wires.push(wire);
    this.redrawWires();
    this.onChange?.();
    return wire;
  }

  clear(opts = {}) {
    if (!opts.silent && this.simulationLocked) return;
    if (!opts.silent) this.recordHistory();
    this.components = [];
    this.wires = [];
    this.endWireDrag(false);
    this.selectedIds = new Set();
    this.boardEl.querySelectorAll(".component").forEach((el) => el.remove());
    this.redrawWires();
    if (!opts.silent) this.onChange?.();
  }

  removeSelected() {
    if (this.simulationLocked) return;
    if (!this.selectedIds.size) return;
    this.recordHistory();
    const ids = new Set(this.selectedIds);
    this.components = this.components.filter((c) => !ids.has(c.id));
    this.wires = this.wires.filter(
      (w) => !ids.has(w.from.compId) && !ids.has(w.to.compId)
    );
    for (const id of ids) {
      this.boardEl.querySelector(`[data-id="${id}"]`)?.remove();
    }
    this.selectedIds = new Set();
    this.redrawWires();
    this.onChange?.();
  }

  removeWire(wireId) {
    if (this.simulationLocked) return;
    this.recordHistory();
    this.wires = this.wires.filter((w) => w.id !== wireId);
    this.redrawWires();
    this.onChange?.();
  }

  getComponentEl(id) {
    return this.boardEl.querySelector(`[data-id="${id}"]`);
  }

  renderComponent(c) {
    const def = COMPONENT_TYPES[c.type];
    const el = document.createElement("div");
    el.className = `component comp-${c.type}`;
    el.dataset.id = c.id;
    el.style.left = `${c.x}px`;
    el.style.top = `${c.y}px`;
    el.style.width = `${def.width}px`;
    el.style.height = `${def.height}px`;

    const body = document.createElement("div");
    body.className = "comp-body";
    if (c.type === "led") {
      body.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">
        <circle class="led-glow" cx="12" cy="10" r="6" fill="#4a5568"/>
        <rect x="10" y="16" width="4" height="6" fill="#6b7280"/>
      </svg>`;
    } else if (c.type === "dff" || c.type === "srlatch") {
      body.innerHTML = `<span class="ff-label">${def.label}</span><span class="ff-q">Q=${c.state?.q ?? 0}</span>`;
    } else if (c.type === "clock") {
      body.innerHTML = `<span class="clk-label">CLK</span><span class="clk-val">${c.state?.tick ?? 0}</span>`;
    } else if (c.type === "ground") {
      body.innerHTML = `<span class="gnd-symbol" aria-hidden="true"></span><span class="gnd-label">GND</span>`;
    } else {
      body.textContent = def.label;
    }
    this.applyBodyState(body, c);
    bindComponentTooltip(body, c.type);
    el.appendChild(body);

    for (const pin of def.pins) {
      const pinEl = document.createElement("div");
      pinEl.className = `pin ${pin.type}`;
      pinEl.dataset.compId = c.id;
      pinEl.dataset.pinId = pin.id;
      pinEl.style.left = `${pin.x * 100}%`;
      pinEl.style.top = `${pin.y * 100}%`;
      pinEl.title = `${pin.id} (${pin.type})`;
      bindPinTooltip(pinEl, c.type, pin.id, pin.type);
      el.appendChild(pinEl);
    }

    el.addEventListener("mousedown", (e) => this.onComponentMouseDown(e, c));
    el.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      if (this.simulationLocked || c.type === "switch") return;
      const typeDef = COMPONENT_TYPES[c.type];
      if (typeDef.onClick) {
        this.recordHistory();
        typeDef.onClick(c);
        this.updateComponentVisual(c);
        this.onChange?.();
      }
    });

    for (const pinEl of el.querySelectorAll(".pin")) {
      pinEl.addEventListener("mousedown", (e) => this.onPinMouseDown(e, c));
    }

    this.boardEl.appendChild(el);
  }

  applyBodyState(body, c) {
    const isOn =
      (c.type === "switch" && c.state?.closed) ||
      (c.type === "clock" && (c.state?.tick ?? 0) > 0);
    body.classList.toggle("on", isOn);
    body.classList.toggle("pressed", c.type === "button" && c.state?.pressed);
    body.classList.toggle(
      "no-gnd",
      c.type === "button" && c.state?.pressed && !c._grounded
    );
    body.classList.toggle("lit", c.type === "led" && c.state?.lit);
    const qEl = body.querySelector(".ff-q");
    if (qEl && (c.type === "dff" || c.type === "srlatch")) {
      qEl.textContent = `Q=${c.state?.q ?? 0}`;
    }
    const clkVal = body.querySelector(".clk-val");
    if (clkVal && c.type === "clock") {
      clkVal.textContent = String(c.state?.tick ?? 0);
    }
  }

  updateComponentVisual(c) {
    const el = this.getComponentEl(c.id);
    if (!el) return;
    const body = el.querySelector(".comp-body");
    this.applyBodyState(body, c);
    el.style.left = `${c.x}px`;
    el.style.top = `${c.y}px`;

    for (const pinEl of el.querySelectorAll(".pin")) {
      const pinId = pinEl.dataset.pinId;
      const hot =
        (c.outputs[pinId] ?? 0) > 0 || (c.inputs[pinId] ?? 0) > 0;
      pinEl.classList.toggle("hot", hot);
    }
  }

  updateAllVisuals() {
    for (const c of this.components) this.updateComponentVisual(c);
    this.redrawWires();
  }

  onComponentMouseDown(e, c) {
    if (e.target.closest(".pin")) return;
    e.preventDefault();

    if (this.simulationLocked) {
      if (c.type === "button") {
        e.stopPropagation();
        this.setButtonPressed(c.id, true);
        this._heldButtonId = c.id;
        this.onChange?.();
        return;
      }
      if (c.type === "switch" && !e.shiftKey) {
        e.stopPropagation();
        this.armSwitchClick(c.id, e);
        return;
      }
      if (c.type === "switch") {
        return;
      }
      return;
    }

    if (c.type === "button") {
      e.stopPropagation();
      this.setButtonPressed(c.id, true);
      this._heldButtonId = c.id;
      this.onChange?.();
      return;
    }

    if (c.type === "switch" && !e.shiftKey) {
      e.stopPropagation();
      this.armSwitchClick(c.id, e);
      return;
    }

    if (e.shiftKey) {
      this.toggleSelect(c.id);
    } else if (!this.selectedIds.has(c.id)) {
      this.selectOnly(c.id);
    }

    const rect = this.boardEl.getBoundingClientRect();
    const positions = new Map();
    for (const id of this.selectedIds) {
      const comp = this.components.find((x) => x.id === id);
      if (comp) {
        positions.set(id, { x: comp.x, y: comp.y });
      }
    }

    this.drag = {
      positions,
      offsetX: e.clientX - rect.left - c.x,
      offsetY: e.clientY - rect.top - c.y,
      anchorId: c.id,
      moved: false,
      snapshot: this.getSnapshot(),
      startClientX: e.clientX,
      startClientY: e.clientY,
    };
  }

  onPinMouseDown(e, c) {
    e.stopPropagation();
    e.preventDefault();
    const pinEl = e.target.closest(".pin");
    if (!pinEl) return;
    const pinId = pinEl.dataset.pinId;
    const def = COMPONENT_TYPES[c.type];
    const pinDef = def.pins.find((p) => p.id === pinId);
    if (!pinDef) return;

    if (this.toolMode === "probe") {
      this.onProbePin?.(c.id, pinId);
      this.setProbeHighlight({ kind: "pin", compId: c.id, pinId });
      return;
    }

    if (this.simulationLocked) return;
    this.startWireDrag(c, pinId);
  }

  startWireDrag(comp, pinId) {
    this.endWireDrag(false);
    const start = { compId: comp.id, pinId };
    const startPos = getPinPosition(comp, pinId);
    this.wireDrag = { start, startPos };
    this.highlightWireStart(start);
    this.ensureWirePreview();
    this.updateWirePreview(startPos.x, startPos.y, startPos.x, startPos.y);
    const label = COMPONENT_TYPES[comp.type]?.label ?? comp.type;
    this.onWireStatus?.(`Drag from ${label} · ${pinId} to another pin`);
    window.addEventListener("mousemove", this._boundWireMove);
    window.addEventListener("mouseup", this._boundWireUp);
  }

  onWireDragMove(e) {
    if (!this.wireDrag) return;
    const { x, y } = this.boardCoords(e);
    let endX = x;
    let endY = y;
    const target = this.pinAtPoint(e.clientX, e.clientY);
    if (target) {
      const comp = this.components.find((c) => c.id === target.compId);
      if (comp) {
        const pos = getPinPosition(comp, target.pinId);
        endX = pos.x;
        endY = pos.y;
      }
      this.setWireHoverPin(target.compId, target.pinId);
    } else {
      this.setWireHoverPin(null);
    }
    const { startPos } = this.wireDrag;
    this.updateWirePreview(startPos.x, startPos.y, endX, endY);
  }

  onWireDragEnd(e) {
    if (!this.wireDrag) return;
    const { start } = this.wireDrag;
    const target = this.pinAtPoint(e.clientX, e.clientY);
    this.endWireDrag(false);

    if (!target) {
      this.onWireStatus?.("Wire cancelled — release on a pin to connect");
      return;
    }

    const end = { compId: target.compId, pinId: target.pinId };
    if (start.compId === end.compId && start.pinId === end.pinId) {
      this.onWireStatus?.("Wire cancelled");
      return;
    }

    const oriented = orientWireEnds(start, end, this.components);
    if (!oriented.valid) {
      this.onWireStatus?.(
        "Cannot connect those two pins — try output → input"
      );
      return;
    }

    this.addWire(
      oriented.from.compId,
      oriented.from.pinId,
      oriented.to.compId,
      oriented.to.pinId
    );
    this.onWireStatus?.("Wire added — drag from a pin to wire again");
  }

  endWireDrag(clearHighlight = true) {
    window.removeEventListener("mousemove", this._boundWireMove);
    window.removeEventListener("mouseup", this._boundWireUp);
    this.wireDrag = null;
    this.clearWirePreview();
    this.setWireHoverPin(null);
    if (clearHighlight) this.clearWireHighlight();
  }

  cancelWire() {
    this.endWireDrag(true);
    this.onWireStatus?.("Wire cancelled");
  }

  boardCoords(e) {
    const rect = this.boardEl.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  pinAtPoint(clientX, clientY) {
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const el of stack) {
      const pinEl = el.closest?.(".pin");
      if (pinEl && this.boardEl.contains(pinEl)) {
        return {
          compId: pinEl.dataset.compId,
          pinId: pinEl.dataset.pinId,
        };
      }
    }
    return null;
  }

  ensureWirePreview() {
    if (this.wirePreviewPath) return;
    this.wirePreviewPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    this.wirePreviewPath.setAttribute("class", "wire-path wire-preview");
    this.previewSvg.appendChild(this.wirePreviewPath);
  }

  updateWirePreview(x1, y1, x2, y2) {
    if (!this.wirePreviewPath) return;
    const pts = pathPointsBetween(x1, y1, x2, y2);
    this.wirePreviewPath.setAttribute("d", pathPointsToD(pts));
  }

  clearWirePreview() {
    if (this.wirePreviewPath) {
      this.wirePreviewPath.remove();
      this.wirePreviewPath = null;
    }
  }

  setWireHoverPin(compId, pinId) {
    this.boardEl.querySelectorAll(".pin.wire-target").forEach((p) => {
      p.classList.remove("wire-target");
    });
    if (!compId) return;
    this.getComponentEl(compId)
      ?.querySelector(`[data-pin-id="${pinId}"]`)
      ?.classList.add("wire-target");
  }

  highlightWireStart(end) {
    this.clearWireHighlight();
    this.getComponentEl(end.compId)
      ?.querySelector(`[data-pin-id="${end.pinId}"]`)
      ?.classList.add("wire-start");
  }

  clearWireHighlight() {
    this.boardEl.querySelectorAll(".pin.wire-start").forEach((p) => {
      p.classList.remove("wire-start");
    });
  }

  highlightSelection() {
    this.boardEl.querySelectorAll(".component").forEach((el) => {
      el.classList.toggle("selected", this.selectedIds.has(el.dataset.id));
    });
  }

  onMouseMove(e) {
    if (this.simulationLocked || !this.drag) return;
    const rect = this.boardEl.getBoundingClientRect();
    const anchor = this.components.find((x) => x.id === this.drag.anchorId);
    if (!anchor) return;

    const newAnchorX = Math.max(0, e.clientX - rect.left - this.drag.offsetX);
    const newAnchorY = Math.max(0, e.clientY - rect.top - this.drag.offsetY);
    const origAnchor = this.drag.positions.get(this.drag.anchorId);
    if (!origAnchor) return;

    const dx = newAnchorX - origAnchor.x;
    const dy = newAnchorY - origAnchor.y;

    if (!this.drag.moved) {
      const px = e.clientX - this.drag.startClientX;
      const py = e.clientY - this.drag.startClientY;
      if (Math.hypot(px, py) < this.DRAG_THRESHOLD) return;
      this.drag.moved = true;
      for (const id of this.selectedIds) {
        this.getComponentEl(id)?.classList.add("dragging");
      }
    }

    for (const [id, pos] of this.drag.positions) {
      const c = this.components.find((x) => x.id === id);
      if (!c) continue;
      c.x = Math.max(0, pos.x + dx);
      c.y = Math.max(0, pos.y + dy);
      this.updateComponentVisual(c);
    }
    this.redrawWires();
  }

  onMouseUp(e) {
    this.onButtonMouseUp();

    if (this._pendingSwitchId) {
      const moved =
        e &&
        Math.hypot(e.clientX - this._switchPressX, e.clientY - this._switchPressY) >=
          this.DRAG_THRESHOLD;
      if (!moved) this.toggleSwitch(this._pendingSwitchId);
      this._pendingSwitchId = null;
      return;
    }

    if (!this.drag) return;
    for (const id of this.selectedIds) {
      this.getComponentEl(id)?.classList.remove("dragging");
    }

    if (this.drag.moved && this.onHistory) {
      this.onHistory(this.drag.snapshot);
      this.onChange?.();
    }

    this.drag = null;
  }

  armSwitchClick(compId, e) {
    this._pendingSwitchId = compId;
    this._switchPressX = e.clientX;
    this._switchPressY = e.clientY;
  }

  toggleSwitch(compId) {
    const c = this.components.find((x) => x.id === compId);
    if (c?.type !== "switch") return;
    if (!this.simulationLocked) this.recordHistory();
    COMPONENT_TYPES.switch.onClick?.(c);
    this.updateComponentVisual(c);
    this.onChange?.();
  }

  onButtonMouseUp() {
    if (!this._heldButtonId) return;
    this.setButtonPressed(this._heldButtonId, false);
    this._heldButtonId = null;
    this.onChange?.();
  }

  setButtonPressed(compId, pressed) {
    const c = this.components.find((x) => x.id === compId);
    if (c?.type === "button") {
      c.state = { ...c.state, pressed };
      this.updateComponentVisual(c);
    }
  }

  redrawWires(wireStates = this.wireStates) {
    this.wiresSvg.innerHTML = "";
    for (const w of this.wires) {
      const path = wirePathPoints(w, this.components);
      if (!path) continue;
      const d = pathPointsToD(path);
      const pathEl = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      pathEl.setAttribute("d", d);
      let cls = "wire-path";
      if (wireStates.get(w.id)) cls += " hot";
      if (this.scopeWireIds.has(w.id)) cls += " scope-trace";
      if (this.probeTarget?.kind === "wire" && this.probeTarget.wireId === w.id) {
        cls += " probe-target";
      }
      pathEl.setAttribute("class", cls);
      pathEl.dataset.wireId = w.id;
      pathEl.style.pointerEvents = "stroke";
      pathEl.addEventListener("click", (e) => {
        if (this.toolMode === "probe") {
          e.stopPropagation();
          e.preventDefault();
          this.onProbeWire?.(w.id);
          this.setProbeHighlight({ kind: "wire", wireId: w.id });
        } else if (this.toolMode === "scope") {
          e.stopPropagation();
          e.preventDefault();
          this.onScopeWire?.(w.id);
        }
      });
      pathEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (this.simulationLocked) return;
        this.removeWire(w.id);
      });
      this.wiresSvg.appendChild(pathEl);
    }
  }

  drawParticles(particles) {
    this.particlesSvg.innerHTML = "";
    for (const p of particles) {
      const wire = this.wires.find((w) => w.id === p.wireId);
      if (!wire) continue;
      const path = wirePathPoints(wire, this.components);
      if (!path) continue;
      const pt = pointOnWire(path, p.t);
      const circle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      circle.setAttribute("cx", pt.x);
      circle.setAttribute("cy", pt.y);
      circle.setAttribute("r", 4);
      circle.setAttribute("class", "particle");
      this.particlesSvg.appendChild(circle);
    }
  }

  applyWireStates(states) {
    this.wireStates = states;
    this.redrawWires(states);
  }
}

export function buildPalette(paletteEl, boardRef) {
  paletteEl.innerHTML = "";
  const groups = [
    ["battery", "ground", "switch", "button", "resistor", "led"],
    ["and", "or", "xor", "not"],
    ["clock", "dff", "srlatch"],
  ];
  for (const types of groups) {
    const group = document.createElement("div");
    group.className = "palette-group";
    for (const type of types) {
      const def = COMPONENT_TYPES[type];
      if (!def) continue;
      const item = document.createElement("div");
      item.className = "palette-item";
      item.draggable = true;
      item.dataset.type = type;
      item.innerHTML = `<span class="icon ${def.iconClass}"></span><span>${def.label}</span>`;
      bindPaletteTooltip(item, type);
      item.addEventListener("dragstart", (e) => {
        if (boardRef.simulationLocked) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData("text/component-type", type);
        e.dataTransfer.effectAllowed = "copy";
      });
      group.appendChild(item);
    }
    paletteEl.appendChild(group);
  }
}

function orientWireEnds(start, end, components) {
  const sc = components.find((c) => c.id === start.compId);
  const ec = components.find((c) => c.id === end.compId);
  if (!sc || !ec) return { from: start, to: end, valid: false };

  const sp = COMPONENT_TYPES[sc.type].pins.find((p) => p.id === start.pinId);
  const ep = COMPONENT_TYPES[ec.type].pins.find((p) => p.id === end.pinId);
  if (!sp || !ep) return { from: start, to: end, valid: false };

  const sOut = pinCanConnectFrom(sp);
  const sIn = pinCanConnectTo(sp);
  const eOut = pinCanConnectFrom(ep);
  const eIn = pinCanConnectTo(ep);

  if (sOut && eIn) return { from: start, to: end, valid: true };
  if (eOut && sIn) return { from: end, to: start, valid: true };
  if (sp.type === "bidirectional" && ep.type === "bidirectional") {
    return { from: start, to: end, valid: true };
  }
  if (sOut && eOut) return { from: start, to: end, valid: true };
  if (sIn && eIn) return { from: start, to: end, valid: false };

  return { from: start, to: end, valid: sIn || sOut || eIn || eOut };
}

export function setupBoardDrop(boardEl, board) {
  boardEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
  boardEl.addEventListener("drop", (e) => {
    e.preventDefault();
    if (board.simulationLocked) {
      board.onWireStatus?.("Pause simulation to edit the circuit");
      return;
    }
    const type = e.dataTransfer.getData("text/component-type");
    if (!type) return;
    const rect = boardEl.getBoundingClientRect();
    const def = COMPONENT_TYPES[type];
    const x = e.clientX - rect.left - def.width / 2;
    const y = e.clientY - rect.top - def.height / 2;
    const c = board.addComponent(type, x, y);
    board.selectOnly(c.id);
  });

  boardEl.addEventListener("mousedown", (e) => {
    if (e.target === boardEl || e.target.closest("svg")) {
      if (!e.shiftKey) board.selectOnly(null);
    }
  });
}
