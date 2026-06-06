/** Component type definitions and factory */

let nextId = 1;
let nextWireId = 1;

export const COMPONENT_TYPES = {
  battery: {
    label: "Battery",
    iconClass: "icon-battery",
    width: 56,
    height: 40,
    pins: [{ id: "out", type: "output", x: 1, y: 0.5 }],
    evaluate(node) {
      node.outputs.out = node.simRunning ? 1 : 0;
    },
  },
  ground: {
    label: "GND",
    iconClass: "icon-ground",
    width: 44,
    height: 40,
    pins: [{ id: "gnd", type: "bidirectional", x: 0.5, y: 0 }],
    evaluate(node) {
      node.outputs.gnd = 0;
    },
  },
  switch: {
    label: "Switch",
    iconClass: "icon-switch",
    width: 52,
    height: 36,
    pins: [
      { id: "a", type: "bidirectional", x: 0, y: 0.5 },
      { id: "b", type: "bidirectional", x: 1, y: 0.5 },
    ],
    evaluate(node) {
      const closed = node.state?.closed ?? false;
      const fromA = node.inputs.a ?? 0;
      if (closed) {
        node.outputs.a = fromA;
        node.outputs.b = fromA;
      } else {
        // Open: battery side stays live; output side is isolated (no stale HIGH)
        node.outputs.a = fromA;
        node.outputs.b = 0;
      }
    },
    onClick(node) {
      node.state = { ...node.state, closed: !(node.state?.closed ?? false) };
      node.inputs = {};
      node.outputs = {};
    },
  },
  button: {
    label: "Button",
    iconClass: "icon-button",
    width: 60,
    height: 60,
    pins: [
      { id: "out", type: "output", x: 0.5, y: 1 },
      { id: "gnd", type: "input", x: 0.5, y: 0 },
    ],
    evaluate(node) {
      const pressed = node.state?.pressed ?? false;
      const grounded = node._grounded ?? false;
      node.outputs.out = pressed && grounded ? 1 : 0;
    },
  },
  led: {
    label: "LED",
    iconClass: "icon-led",
    width: 48,
    height: 48,
    pins: [{ id: "in", type: "input", x: 0.5, y: 1 }],
    evaluate(node) {
      node.state = { ...node.state, lit: (node.inputs.in ?? 0) > 0 };
    },
  },
  resistor: {
    label: "Resistor",
    iconClass: "icon-resistor",
    width: 72,
    height: 32,
    pins: [
      { id: "a", type: "bidirectional", x: 0, y: 0.5 },
      { id: "b", type: "bidirectional", x: 1, y: 0.5 },
    ],
    evaluate(node) {
      const v = (node.inputs.a ?? 0) || (node.inputs.b ?? 0);
      node.outputs.a = v;
      node.outputs.b = v;
    },
  },
  and: {
    label: "AND",
    iconClass: "icon-and",
    width: 56,
    height: 48,
    pins: [
      { id: "in1", type: "input", x: 0, y: 0.3 },
      { id: "in2", type: "input", x: 0, y: 0.7 },
      { id: "out", type: "output", x: 1, y: 0.5 },
    ],
    evaluate(node) {
      const a = node.inputs.in1 ?? 0;
      const b = node.inputs.in2 ?? 0;
      node.outputs.out = a && b ? 1 : 0;
    },
  },
  or: {
    label: "OR",
    iconClass: "icon-or",
    width: 56,
    height: 48,
    pins: [
      { id: "in1", type: "input", x: 0, y: 0.3 },
      { id: "in2", type: "input", x: 0, y: 0.7 },
      { id: "out", type: "output", x: 1, y: 0.5 },
    ],
    evaluate(node) {
      const a = node.inputs.in1 ?? 0;
      const b = node.inputs.in2 ?? 0;
      node.outputs.out = a || b ? 1 : 0;
    },
  },
  xor: {
    label: "XOR",
    iconClass: "icon-xor",
    width: 56,
    height: 48,
    pins: [
      { id: "in1", type: "input", x: 0, y: 0.3 },
      { id: "in2", type: "input", x: 0, y: 0.7 },
      { id: "out", type: "output", x: 1, y: 0.5 },
    ],
    evaluate(node) {
      const a = node.inputs.in1 ?? 0;
      const b = node.inputs.in2 ?? 0;
      node.outputs.out = (a ? 1 : 0) !== (b ? 1 : 0) ? 1 : 0;
    },
  },
  not: {
    label: "NOT",
    iconClass: "icon-not",
    width: 52,
    height: 40,
    pins: [
      { id: "in", type: "input", x: 0, y: 0.5 },
      { id: "out", type: "output", x: 1, y: 0.5 },
    ],
    evaluate(node) {
      node.outputs.out = (node.inputs.in ?? 0) ? 0 : 1;
    },
  },
  clock: {
    label: "Clock",
    iconClass: "icon-clock",
    width: 52,
    height: 52,
    pins: [{ id: "out", type: "output", x: 0.5, y: 1 }],
    defaultState: { elapsed: 0, tick: 0 },
    evaluate(node) {
      node.outputs.out = node.state?.tick ?? 0;
    },
    /** Fire one half-period if elapsed time allows; returns true when toggled */
    onTick(node, _dt, speed = 1) {
      const halfPeriod = 0.5 / speed;
      const elapsed = node.state?.elapsed ?? 0;
      if (elapsed < halfPeriod) return false;
      const tick = node.state?.tick ? 0 : 1;
      node.state = { ...node.state, elapsed: elapsed - halfPeriod, tick };
      return true;
    },
  },
  dff: {
    label: "D-FF",
    iconClass: "icon-dff",
    width: 64,
    height: 56,
    pins: [
      { id: "d", type: "input", x: 0, y: 0.3 },
      { id: "clk", type: "input", x: 0, y: 0.7 },
      { id: "q", type: "output", x: 1, y: 0.3 },
      { id: "qbar", type: "output", x: 1, y: 0.7 },
    ],
    defaultState: { q: 0, qbar: 1, prevClk: 0 },
    evaluate(node) {
      const clk = node.inputs.clk ?? 0;
      const prevClk = node.state?.prevClk ?? 0;
      const q = node.state?.q ?? 0;
      if (clk && !prevClk) {
        node.state._captureD = (node.inputs.d ?? 0) ? 1 : 0;
      }
      node.state = { ...node.state, prevClk: clk };
      node.outputs.q = q;
      node.outputs.qbar = q ? 0 : 1;
    },
  },
  srlatch: {
    label: "SR",
    iconClass: "icon-sr",
    width: 60,
    height: 52,
    pins: [
      { id: "s", type: "input", x: 0, y: 0.3 },
      { id: "r", type: "input", x: 0, y: 0.7 },
      { id: "q", type: "output", x: 1, y: 0.3 },
      { id: "qbar", type: "output", x: 1, y: 0.7 },
    ],
    defaultState: { q: 0, qbar: 1 },
    evaluate(node) {
      const s = node.inputs.s ?? 0;
      const r = node.inputs.r ?? 0;
      let q = node.state?.q ?? 0;
      let qbar = node.state?.qbar ?? 1;
      if (s && !r) {
        q = 1;
        qbar = 0;
      } else if (r && !s) {
        q = 0;
        qbar = 1;
      }
      node.state = { ...node.state, q, qbar };
      node.outputs.q = q;
      node.outputs.qbar = qbar;
    },
  },
};

