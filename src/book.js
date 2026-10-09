// The handbook reader (book.html). It shows CP_book.pdf with pdf.js and opens it on the page in
// the address (#page=N, counted like a PDF viewer: the cover is page 1). Many browsers, and most
// phones, ignore #page=N on a plain PDF link, which is why the app links here instead.
// Pages are drawn only near the screen, so even a phone copes with the whole book.

import { BOOK_PAGE_OFFSET, BOOK_PATH } from './data.js';
import { prefersReducedMotion } from './ui.js';

const PDFJS = '../vendor/pdfjs/pdf.min.js';
const WORKER = new URL('../vendor/pdfjs/pdf.worker.min.js', import.meta.url).href;
const MAX_WIDTH = 900; // CSS pixels; wide enough to read, narrow enough to see a whole line
const GAP = 16; // matches .reader-pages gap
const KEEP = 4; // pages kept drawn on each side of the current one

const bar = document.getElementById('reader-bar');
const main = document.getElementById('pages');
const statusEl = document.getElementById('reader-status');
const prevBtn = document.getElementById('reader-prev');
const nextBtn = document.getElementById('reader-next');
const form = document.getElementById('reader-goto');
const input = document.getElementById('reader-page');
const total = document.getElementById('reader-total');
const fileLink = document.getElementById('reader-file');

let pdfjs = null;
let doc = null;
let count = 0;
let pageSize = null; // the first page's size at scale 1; every page of the handbook is A4
let scale = 1;
let current = 1;
const slots = [];
const drawn = new Map(); // page number -> { task, textLayer }

// "Page 25" means the page printed as 25 in the book. The first 10 PDF pages come before it.
const bookPage = (n) => n - BOOK_PAGE_OFFSET;
const clamp = (n) => Math.min(Math.max(n, 1), count || n);

function pageFromHash() {
  const match = /(?:^#|&)page=(\d+)/.exec(location.hash);
  return match ? Number(match[1]) : BOOK_PAGE_OFFSET + 1;
}

function fail(message) {
  statusEl.replaceChildren(message, ' ');
  const link = document.createElement('a');
  link.href = `${BOOK_PATH}#page=${pageFromHash()}`;
  link.textContent = 'Open the PDF file instead.';
  statusEl.append(link);
  statusEl.hidden = false;
}

// ---------- layout ----------

function layout() {
  const available = Math.max(200, main.clientWidth - 24);
  scale = Math.min(available, MAX_WIDTH) / pageSize.width;
  const width = Math.floor(pageSize.width * scale);
  const height = Math.floor(pageSize.height * scale);
  main.style.setProperty('--page-width', `${width}px`);
  main.style.setProperty('--page-height', `${height}px`);
  main.style.setProperty('--total-scale-factor', String(scale));
  document.documentElement.style.setProperty('--reader-bar-height', `${bar.offsetHeight}px`);
}

function buildSlots() {
  const fragment = document.createDocumentFragment();
  for (let n = 1; n <= count; n += 1) {
    const slot = document.createElement('div');
    slot.className = 'reader-page';
    slot.dataset.page = String(n);
    slot.setAttribute('role', 'group');
    slot.setAttribute('aria-label', n > BOOK_PAGE_OFFSET ? `Page ${bookPage(n)}` : `Front matter, page ${n}`);
    slots.push(slot);
    fragment.append(slot);
  }
  main.append(fragment);
}

// ---------- drawing ----------

function forget(n) {
  const entry = drawn.get(n);
  if (!entry) return;
  if (entry.task) entry.task.cancel();
  if (entry.textLayer) entry.textLayer.cancel();
  drawn.delete(n);
  slots[n - 1].replaceChildren();
}

async function draw(n) {
  if (n < 1 || n > count || drawn.has(n)) return;
  const entry = {};
  drawn.set(n, entry);
  const slot = slots[n - 1];
  try {
    const page = await doc.getPage(n);
    if (drawn.get(n) !== entry) return;
    const viewport = page.getViewport({ scale });
    // Sharp on high-density screens, with a cap so phones don't run out of memory.
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.setAttribute('aria-hidden', 'true');
    const text = document.createElement('div');
    text.className = 'textLayer';
    slot.replaceChildren(canvas, text);

    entry.task = page.render({
      canvas,
      canvasContext: canvas.getContext('2d'),
      viewport,
      transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0],
    });
    // The invisible text layer lets you select and copy text, and screen readers read it.
    entry.textLayer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: text, viewport });
    await Promise.all([entry.task.promise, entry.textLayer.render()]);
  } catch (err) {
    if (err && err.name === 'RenderingCancelledException') return;
    if (drawn.get(n) === entry) drawn.delete(n);
  }
}

