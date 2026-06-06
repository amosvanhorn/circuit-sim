/** Oscilloscope — plot wire signals over time */

import { getWireSignal } from "./simulation.js";
import { formatWireLabel } from "./help.js";

const MAX_TRACES = 4;
const MAX_SAMPLES = 320;
const TRACE_COLORS = ["#ff6b6b", "#3dd68c", "#6bc5ff", "#ffd166"];

export class Oscilloscope {
  constructor(panelEl) {
    this.panelEl = panelEl;
    this.traces = [];
    this.time = 0;
    this.onTracesChange = null;
    this.panelEl.innerHTML = `
      <h2>Oscilloscope</h2>
      <p class="tools-hint">Enable scope mode, click wires to trace (max ${MAX_TRACES}).</p>
      <canvas id="scope-canvas" width="280" height="120" aria-label="Oscilloscope traces"></canvas>
      <ul class="scope-traces" id="scope-trace-list"></ul>
      <button type="button" class="scope-clear" id="scope-clear">Clear traces</button>
    `;
    this.canvas = panelEl.querySelector("#scope-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.listEl = panelEl.querySelector("#scope-trace-list");
    panelEl.querySelector("#scope-clear").addEventListener("click", () => this.clear());
  }

  clear() {
    this.traces = [];
    this.time = 0;
    this.renderList([]);
    this.draw([]);
    this.onTracesChange?.();
  }

  toggleWire(wireId, components, wires) {
    const idx = this.traces.findIndex((t) => t.wireId === wireId);
    if (idx >= 0) {
      this.traces.splice(idx, 1);
    } else if (this.traces.length < MAX_TRACES) {
      const wire = wires.find((w) => w.id === wireId);
      if (!wire) return false;
      this.traces.push({
        wireId,
        label: formatWireLabel(wire, components),
        color: TRACE_COLORS[this.traces.length % TRACE_COLORS.length],
        samples: [],
      });
    }
    this.renderList(wires);
    this.onTracesChange?.();
    return true;
  }

  renderList(wires) {
    this.listEl.innerHTML = "";
    for (const t of this.traces) {
      const li = document.createElement("li");
      li.innerHTML = `<span class="scope-swatch" style="background:${t.color}"></span><span class="scope-trace-name">${t.label}</span>`;
      li.title = "Click to remove";
      li.addEventListener("click", () => {
        this.traces = this.traces.filter((x) => x.wireId !== t.wireId);
        this.renderList(wires);
        this.onTracesChange?.();
      });
      this.listEl.appendChild(li);
    }
  }

  sample(components, wires, dt) {
    if (!this.traces.length) return;
    this.time += dt;
    for (const t of this.traces) {
      const wire = wires.find((w) => w.id === t.wireId);
      const value = wire ? getWireSignal(wire, components) : 0;
      t.samples.push(value);
      if (t.samples.length > MAX_SAMPLES) t.samples.shift();
    }
    this.draw(wires);
  }

  draw(_wires) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const pad = { l: 28, r: 8, t: 8, b: 18 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;

    ctx.fillStyle = "#121a24";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#3d4f66";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, pad.t + plotH);
    ctx.lineTo(pad.l + plotW, pad.t + plotH);
    ctx.stroke();

    ctx.fillStyle = "#8b9cb3";
    ctx.font = "10px system-ui";
    ctx.fillText("1", 4, pad.t + 8);
    ctx.fillText("0", 4, pad.t + plotH);

    if (!this.traces.length) {
      ctx.fillStyle = "#6b7a8f";
      ctx.fillText("No traces", pad.l + 40, pad.t + plotH / 2);
      return;
    }

    for (const t of this.traces) {
      if (t.samples.length < 2) continue;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const n = t.samples.length;
      for (let i = 0; i < n; i++) {
        const x = pad.l + (i / (MAX_SAMPLES - 1)) * plotW;
        const y = pad.t + plotH - t.samples[i] * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  hasTraces() {
    return this.traces.length > 0;
  }
}
