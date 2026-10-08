// Small DOM helpers. h() is the escaping layer: every string child becomes a text node
// (textContent), so user input is never parsed as HTML. No view uses innerHTML.

const SVG_NS = 'http://www.w3.org/2000/svg';

function applyAttrs(el, attrs) {
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.setAttribute('class', value);
    else if (key === 'text') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key in el && typeof value !== 'string' && el.namespaceURI !== SVG_NS) el[key] = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  }
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

// h('p', { class: 'muted' }, 'Hello ', name) — strings become text nodes, never markup.
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  applyAttrs(el, attrs);
  append(el, children);
  return el;
}

export function svg(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  applyAttrs(el, attrs);
  append(el, children);
  return el;
}

export function srOnly(text) {
  return h('span', { class: 'sr-only' }, text);
}

export function externalLink(href, ...children) {
  return h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, ...children, srOnly(' (opens in a new tab)'));
}

export function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

// Inline confirmation: the first click arms the button for `ms`, the second click confirms.
export function armConfirm(button, { confirmLabel = 'Confirm delete', ms = 4000, onConfirm }) {
  const original = Array.from(button.childNodes, (n) => n.cloneNode(true));
  let timer = null;

  function reset() {
    clearTimeout(timer);
    timer = null;
    button.classList.remove('is-armed');
    button.replaceChildren(...original.map((n) => n.cloneNode(true)));
  }

  button.addEventListener('click', () => {
    if (timer) {
      reset();
      onConfirm();
      return;
    }
    button.classList.add('is-armed');
    button.textContent = confirmLabel;
    timer = setTimeout(reset, ms);
  });
}

let toastTimer = null;

// Brief, polite status message. Used for confirmations like "Problem added".
export function toast(message) {
  const region = document.getElementById('toast');
  if (!region) return;
  clearTimeout(toastTimer);
  region.textContent = '';
  // Re-inserting the text makes screen readers announce repeated messages.
  requestAnimationFrame(() => {
    region.textContent = message;
    region.classList.add('is-visible');
  });
  toastTimer = setTimeout(() => {
    region.classList.remove('is-visible');
    region.textContent = '';
  }, 4000);
}

// Persistent message for problems the user must know about (saving failed, data reset).
export function showNotice(id, message) {
  const area = document.getElementById('notices');
  if (!area) return;
  let notice = document.getElementById(id);
  if (!notice) {
    notice = h('div', { class: 'notice', id, role: 'alert' });
    area.append(notice);
  }
  const dismiss = h('button', {
    type: 'button',
    class: 'btn btn-quiet',
    onclick: () => {
      notice.remove();
      // The button is gone, so put focus back at the start of the page content.
      const main = document.getElementById('main');
      if (main) main.focus();
    },
  }, 'Dismiss');
  notice.replaceChildren(h('p', null, message), dismiss);
}

export function clearNotice(id) {
  const notice = document.getElementById(id);
  if (notice) notice.remove();
}

// Shared look for a 0..1 progress bar. The bar is decorative; the text next to it carries the value.
export function progressBar(fraction) {
  const fill = h('div', { class: 'bar-fill' });
  fill.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
  return h('div', { class: 'bar', 'aria-hidden': 'true' }, fill);
}
