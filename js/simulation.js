/** Digital logic propagation and flow particles */

import { COMPONENT_TYPES, getPinPosition } from "./components.js";

const MAX_ITER = 40;

export function resetSignals(components) {
  for (const c of components) {
    c.inputs = {};
    c.outputs = {};
    if (c.type === "led") c.state = { ...c.state, lit: false };
    if (c.type === "battery") c.simRunning = false;
    if (c.type === "clock") c.state = { elapsed: 0, tick: 0 };
    if (c.type === "dff") c.state = { q: 0, qbar: 1, prevClk: 0 };
    if (c.type === "srlatch") c.state = { q: 0, qbar: 1 };
    if (c.type === "button") c.state = { ...c.state, pressed: false };
  }
}

function pinKey(compId, pinId) {
  return `${compId}:${pinId}`;
}

function buildPinRoots(wires) {
  const parent = new Map();
  function find(k) {
    if (!parent.has(k)) parent.set(k, k);
    if (parent.get(k) !== k) parent.set(k, find(parent.get(k)));
    return parent.get(k);
  }
  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }
  for (const w of wires) {
    union(pinKey(w.from.compId, w.from.pinId), pinKey(w.to.compId, w.to.pinId));
  }
  return find;
}

function markGroundConnections(components, wires) {
  const find = buildPinRoots(wires);
  const groundRoots = new Set();
  for (const c of components) {
    if (c.type !== "ground") continue;
    for (const pin of COMPONENT_TYPES.ground.pins) {
      groundRoots.add(find(pinKey(c.id, pin.id)));
    }
  }
  for (const c of components) {
    if (c.type === "button") {
      c._grounded = groundRoots.has(find(pinKey(c.id, "gnd")));
    }
  }
}

function settleNetwork(components, wires) {
  markGroundConnections(components, wires);
  for (let iter = 0; iter < MAX_ITER; iter++) {
    for (const c of components) {
      c.outputs = {};
      COMPONENT_TYPES[c.type]?.evaluate(c, c.inputs);
    }
    latchDffCaptures(components);

    const changed = propagateWires(components, wires);
    if (!changed) break;
  }
}

export function stepSimulation(components, wires, simOpts = null) {
  const running = simOpts?.running ?? false;
  const dt = simOpts?.dt ?? 0;
  const speed = simOpts?.speed ?? 1;

  if (running && dt > 0) {
    for (const c of components) {
      if (c.type === "clock") {
        c.state = { ...c.state, elapsed: (c.state?.elapsed ?? 0) + dt };
      }
    }
    let guard = 0;
    while (guard++ < 64) {
      let toggled = false;
      for (const c of components) {
        if (c.type === "clock" && COMPONENT_TYPES.clock.onTick?.(c, 0, speed)) {
          toggled = true;
        }
      }
      if (!toggled) break;
      settleNetwork(components, wires);
    }
  }

  settleNetwork(components, wires);
  return getWireStates(components, wires);
}

function latchDffCaptures(components) {
  for (const c of components) {
    if (c.type !== "dff" || c.state._captureD === undefined) continue;
    const q = c.state._captureD;
    c.state = { ...c.state, q, qbar: q ? 0 : 1 };
    delete c.state._captureD;
    c.outputs.q = q;
    c.outputs.qbar = q ? 0 : 1;
  }
}

function isSwitchOutputOpen(comp, pinId) {
  return comp?.type === "switch" && pinId === "b" && !(comp.state?.closed ?? false);
}

function readPinOutput(comp, pinId) {
  if (isSwitchOutputOpen(comp, pinId)) return 0;
  return comp.outputs[pinId] ?? 0;
}

export function getPinSignal(comp, pinId) {
  if (!comp) return 0;
  const driven = readPinOutput(comp, pinId);
  const received = comp.inputs[pinId] ?? 0;
  return driven > 0 || received > 0 ? 1 : 0;
}

export function getWireSignal(wire, components) {
  if (!wire) return 0;
  const byId = new Map(components.map((c) => [c.id, c]));
  const fromComp = byId.get(wire.from.compId);
  const toComp = byId.get(wire.to.compId);
  if (!fromComp || !toComp) return 0;
  const fromOut = readPinOutput(fromComp, wire.from.pinId);
  const toOut = readPinOutput(toComp, wire.to.pinId);
  const toIn = toComp.inputs[wire.to.pinId] ?? 0;
  return fromOut > 0 || toOut > 0 || toIn > 0 ? 1 : 0;
}

