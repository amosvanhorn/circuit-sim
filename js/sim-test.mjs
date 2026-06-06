/** Headless component tests — run: node js/sim-test.mjs */

import { COMPONENT_TYPES, createComponent } from "./components.js";
import { stepSimulation, resetSignals } from "./simulation.js";

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error("FAIL:", msg);
  }
}

function wire(id, from, fp, to, tp) {
  return { id, from: { compId: from, pinId: fp }, to: { compId: to, pinId: tp } };
}

function runStep(components, wires, opts = { running: true, dt: 0.05, speed: 1 }) {
  return stepSimulation(components, wires, opts);
}

function comp(type, id, extra = {}) {
  const c = createComponent(type, 0, 0, { id, ...extra });
  if (type === "battery") c.simRunning = true;
  return c;
}

function groundedButton(btnId, gndId = "g0") {
  const gnd = comp("ground", gndId);
  const btn = comp("button", btnId);
  const gndWire = wire(`wg-${btnId}`, btnId, "gnd", gndId, "gnd");
  return { gnd, btn, gndWire };
}

// --- Battery ---
{
  const bat = comp("battery", "b1");
  runStep([bat], [], { running: true });
  assert(bat.outputs.out === 1, "battery outputs HIGH when running");
  bat.simRunning = false;
  runStep([bat], [], { running: false });
  assert(bat.outputs.out === 0, "battery outputs LOW when stopped");
}

// --- Switch ---
{
  const bat = comp("battery", "b1");
  const sw = comp("switch", "s1");
  const led = comp("led", "l1");
  const wires = [
    wire("w1", "b1", "out", "s1", "a"),
    wire("w2", "s1", "b", "l1", "in"),
  ];
  runStep([bat, sw, led], wires);
  assert(!led.state.lit, "switch open: LED off");
  sw.state.closed = true;
  runStep([bat, sw, led], wires);
  assert(led.state.lit, "switch closed: LED on");
  sw.state.closed = false;
  sw.inputs = {};
  runStep([bat, sw, led], wires);
  assert(!led.state.lit, "switch open again: LED off");
}

// --- Button ---
{
  const { gnd, btn, gndWire } = groundedButton("b1");
  const led = comp("led", "l1");
  const wires = [gndWire, wire("w1", "b1", "out", "l1", "in")];
  runStep([gnd, btn, led], wires);
  assert(!led.state.lit, "button released: LED off");
  btn.state.pressed = true;
  runStep([gnd, btn, led], wires);
  assert(led.state.lit, "button pressed with ground: LED on");
}

// --- Button needs ground ---
{
  const btn = comp("button", "b1");
  const led = comp("led", "l1");
  const wires = [wire("w1", "b1", "out", "l1", "in")];
  btn.state.pressed = true;
  runStep([btn, led], wires);
  assert(!led.state.lit, "button pressed without ground: no output");
}

// --- Ground ---
{
  const gnd = comp("ground", "g1");
  runStep([gnd], []);
  assert(gnd.outputs.gnd === 0, "ground outputs LOW");
}

// --- Resistor ---
{
  const bat = comp("battery", "b1");
  const res = comp("resistor", "r1");
  const led = comp("led", "l1");
  const wires = [
    wire("w1", "b1", "out", "r1", "a"),
    wire("w2", "r1", "b", "l1", "in"),
  ];
  runStep([bat, res, led], wires);
  assert(led.state.lit, "resistor passes signal");
}

// --- AND / OR / XOR / NOT ---
{
  const bat = comp("battery", "b1");
  const sw1 = comp("switch", "s1");
  const sw2 = comp("switch", "s2");
  const and = comp("and", "g1");
  const or = comp("or", "g2");
  const xor = comp("xor", "g3");
  const not = comp("not", "g4");
  const la = comp("led", "l1");
  const lo = comp("led", "l2");
  const lx = comp("led", "l3");
  const ln = comp("led", "l4");
  const wires = [
    wire("w1", "b1", "out", "s1", "a"),
    wire("w2", "b1", "out", "s2", "a"),
    wire("w3", "s1", "b", "g1", "in1"),
    wire("w4", "s2", "b", "g1", "in2"),
    wire("w5", "s1", "b", "g2", "in1"),
    wire("w6", "s2", "b", "g2", "in2"),
    wire("w7", "s1", "b", "g3", "in1"),
    wire("w8", "s2", "b", "g3", "in2"),
    wire("w9", "s1", "b", "g4", "in"),
    wire("w10", "g1", "out", "l1", "in"),
    wire("w11", "g2", "out", "l2", "in"),
    wire("w12", "g3", "out", "l3", "in"),
    wire("w13", "g4", "out", "l4", "in"),
  ];
  sw1.state.closed = true;
  sw2.state.closed = false;
  runStep([bat, sw1, sw2, and, or, xor, not, la, lo, lx, ln], wires);
  assert(la.outputs.out !== 1 && !la.state.lit, "AND: only one switch on -> off");
  assert(lo.state.lit, "OR: one switch on -> on");
  assert(lx.state.lit, "XOR: one switch on -> on");
  assert(!ln.state.lit, "NOT: switch on -> off");
  sw2.state.closed = true;
  runStep([bat, sw1, sw2, and, or, xor, not, la, lo, lx, ln], wires);
  assert(la.state.lit, "AND: both on -> on");
  assert(lo.state.lit, "OR: both on -> on");
  assert(!lx.state.lit, "XOR: both on -> off");
}

