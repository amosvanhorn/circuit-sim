/** Component and pin descriptions for hover tooltips */

const PIN_HELP = {
  battery: { out: "Power output — HIGH while simulation is running." },
  ground: { gnd: "Reference ground — logic LOW (0V)." },
  switch: {
    a: "Input side — connect to battery or upstream signal.",
    b: "Output side — open switch isolates this pin (LOW).",
  },
  button: {
    out: "Signal output — HIGH only while pressed and grounded.",
    gnd: "Ground return — wire to a GND component.",
  },
  led: { in: "Lights up when this input is HIGH." },
  resistor: {
    a: "Pass-through — signal propagates to the other side.",
    b: "Pass-through — signal propagates to the other side.",
  },
  and: {
    in1: "First input.",
    in2: "Second input.",
    out: "HIGH only when both inputs are HIGH.",
  },
  or: {
    in1: "First input.",
    in2: "Second input.",
    out: "HIGH when either input is HIGH.",
  },
  xor: {
    in1: "First input.",
    in2: "Second input.",
    out: "HIGH when exactly one input is HIGH.",
  },
  not: {
    in: "Input signal.",
    out: "Inverted output — HIGH when input is LOW.",
  },
  clock: { out: "Square wave ~1 Hz at speed 1 — toggles 0/1." },
  dff: {
    d: "Data input — captured on rising clock edge.",
    clk: "Clock — samples D when 0→1.",
    q: "Stored output.",
    qbar: "Complement of Q.",
  },
  srlatch: {
    s: "Set — HIGH sets Q=1 (when R is LOW).",
    r: "Reset — HIGH sets Q=0 (when S is LOW).",
    q: "Stored output.",
    qbar: "Complement of Q.",
  },
};

const COMPONENT_HELP = {
  battery:
    "Power source. Outputs HIGH while Run is active; LOW when paused.",
  ground:
    "Ground reference. Wire button returns and other sinks here. Always logic LOW.",
  switch:
    "SPST switch. Click to toggle. Closed passes signal A→B; open leaves B isolated.",
  button:
    "Momentary push button. Hold click or Space. Needs GND wired to work.",
  led: "Output indicator — glows when its input pin is HIGH.",
  resistor: "Passive pass-through — connects two nets with no logic change.",
  and: "Logic AND — output HIGH only if both inputs are HIGH.",
  or: "Logic OR — output HIGH if any input is HIGH.",
  xor: "Logic XOR — output HIGH if inputs differ.",
  not: "Logic NOT — inverts the input.",
  clock:
    "Free-running square wave. Use with flip-flops; frequency scales with flow speed.",
  dff: "D flip-flop — on each rising clock edge, Q captures the value of D.",
  srlatch:
    "SR latch — S sets memory, R resets it. Holds state when both inputs are LOW.",
};

export function getComponentHelp(type) {
  return COMPONENT_HELP[type] ?? "Circuit component.";
}

export function getPinHelp(type, pinId) {
  return PIN_HELP[type]?.[pinId] ?? `${pinId} pin`;
}

export function formatProbeLabel(comp, pinId) {
  const label = comp?.type ?? "?";
  const name = label.charAt(0).toUpperCase() + label.slice(1);
  return `${name} · ${pinId}`;
}

export function formatWireLabel(wire, components) {
  const byId = new Map(components.map((c) => [c.id, c]));
  const from = byId.get(wire.from.compId);
  const to = byId.get(wire.to.compId);
  const a = from ? `${from.type}.${wire.from.pinId}` : wire.from.pinId;
  const b = to ? `${to.type}.${wire.to.pinId}` : wire.to.pinId;
  return `Wire ${wire.id}: ${a} → ${b}`;
}
