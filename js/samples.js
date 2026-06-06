/** Pre-built example circuits */

import { importCircuit } from "./persistence.js";

function comp(id, type, x, y, state = {}) {
  return { id, type, x, y, state };
}

function wires(pairs) {
  return pairs.map(([from, fp, to, tp], i) => ({
    id: `w${i + 1}`,
    from: { compId: from, pinId: fp },
    to: { compId: to, pinId: tp },
  }));
}

export const SAMPLE_CIRCUITS = [
  {
    id: "half-adder",
    name: "Half adder",
    blurb: "XOR = sum, AND = carry — toggle switches A & B",
    components: [
      comp("c1", "battery", 40, 280),
      comp("c2", "switch", 120, 100, { closed: false }),
      comp("c3", "switch", 120, 200, { closed: false }),
      comp("c4", "xor", 280, 120),
      comp("c5", "and", 280, 220),
      comp("c6", "led", 460, 110),
      comp("c7", "led", 460, 210),
    ],
    wires: wires([
      ["c1", "out", "c2", "a"],
      ["c1", "out", "c3", "a"],
      ["c2", "b", "c4", "in1"],
      ["c2", "b", "c5", "in1"],
      ["c3", "b", "c4", "in2"],
      ["c3", "b", "c5", "in2"],
      ["c4", "out", "c6", "in"],
      ["c5", "out", "c7", "in"],
    ]),
  },
  {
    id: "full-adder",
    name: "Full adder",
    blurb: "1-bit adder with carry in — three switches",
    components: [
      comp("c1", "battery", 30, 320),
      comp("c2", "switch", 100, 60, { closed: false }),
      comp("c3", "switch", 100, 150, { closed: false }),
      comp("c4", "switch", 100, 240, { closed: false }),
      comp("c5", "xor", 240, 90),
      comp("c6", "xor", 400, 90),
      comp("c7", "and", 240, 200),
      comp("c8", "and", 400, 200),
      comp("c9", "or", 560, 200),
      comp("c10", "led", 720, 80),
      comp("c11", "led", 720, 220),
    ],
    wires: wires([
      ["c1", "out", "c2", "a"],
      ["c1", "out", "c3", "a"],
      ["c1", "out", "c4", "a"],
      ["c2", "b", "c5", "in1"],
      ["c3", "b", "c5", "in2"],
      ["c5", "out", "c6", "in1"],
      ["c4", "b", "c6", "in2"],
      ["c2", "b", "c7", "in1"],
      ["c3", "b", "c7", "in2"],
      ["c5", "out", "c8", "in1"],
      ["c4", "b", "c8", "in2"],
      ["c6", "out", "c10", "in"],
      ["c7", "out", "c9", "in1"],
      ["c8", "out", "c9", "in2"],
      ["c9", "out", "c11", "in"],
    ]),
  },
  {
    id: "sr-latch",
    name: "SR latch memory",
    blurb: "Set / Reset buttons — watch Q and Q̄ LEDs",
    components: [
      comp("c0", "ground", 40, 200),
      comp("c1", "button", 80, 120),
      comp("c2", "button", 80, 240),
      comp("c3", "srlatch", 280, 160),
      comp("c4", "led", 480, 120),
      comp("c5", "led", 480, 240),
    ],
    wires: wires([
      ["c1", "gnd", "c0", "gnd"],
      ["c2", "gnd", "c0", "gnd"],
      ["c1", "out", "c3", "s"],
      ["c2", "out", "c3", "r"],
      ["c3", "q", "c4", "in"],
      ["c3", "qbar", "c5", "in"],
    ]),
  },
  {
    id: "dff-toggle",
    name: "D-FF toggle",
    blurb: "Run — Q toggles each clock; NOT feeds Q back into D",
    components: [
      comp("c1", "clock", 80, 300),
      comp("c2", "dff", 280, 140, { q: 0, qbar: 1, prevClk: 0 }),
      comp("c3", "not", 480, 100),
      comp("c4", "led", 480, 220),
    ],
    wires: wires([
      ["c1", "out", "c2", "clk"],
      ["c2", "q", "c4", "in"],
      ["c2", "q", "c3", "in"],
      ["c3", "out", "c2", "d"],
    ]),
  },
  {
    id: "ripple-counter",
    name: "4-bit ripple counter",
    blurb: "Run simulation — four LEDs count in binary",
    components: [
      comp("c1", "clock", 60, 380),
      comp("c2", "dff", 200, 80, { q: 0, qbar: 1, prevClk: 0 }),
      comp("c3", "not", 120, 80),
      comp("c4", "dff", 380, 80, { q: 0, qbar: 1, prevClk: 0 }),
      comp("c5", "dff", 560, 80, { q: 0, qbar: 1, prevClk: 0 }),
      comp("c6", "dff", 740, 80, { q: 0, qbar: 1, prevClk: 0 }),
      comp("c7", "led", 200, 200),
      comp("c8", "led", 380, 200),
      comp("c9", "led", 560, 200),
      comp("c10", "led", 740, 200),
    ],
    wires: wires([
      ["c1", "out", "c2", "clk"],
      ["c1", "out", "c4", "clk"],
      ["c1", "out", "c5", "clk"],
      ["c1", "out", "c6", "clk"],
      ["c3", "out", "c2", "d"],
      ["c2", "q", "c3", "in"],
      ["c2", "q", "c4", "d"],
      ["c2", "q", "c7", "in"],
      ["c4", "q", "c5", "d"],
      ["c4", "q", "c8", "in"],
      ["c5", "q", "c6", "d"],
      ["c5", "q", "c9", "in"],
      ["c6", "q", "c10", "in"],
    ]),
  },
  {
    id: "shift-register",
    name: "3-stage shift register",
    blurb: "Data shifts through 3 flip-flops on each clock edge",
    components: [
      comp("c0", "ground", 40, 260),
      comp("c1", "clock", 60, 360),
      comp("c2", "button", 60, 120),
      comp("c3", "dff", 220, 100, { q: 0, qbar: 1, prevClk: 0 }),
      comp("c4", "dff", 420, 100, { q: 0, qbar: 1, prevClk: 0 }),
      comp("c5", "dff", 620, 100, { q: 0, qbar: 1, prevClk: 0 }),
      comp("c6", "led", 220, 220),
      comp("c7", "led", 420, 220),
      comp("c8", "led", 620, 220),
    ],
    wires: wires([
      ["c2", "gnd", "c0", "gnd"],
      ["c1", "out", "c3", "clk"],
      ["c1", "out", "c4", "clk"],
      ["c1", "out", "c5", "clk"],
      ["c2", "out", "c3", "d"],
      ["c3", "q", "c4", "d"],
      ["c4", "q", "c5", "d"],
      ["c3", "q", "c6", "in"],
      ["c4", "q", "c7", "in"],
      ["c5", "q", "c8", "in"],
    ]),
  },
  {
    id: "logic-gates",
    name: "Logic gate lab",
    blurb: "Two switches drive AND, OR, and XOR at once",
    components: [
      comp("c1", "battery", 40, 300),
      comp("c2", "switch", 120, 80, { closed: false }),
      comp("c3", "switch", 120, 180, { closed: false }),
      comp("c4", "and", 300, 60),
      comp("c5", "or", 300, 160),
      comp("c6", "xor", 300, 260),
      comp("c7", "led", 500, 50),
      comp("c8", "led", 500, 150),
      comp("c9", "led", 500, 250),
    ],
    wires: wires([
      ["c1", "out", "c2", "a"],
      ["c1", "out", "c3", "a"],
      ["c2", "b", "c4", "in1"],
      ["c2", "b", "c5", "in1"],
      ["c2", "b", "c6", "in1"],
      ["c3", "b", "c4", "in2"],
      ["c3", "b", "c5", "in2"],
      ["c3", "b", "c6", "in2"],
      ["c4", "out", "c7", "in"],
      ["c5", "out", "c8", "in"],
      ["c6", "out", "c9", "in"],
    ]),
  },
  {
    id: "ring-oscillator",
    name: "Ring oscillator (3 NOR)",
    blurb: "NOT chain — unstable loop; Run to see signals race",
    components: [
      comp("c1", "battery", 60, 280),
      comp("c2", "not", 180, 120),
      comp("c3", "not", 360, 120),
      comp("c4", "not", 540, 120),
      comp("c5", "resistor", 260, 240),
      comp("c6", "resistor", 440, 240),
      comp("c7", "led", 720, 120),
    ],
    wires: wires([
      ["c1", "out", "c2", "in"],
      ["c2", "out", "c5", "a"],
      ["c5", "b", "c3", "in"],
      ["c3", "out", "c6", "a"],
      ["c6", "b", "c4", "in"],
      ["c4", "out", "c7", "in"],
      ["c4", "out", "c2", "in"],
    ]),
  },
  {
    id: "traffic-light",
    name: "Traffic light sequencer",
    blurb: "Counter + decoding — Run to cycle R → Y → G LEDs",
    components: [
      comp("c1", "clock", 40, 400),
      comp("c2", "dff", 180, 120, { q: 0, qbar: 1, prevClk: 0 }),
      comp("c3", "dff", 360, 120, { q: 0, qbar: 1, prevClk: 0 }),
      comp("c4", "not", 100, 120),
      comp("c5", "and", 560, 60),
      comp("c6", "and", 560, 160),
      comp("c7", "and", 560, 260),
      comp("c8", "not", 420, 60),
      comp("c9", "led", 740, 50),
      comp("c10", "led", 740, 150),
      comp("c11", "led", 740, 250),
    ],
    wires: wires([
      ["c1", "out", "c2", "clk"],
      ["c1", "out", "c3", "clk"],
      ["c4", "out", "c2", "d"],
      ["c2", "q", "c4", "in"],
      ["c2", "q", "c3", "d"],
      ["c2", "q", "c8", "in"],
      ["c3", "q", "c5", "in2"],
      ["c8", "out", "c5", "in1"],
      ["c2", "q", "c6", "in1"],
      ["c3", "q", "c6", "in2"],
      ["c3", "q", "c7", "in1"],
      ["c8", "out", "c7", "in2"],
      ["c5", "out", "c9", "in"],
      ["c6", "out", "c10", "in"],
      ["c7", "out", "c11", "in"],
    ]),
  },
];

export function loadSample(board, sampleId) {
  const sample = SAMPLE_CIRCUITS.find((s) => s.id === sampleId);
  if (!sample) throw new Error(`Unknown sample: ${sampleId}`);
  importCircuit(
    {
      version: 1,
      components: sample.components,
      wires: sample.wires,
    },
    board
  );
  return sample;
}

export function buildSamplesMenu(selectEl, onSelect) {
  selectEl.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Sample circuits…";
  selectEl.appendChild(placeholder);

  for (const sample of SAMPLE_CIRCUITS) {
    const opt = document.createElement("option");
    opt.value = sample.id;
    opt.textContent = sample.name;
    opt.title = sample.blurb;
    selectEl.appendChild(opt);
  }

  selectEl.addEventListener("change", () => {
    const id = selectEl.value;
    if (!id) return;
    onSelect(id);
    selectEl.value = "";
  });
}
