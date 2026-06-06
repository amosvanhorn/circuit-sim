#!/usr/bin/env node
/** Rebuild index.html from js/*.js and css/style.css */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const strip = (code) =>
  code
    .replace(/^export /gm, "")
    .replace(/^import \{[\s\S]*?\} from ["'][^"']+["'];\n?/gm, "");

const files = [
  "js/components.js",
  "js/simulation.js",
  "js/history.js",
  "js/clipboard.js",
  "js/persistence.js",
  "js/samples.js",
  "js/help.js",
  "js/tooltip.js",
  "js/probe.js",
  "js/scope.js",
  "js/board.js",
  "js/main.js",
];

const js = files
  .map((f) => strip(fs.readFileSync(path.join(root, f), "utf8")))
  .join("\n");

const css = fs.readFileSync(path.join(root, "css/style.css"), "utf8");

const shell = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Circuit Sim — Build &amp; Simulate</title>
  <style>
${css}
  </style>
</head>
<body>
  <header class="header">
    <h1>Circuit Sim</h1>
    <p class="subtitle">Place components, wire pins, and watch signals flow</p>
  </header>

  <div class="app">
    <aside class="palette" aria-label="Component palette">
      <h2>Sample circuits</h2>
      <label class="sample-label">
        <select id="sample-select" class="sample-select"></select>
      </label>
      <p class="sample-hint" id="sample-hint">Load a ready-made example</p>

      <h2>Circuit file</h2>
      <div class="file-buttons">
        <button type="button" id="btn-save" title="Download JSON (⌘S)">Save</button>
        <button type="button" id="btn-load">Load</button>
        <button type="button" id="btn-new">New</button>
      </div>

      <h2>Components</h2>
      <p class="hint">Drag onto the board</p>
      <div class="palette-items" id="palette"></div>

      <button type="button" id="btn-clear" class="danger">Clear board</button>
    </aside>

    <main class="workspace">
      <div class="workspace-row">
      <div class="workspace-main">
      <div class="diagram-toolbar">
        <div class="toolbar-actions">
          <button type="button" id="btn-run" class="primary" title="Run simulation">▶ Run</button>
          <button type="button" id="btn-reset" title="Reset simulation state">Reset</button>
          <span class="toolbar-sep" aria-hidden="true"></span>
          <button type="button" id="btn-undo" title="Undo (⌘Z)">Undo</button>
          <button type="button" id="btn-redo" title="Redo (⌘⇧Z)">Redo</button>
          <span class="toolbar-sep" aria-hidden="true"></span>
          <button type="button" id="btn-probe" class="tool-toggle" title="Probe tool (P)">Probe</button>
          <button type="button" id="btn-scope" class="tool-toggle" title="Oscilloscope (O)">Scope</button>
          <label class="speed-label toolbar-speed">
            Flow speed
            <input type="range" id="speed" min="0.3" max="3" step="0.1" value="1" />
          </label>
        </div>
        <div class="status-bar" id="status">Drag pin to pin to wire · drag body to move</div>
      </div>
      <div class="board-wrap">
        <div class="board" id="board">
          <svg class="wires-layer" id="wires" aria-hidden="true"></svg>
          <svg class="particles-layer" id="particles" aria-hidden="true"></svg>
        </div>
      </div>
      </div>
      <aside class="tools-panel" aria-label="Probe and oscilloscope">
        <div id="probe-panel" class="tools-section"></div>
        <div id="scope-panel" class="tools-section"></div>
      </aside>
      </div>
    </main>
  </div>

  <footer class="footer">
    <kbd>⌘C</kbd>/<kbd>⌘V</kbd> copy/paste · <kbd>⌘Z</kbd>/<kbd>⌘⇧Z</kbd> undo/redo ·
    <kbd>⌘A</kbd> select all · <kbd>⌘S</kbd> save ·
    Shift+click multi-select · drag body to move · <kbd>Delete</kbd> removes ·
    Click or hold buttons · click switches to toggle ·
    <kbd>P</kbd> probe · <kbd>O</kbd> scope · hover parts for help
  </footer>

  <script>
${js}
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(root, "index.html"), shell);
console.log("Bundled index.html (" + (shell.length / 1024).toFixed(1) + " KB)");