// --- Clock ---
{
  const clk = comp("clock", "c1");
  const led = comp("led", "l1");
  const wires = [wire("w1", "c1", "out", "l1", "in")];
  runStep([clk, led], wires, { running: true, dt: 0, speed: 1 });
  const t0 = clk.state.tick;
  runStep([clk, led], wires, { running: true, dt: 0.6, speed: 1 });
  assert(clk.state.tick !== t0, "clock toggles over time");
}

// --- D-FF ---
{
  const clk = comp("clock", "c1");
  const { gnd, btn, gndWire } = groundedButton("b1");
  const dff = comp("dff", "d1");
  const led = comp("led", "l1");
  const wires = [
    gndWire,
    wire("w1", "c1", "out", "d1", "clk"),
    wire("w2", "b1", "out", "d1", "d"),
    wire("w3", "d1", "q", "l1", "in"),
  ];
  btn.state.pressed = true;
  for (let i = 0; i < 8; i++) {
    runStep([gnd, clk, btn, dff, led], wires, { running: true, dt: 0.12, speed: 2 });
  }
  assert(dff.state.q === 1, "D-FF captures D=1 on clock edge");
  btn.state.pressed = false;
  runStep([gnd, clk, btn, dff, led], wires, { running: false, dt: 0 });
  assert(dff.state.q === 1, "D-FF holds value when D=0 between edges");
}

// --- SR latch ---
{
  const set = groundedButton("bs", "g0");
  const reset = groundedButton("br", "g1");
  const sr = comp("srlatch", "sr1");
  const lq = comp("led", "lq");
  const wires = [
    set.gndWire,
    reset.gndWire,
    wire("w1", "bs", "out", "sr1", "s"),
    wire("w2", "br", "out", "sr1", "r"),
    wire("w3", "sr1", "q", "lq", "in"),
  ];
  const parts = [set.gnd, set.btn, reset.gnd, reset.btn, sr, lq];
  set.btn.state.pressed = true;
  runStep(parts, wires);
  assert(sr.state.q === 1 && lq.state.lit, "SR: set");
  set.btn.state.pressed = false;
  reset.btn.state.pressed = true;
  runStep(parts, wires);
  assert(sr.state.q === 0 && !lq.state.lit, "SR: reset");
}

// --- SR latch holds state ---
{
  const set = groundedButton("bs", "g0");
  const reset = groundedButton("br", "g1");
  const sr = comp("srlatch", "sr1");
  const wires = [
    set.gndWire,
    reset.gndWire,
    wire("w1", "bs", "out", "sr1", "s"),
    wire("w2", "br", "out", "sr1", "r"),
  ];
  const parts = [set.gnd, set.btn, reset.gnd, reset.btn, sr];
  set.btn.state.pressed = true;
  runStep(parts, wires);
  set.btn.state.pressed = false;
  runStep(parts, wires);
  assert(sr.state.q === 1, "SR: holds set after release");
}

// --- resetSignals clears sequential state ---
{
  const sr = comp("srlatch", "sr1", { state: { q: 1, qbar: 0 } });
  const dff = comp("dff", "d1", { state: { q: 1, qbar: 0, prevClk: 1 } });
  resetSignals([sr, dff]);
  assert(sr.state.q === 0, "reset: SR latch cleared");
  assert(dff.state.q === 0 && dff.state.prevClk === 0, "reset: D-FF cleared");
}