function propagateWires(components, wires) {
  const byId = new Map(components.map((c) => [c.id, c]));
  let changed = false;

  for (const c of components) {
    if (Object.keys(c.inputs).length > 0) changed = true;
    c.inputs = {};
  }

  for (const w of wires) {
    const fromComp = byId.get(w.from.compId);
    const toComp = byId.get(w.to.compId);
    if (!fromComp || !toComp) continue;

    const fromOut = readPinOutput(fromComp, w.from.pinId);
    const toOut = readPinOutput(toComp, w.to.pinId);
    const signal = fromOut || toOut;

    if (signal) {
      if (!(toComp.inputs[w.to.pinId] ?? 0)) {
        toComp.inputs[w.to.pinId] = 1;
        changed = true;
      }
      const fromPin = COMPONENT_TYPES[fromComp.type]?.pins.find(
        (p) => p.id === w.from.pinId
      );
      if (
        fromPin?.type === "bidirectional" &&
        !(fromComp.inputs[w.from.pinId] ?? 0)
      ) {
        fromComp.inputs[w.from.pinId] = 1;
        changed = true;
      }
    }
  }

  return changed;
}

export function getWireStates(components, wires) {
  const byId = new Map(components.map((c) => [c.id, c]));
  const states = new Map();

  for (const w of wires) {
    const fromComp = byId.get(w.from.compId);
    const toComp = byId.get(w.to.compId);
    if (!fromComp || !toComp) {
      states.set(w.id, false);
      continue;
    }
    const fromOut = readPinOutput(fromComp, w.from.pinId);
    const hot =
      fromOut > 0 ||
      (toComp.inputs[w.to.pinId] ?? 0) > 0 ||
      readPinOutput(toComp, w.to.pinId) > 0;
    states.set(w.id, hot);
  }
  return states;
}

export function createParticleSystem() {
  return {
    particles: [],
    spawnCooldown: new Map(),
  };
}

export function updateParticles(sys, wires, wireStates, _components, dt, speed) {
  const spawnInterval = 0.35 / speed;

  for (const w of wires) {
    if (!wireStates.get(w.id)) continue;
    const cd = sys.spawnCooldown.get(w.id) ?? 0;
    if (cd <= 0) {
      sys.particles.push({
        wireId: w.id,
        t: 0,
        speed: 0.45 * speed,
      });
      sys.spawnCooldown.set(w.id, spawnInterval);
    } else {
      sys.spawnCooldown.set(w.id, cd - dt);
    }
  }

  sys.particles = sys.particles.filter((p) => {
    p.t += p.speed * dt;
    return p.t < 1;
  });

  if (sys.particles.length > 200) {
    sys.particles = sys.particles.slice(-200);
  }
}

export function wirePathPoints(wire, components) {
  const fromComp = components.find((c) => c.id === wire.from.compId);
  const toComp = components.find((c) => c.id === wire.to.compId);
  if (!fromComp || !toComp) return null;

  const a = getPinPosition(fromComp, wire.from.pinId);
  const b = getPinPosition(toComp, wire.to.pinId);
  return pathPointsBetween(a.x, a.y, b.x, b.y);
}

export function pathPointsBetween(ax, ay, bx, by) {
  const dx = bx - ax;
  return {
    a: { x: ax, y: ay },
    b: { x: bx, y: by },
    cx1: ax + dx * 0.5,
    cy1: ay,
    cx2: bx - dx * 0.5,
    cy2: by,
  };
}

export function pathPointsToD({ a, b, cx1, cy1, cx2, cy2 }) {
  return `M ${a.x} ${a.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${b.x} ${b.y}`;
}

export function pointOnWire(path, t) {
  const { a, b, cx1, cy1, cx2, cy2 } = path;
  const u = 1 - t;
  const x =
    u * u * u * a.x +
    3 * u * u * t * cx1 +
    3 * u * t * t * cx2 +
    t * t * t * b.x;
  const y =
    u * u * u * a.y +
    3 * u * u * t * cy1 +
    3 * u * t * t * cy2 +
    t * t * t * b.y;
  return { x, y };
}