function drawAround(n) {
  for (let k = n - KEEP; k <= n + KEEP; k += 1) draw(k);
  for (const k of [...drawn.keys()]) {
    if (Math.abs(k - n) > KEEP + 2) forget(k);
  }
}

function redrawAll() {
  for (const k of [...drawn.keys()]) forget(k);
  drawAround(current);
}

// ---------- position ----------

function slotTop(n) {
  return slots[n - 1].getBoundingClientRect().top + window.scrollY;
}

function pageAtScroll() {
  // The page under a line a third of the way down the screen.
  const y = window.scrollY + bar.offsetHeight + (window.innerHeight - bar.offsetHeight) / 3;
  const first = slotTop(1);
  const step = slots[0].offsetHeight + GAP;
  return clamp(Math.floor((y - first) / step) + 1);
}

function showPosition() {
  const inBook = current > BOOK_PAGE_OFFSET;
  if (document.activeElement !== input) input.value = inBook ? String(bookPage(current)) : '';
  total.textContent = inBook ? `of ${bookPage(count)}` : 'Front matter';
  prevBtn.disabled = current <= 1;
  nextBtn.disabled = current >= count;
  fileLink.href = `${BOOK_PATH}#page=${current}`;
  document.title = inBook ? `Handbook p. ${bookPage(current)} · Balloon Room` : 'Handbook · Balloon Room';
}

function setCurrent(n, { updateHash = true } = {}) {
  const changed = n !== current;
  current = n;
  showPosition();
  drawAround(n);
  if (changed && updateHash) {
    try {
      history.replaceState(null, '', `#page=${n}`);
    } catch {
      // Some sandboxed frames refuse history changes; the reader still works.
    }
  }
}

function goTo(n, { smooth = false } = {}) {
  const target = clamp(n);
  setCurrent(target);
  window.scrollTo({
    top: slotTop(target) - bar.offsetHeight - 8,
    behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto',
  });
}

// ---------- controls ----------

let scrollFrame = 0;
window.addEventListener('scroll', () => {
  if (scrollFrame || !count) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    const n = pageAtScroll();
    if (n !== current) setCurrent(n);
  });
}, { passive: true });

let resizeTimer = 0;
let lastWidth = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!count || main.clientWidth === lastWidth) return;
    lastWidth = main.clientWidth;
    const keep = current;
    layout();
    goTo(keep);
    redrawAll();
  }, 150);
});

window.addEventListener('hashchange', () => {
  if (count) goTo(pageFromHash());
});

prevBtn.addEventListener('click', () => goTo(current - 1, { smooth: true }));
nextBtn.addEventListener('click', () => goTo(current + 1, { smooth: true }));

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = input.value.trim();
  const n = Number(value);
  const last = bookPage(count);
  if (!/^\d+$/.test(value) || n < 1 || n > last) {
    input.setAttribute('aria-invalid', 'true');
    total.textContent = `Enter 1 to ${last}`;
    return;
  }
  input.removeAttribute('aria-invalid');
  input.blur();
  goTo(n + BOOK_PAGE_OFFSET);
});
input.addEventListener('focus', () => input.select());
input.addEventListener('blur', () => {
  input.removeAttribute('aria-invalid');
  showPosition();
});

// The skip link must not change the hash, which holds the page.
document.querySelector('.skip-link').addEventListener('click', (event) => {
  event.preventDefault();
  main.focus({ preventScroll: true });
});

// ---------- start ----------

async function start() {
  try {
    pdfjs = await import(PDFJS);
  } catch {
    fail("This browser can't run the handbook reader.");
    return;
  }
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER;
  try {
    doc = await pdfjs.getDocument({
      url: BOOK_PATH,
      isEvalSupported: false,
      enableXfa: false,
      disableAutoFetch: true, // with range requests, fetch only the pages being read
      verbosity: pdfjs.VerbosityLevel.ERRORS,
    }).promise;
    const first = await doc.getPage(1);
    pageSize = first.getViewport({ scale: 1 });
  } catch {
    fail("Couldn't open the handbook. Check that CP_book.pdf sits next to index.html.");
    return;
  }
  count = doc.numPages;
  statusEl.hidden = true;
  layout();
  lastWidth = main.clientWidth;
  buildSlots();
  for (const el of [prevBtn, nextBtn, input]) el.disabled = false;
  goTo(pageFromHash());
}

start();