export function allocComponentId() {
  return `c${nextId++}`;
}

export function allocWireId() {
  return `w${nextWireId++}`;
}

export function syncIdCounters(components, wires) {
  let maxC = 0;
  let maxW = 0;
  for (const c of components) {
    const m = /^c(\d+)$/.exec(c.id);
    if (m) maxC = Math.max(maxC, parseInt(m[1], 10));
  }
  for (const w of wires) {
    const m = /^w(\d+)$/.exec(w.id);
    if (m) maxW = Math.max(maxW, parseInt(m[1], 10));
  }
  nextId = maxC + 1;
  nextWireId = maxW + 1;
}

export function createComponent(type, x, y, opts = {}) {
  const def = COMPONENT_TYPES[type];
  if (!def) throw new Error(`Unknown type: ${type}`);
  const id = opts.id ?? allocComponentId();
  const state =
    opts.state !== undefined
      ? structuredClone(opts.state)
      : def.defaultState
        ? structuredClone(def.defaultState)
        : type === "switch"
          ? { closed: false }
          : {};
  return {
    id,
    type,
    x,
    y,
    state,
    inputs: {},
    outputs: {},
    simRunning: false,
  };
}

export function cloneComponentData(c) {
  return {
    id: c.id,
    type: c.type,
    x: c.x,
    y: c.y,
    state: structuredClone(c.state ?? {}),
  };
}

export function getPinPosition(comp, pinId) {
  const def = COMPONENT_TYPES[comp.type];
  const pin = def.pins.find((p) => p.id === pinId);
  if (!pin) return { x: comp.x, y: comp.y };
  return {
    x: comp.x + pin.x * def.width,
    y: comp.y + pin.y * def.height,
  };
}

export function pinCanConnectFrom(pinDef) {
  return pinDef.type === "output" || pinDef.type === "bidirectional";
}

export function pinCanConnectTo(pinDef) {
  return pinDef.type === "input" || pinDef.type === "bidirectional";
}
