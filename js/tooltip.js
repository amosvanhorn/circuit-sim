/** Floating hover tooltips for components and pins */

import { getComponentHelp, getPinHelp } from "./help.js";

let tipEl = null;

function ensureTip() {
  if (tipEl) return tipEl;
  tipEl = document.createElement("div");
  tipEl.id = "help-tooltip";
  tipEl.className = "help-tooltip";
  tipEl.setAttribute("role", "tooltip");
  tipEl.hidden = true;
  document.body.appendChild(tipEl);
  return tipEl;
}

export function showTooltip(html, anchorEl) {
  const tip = ensureTip();
  tip.innerHTML = html;
  tip.hidden = false;
  tip.style.left = "-9999px";
  tip.style.top = "0";
  const rect = anchorEl.getBoundingClientRect();
  const margin = 8;
  let left = rect.left + rect.width / 2 - tip.offsetWidth / 2;
  let top = rect.top - tip.offsetHeight - margin;
  if (top < 8) top = rect.bottom + margin;
  left = Math.max(8, Math.min(left, window.innerWidth - tip.offsetWidth - 8));
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

export function hideTooltip() {
  if (tipEl) tipEl.hidden = true;
}

export function bindComponentTooltip(el, type) {
  const title = type.charAt(0).toUpperCase() + type.slice(1);
  const body = getComponentHelp(type);
  el.addEventListener("mouseenter", () => {
    showTooltip(`<strong>${title}</strong><p>${body}</p>`, el);
  });
  el.addEventListener("mouseleave", hideTooltip);
}

export function bindPinTooltip(pinEl, type, pinId, pinType) {
  const help = getPinHelp(type, pinId);
  pinEl.addEventListener("mouseenter", () => {
    showTooltip(
      `<strong>${pinId}</strong> <span class="tip-type">(${pinType})</span><p>${help}</p>`,
      pinEl
    );
  });
  pinEl.addEventListener("mouseleave", hideTooltip);
}

export function bindPaletteTooltip(itemEl, type) {
  bindComponentTooltip(itemEl, type);
}