// --- Half adder truth table ---
{
  const { SAMPLE_CIRCUITS } = await import("./samples.js");
  const sample = SAMPLE_CIRCUITS.find((s) => s.id === "half-adder");
  const byId = Object.fromEntries(sample.components.map((c) => [c.id, c]));
  const components = sample.components.map((raw) => {
    const c = createComponent(raw.type, raw.x, raw.y, {
      id: raw.id,
      state: raw.state,
    });
    if (c.type === "battery") c.simRunning = true;
    return c;
  });
  const wires = sample.wires;
  const swA = components.find((c) => c.id === "c2");
  const swB = components.find((c) => c.id === "c3");
  const ledSum = components.find((c) => c.id === "c6");
  const ledCarry = components.find((c) => c.id === "c7");
  const cases = [
    [0, 0, 0, 0],
    [1, 0, 1, 0],
    [0, 1, 1, 0],
    [1, 1, 0, 1],
  ];
  for (const [a, b, sum, carry] of cases) {
    swA.state.closed = !!a;
    swB.state.closed = !!b;
    runStep(components, wires);
    assert(
      !!ledSum.state.lit === !!sum && !!ledCarry.state.lit === !!carry,
      `half-adder ${a}+${b} => sum=${sum} carry=${carry} (got ${ledSum.state.lit},${ledCarry.state.lit})`
    );
  }
}

// --- Full adder truth table ---
{
  const { SAMPLE_CIRCUITS } = await import("./samples.js");
  const sample = SAMPLE_CIRCUITS.find((s) => s.id === "full-adder");
  const components = sample.components.map((raw) => {
    const c = createComponent(raw.type, raw.x, raw.y, {
      id: raw.id,
      state: raw.state,
    });
    if (c.type === "battery") c.simRunning = true;
    return c;
  });
  const wires = sample.wires;
  const sw = (id) => components.find((c) => c.id === id);
  const ledSum = components.find((c) => c.id === "c10");
  const ledCarry = components.find((c) => c.id === "c11");
  const cases = [
    [0, 0, 0, 0, 0],
    [0, 0, 1, 1, 0],
    [0, 1, 0, 1, 0],
    [0, 1, 1, 0, 1],
    [1, 0, 0, 1, 0],
    [1, 0, 1, 0, 1],
    [1, 1, 0, 0, 1],
    [1, 1, 1, 1, 1],
  ];
  for (const [a, b, cin, sum, cout] of cases) {
    sw("c2").state.closed = !!a;
    sw("c3").state.closed = !!b;
    sw("c4").state.closed = !!cin;
    runStep(components, wires);
    assert(
      !!ledSum.state.lit === !!sum && !!ledCarry.state.lit === !!cout,
      `full-adder ${a}+${b}+${cin} => ${sum},${cout} (got ${ledSum.state.lit},${ledCarry.state.lit})`
    );
  }
}

// --- D-FF toggle (dff-toggle sample) ---
{
  const { SAMPLE_CIRCUITS } = await import("./samples.js");
  const sample = SAMPLE_CIRCUITS.find((s) => s.id === "dff-toggle");
  const components = sample.components.map((raw) => {
    const c = createComponent(raw.type, raw.x, raw.y, {
      id: raw.id,
      state: raw.state,
    });
    return c;
  });
  const wires = sample.wires;
  const dff = components.find((c) => c.id === "c2");
  const q0 = dff.state.q;
  for (let i = 0; i < 6; i++) {
    runStep(components, wires, { running: true, dt: 0.55, speed: 2 });
  }
  assert(dff.state.q !== q0, "D-FF toggle: Q changed after clock edges");
}

// --- Ripple counter advances ---
{
  const { SAMPLE_CIRCUITS } = await import("./samples.js");
  const sample = SAMPLE_CIRCUITS.find((s) => s.id === "ripple-counter");
  const components = sample.components.map((raw) =>
    createComponent(raw.type, raw.x, raw.y, { id: raw.id, state: raw.state })
  );
  const wires = sample.wires;
  const c2 = components.find((c) => c.id === "c2");
  const q0 = c2.state.q;
  runStep(components, wires, { running: true, dt: 0.3, speed: 3 });
  assert(c2.state.q !== q0, "ripple counter: bit 0 toggles on first clock edge");
}

// --- Shift register shifts on clock ---
{
  const { SAMPLE_CIRCUITS } = await import("./samples.js");
  const sample = SAMPLE_CIRCUITS.find((s) => s.id === "shift-register");
  const components = sample.components.map((raw) =>
    createComponent(raw.type, raw.x, raw.y, { id: raw.id, state: raw.state })
  );
  const wires = sample.wires;
  const btn = components.find((c) => c.id === "c2");
  const ff3 = components.find((c) => c.id === "c5");
  btn.state.pressed = true;
  for (let i = 0; i < 3; i++) {
    runStep(components, wires, { running: true, dt: 0.35, speed: 3 });
  }
  assert(ff3.state.q === 1, "shift register: data reaches last stage");
}

// --- NOT floating input outputs HIGH ---
{
  const not = comp("not", "n1");
  const led = comp("led", "l1");
  const wires = [wire("w1", "n1", "out", "l1", "in")];
  runStep([not, led], wires);
  assert(led.state.lit, "NOT with no input: output HIGH");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
