/** Minimal shared tooltip bound to the page's #tooltip element. */

let el = null;

function ensure() {
  if (!el) el = document.getElementById("tooltip");
  return el;
}

export function showTooltip(html, event) {
  const node = ensure();
  if (!node) return;
  node.innerHTML = html;
  node.hidden = false;
  moveTooltip(event);
}

export function moveTooltip(event) {
  const node = ensure();
  if (!node || node.hidden) return;
  const pad = 14;
  const { innerWidth, innerHeight } = window;
  const rect = node.getBoundingClientRect();
  let x = event.clientX + pad;
  let y = event.clientY + pad;
  if (x + rect.width > innerWidth) x = event.clientX - rect.width - pad;
  if (y + rect.height > innerHeight) y = event.clientY - rect.height - pad;
  node.style.left = `${Math.max(4, x)}px`;
  node.style.top = `${Math.max(4, y)}px`;
}

export function hideTooltip() {
  const node = ensure();
  if (node) node.hidden = true;
}
