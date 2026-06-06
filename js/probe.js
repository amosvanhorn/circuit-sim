/** Multimeter probe — read HIGH/LOW on pins and wires */

import { getPinSignal, getWireSignal } from "./simulation.js";
import { formatProbeLabel, formatWireLabel } from "./help.js";

export class ProbeTool {
  constructor(panelEl) {
    this.panelEl = panelEl;
    this.target = null;
    this.panelEl.innerHTML = `
      <h2>Probe</h2>
      <p class="tools-hint">Enable probe mode, then click a pin or wire.</p>
      <div class="probe-reading" id="probe-reading">—</div>
      <div class="probe-label" id="probe-label">No target</div>
    `;
    this.readingEl = panelEl.querySelector("#probe-reading");
    this.labelEl = panelEl.querySelector("#probe-label");
  }

  clear() {
    this.target = null;
    this.readingEl.textContent = "—";
    this.readingEl.className = "probe-reading";
    this.labelEl.textContent = "No target";
  }

  probePin(compId, pinId, components) {
    const comp = components.find((c) => c.id === compId);
    if (!comp) return;
    this.target = { kind: "pin", compId, pinId };
    this.labelEl.textContent = formatProbeLabel(comp, pinId);
    this.refresh(components, []);
  }

  probeWire(wireId, components, wires) {
    const wire = wires.find((w) => w.id === wireId);
    if (!wire) return;
    this.target = { kind: "wire", wireId };
    this.labelEl.textContent = formatWireLabel(wire, components);
    this.refresh(components, wires);
  }

  refresh(components, wires) {
    if (!this.target) return;
    let value = 0;
    if (this.target.kind === "pin") {
      const comp = components.find((c) => c.id === this.target.compId);
      value = getPinSignal(comp, this.target.pinId);
    } else {
      const wire = wires.find((w) => w.id === this.target.wireId);
      value = getWireSignal(wire, components);
    }
    this.readingEl.textContent = value ? "HIGH (1)" : "LOW (0)";
    this.readingEl.className = "probe-reading " + (value ? "high" : "low");
  }
}
