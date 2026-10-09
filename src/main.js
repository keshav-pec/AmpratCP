// Router and boot.

import { createStore, STORAGE_KEY, BACKUP_KEY, setTheme, setSidebar, resolveTheme } from './store.js';
import { createSync, SYNC_STORAGE_KEY } from './sync.js';
import { createSyncUi } from './sync-ui.js';
import { showNotice, clearNotice, prefersReducedMotion } from './ui.js';
import * as home from './views/home.js';
import * as plan from './views/plan.js';
import * as topics from './views/topics.js';
import * as problems from './views/problems.js';

const ROUTES = {
  home: { title: 'Home', view: home },
  plan: { title: 'Plan', view: plan },
  topics: { title: 'Topics', view: topics },
  problems: { title: 'Problem log', view: problems },
};

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

let sync = null;

function onSave(result) {
  // Even when this browser couldn't save, the change can still reach the sync server.
  if (sync) sync.schedule();
  if (result.ok) {
    clearNotice('save-error');
    return;
  }
  const message = result.error === 'quota'
    ? "Couldn't save your last change because this browser's storage for the site is full. Free up space (for example by shortening long notes) and try again. Unsaved changes are lost when you close the tab."
    : "Couldn't save your last change because this browser is blocking storage. Unsaved changes are lost when you close the tab.";
  showNotice('save-error', message);
}

const store = createStore({ storage: getStorage(), onSave });

if (store.loadStatus === 'corrupt') {
  showNotice('load-corrupt', `Your saved progress couldn't be read, so Balloon Room started fresh. The unreadable data is kept in this browser under the key "${BACKUP_KEY}".`);
} else if (store.loadStatus === 'unavailable') {
  showNotice('load-unavailable', "This browser isn't letting Balloon Room use storage, so your progress won't be kept after you close the tab.");
}

// ---------- sync (optional, see the README) ----------

let syncUi = null;
sync = createSync({
  store,
  storage: getStorage(),
  fetch: (url, options) => window.fetch(url, options),
  pageUrl: document.baseURI,
  isOnline: () => navigator.onLine !== false,
  onStatus: (status) => { if (syncUi) syncUi.update(status); },
  onRemoteChange: () => refreshView(),
});
syncUi = createSyncUi({ sync, button: document.getElementById('sync-toggle'), note: document.getElementById('sync-note') });

// ---------- theme and sidebar ----------

const root = document.documentElement;
const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const themeToggle = document.getElementById('theme-toggle');
const sidebarToggle = document.getElementById('sidebar-toggle');
const THEME_COLORS = { light: '#F7F2E4', dark: '#1B1C14' };

function applyTheme() {
  const theme = resolveTheme(store.get().prefs.theme, Boolean(darkQuery && darkQuery.matches));
  root.setAttribute('data-theme', theme);
  themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
  document.querySelector('meta[name="theme-color"]').setAttribute('content', THEME_COLORS[theme]);
}

function applySidebar() {
  const collapsed = store.get().prefs.sidebar === 'collapsed';
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  root.setAttribute('data-sidebar', collapsed ? 'collapsed' : 'expanded');
  document.getElementById('sidebar-toggle-label').textContent = label;
  sidebarToggle.title = label;
  // Icon-only links get a tooltip; with labels showing it would just repeat them.
  for (const link of document.querySelectorAll('.nav a')) {
    if (collapsed) link.title = link.querySelector('.nav-label').textContent;
    else link.removeAttribute('title');
  }
  if (collapsed) themeToggle.title = 'Dark mode';
  else themeToggle.removeAttribute('title');
  syncUi.setCollapsed(collapsed);
}

themeToggle.addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  store.commit(setTheme(store.get(), next));
  applyTheme();
});

sidebarToggle.addEventListener('click', () => {
  const next = store.get().prefs.sidebar === 'collapsed' ? 'expanded' : 'collapsed';
  store.commit(setSidebar(store.get(), next));
  applySidebar();
});

if (darkQuery) {
  darkQuery.addEventListener('change', () => {
    if (store.get().prefs.theme === 'system') applyTheme();
  });
}

applyTheme();
applySidebar();

// ---------- router ----------

const viewRoot = document.getElementById('view');
let current = null;
let currentName = null;
let firstRender = true;
let refreshPending = false;

function parseHash() {
  const raw = location.hash.slice(1);
  if (!raw.startsWith('/')) return null;
  const [path, query = ''] = raw.slice(1).split('?');
  return { name: path, params: new URLSearchParams(query) };
}

function flushCurrent() {
  if (current && current.flush) current.flush();
}

// Remembers which control has focus, so the same one gets it back after a re-draw.
function describeFocus() {
  const el = document.activeElement;
  if (!el || el === viewRoot || !viewRoot.contains(el)) return null;
  if (el.id) return { anchor: `#${CSS.escape(el.id)}` };
  const anchor = el.parentElement.closest('[id], [data-id]');
  if (!anchor || anchor === viewRoot || !viewRoot.contains(anchor)) {
    return { anchor: null, tag: el.tagName, index: [...viewRoot.querySelectorAll(el.tagName)].indexOf(el) };
  }
  const selector = anchor.id ? `#${CSS.escape(anchor.id)}` : `[data-id="${CSS.escape(anchor.dataset.id)}"]`;
  return { anchor: selector, tag: el.tagName, index: [...anchor.querySelectorAll(el.tagName)].indexOf(el) };
}

function restoreFocus(saved) {
  if (!saved) return;
  const anchor = saved.anchor ? viewRoot.querySelector(saved.anchor) : viewRoot;
  const el = anchor && saved.tag ? anchor.querySelectorAll(saved.tag)[saved.index] : anchor;
  if (el && el !== viewRoot) el.focus({ preventScroll: true });
}

// `refresh` re-draws the current page in place (after another tab or device saved): same scroll,
// same focus, and the page keeps things like open weeks and filters.
function render({ refresh = false } = {}) {
  let route = parseHash();
  if (!route || !ROUTES[route.name]) {
    try {
      history.replaceState(null, '', '#/home');
    } catch {
      // Some sandboxed frames refuse history changes; Home still renders.
    }
    route = { name: 'home', params: new URLSearchParams() };
  }

  const sameView = refresh && current && currentName === route.name;
  const restore = sameView && current.snapshot ? current.snapshot() : null;
  const focus = sameView ? describeFocus() : null;
  refreshPending = false;

  if (current && current.unmount) current.unmount();
  const { title, view } = ROUTES[route.name];
  document.title = `${title} · Balloon Room`;

  for (const link of document.querySelectorAll('[data-route]')) {
    if (link.dataset.route === route.name) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  const scrollY = window.scrollY;
  viewRoot.replaceChildren();
  current = view.mount(viewRoot, { store, params: route.params, restore }) || null;
  currentName = route.name;

  if (refresh) {
    window.scrollTo(0, scrollY);
    restoreFocus(focus);
    return;
  }

  // Move focus to the new content after navigation, or to a deep-linked item.
  const target = viewRoot.querySelector('[data-autofocus]');
  const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
  if (target) {
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'center', behavior: firstRender ? 'auto' : behavior });
  } else if (!firstRender) {
    window.scrollTo(0, 0);
    const heading = viewRoot.querySelector('h1');
    if (heading) heading.focus({ preventScroll: true });
  }
  firstRender = false;
}

window.addEventListener('hashchange', () => render());

// Leaving the page: save notes being typed, and send anything waiting to the sync server.
function leaving() {
  flushCurrent();
  sync.flush();
}
window.addEventListener('pagehide', leaving);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') leaving();
  else sync.pull();
});
window.addEventListener('focus', () => {
  sync.pull();
  if (refreshPending) refreshView();
});
window.addEventListener('online', () => sync.syncNow());

// The skip link must not change the hash, or the router would treat it as a route.
document.querySelector('.skip-link').addEventListener('click', (event) => {
  event.preventDefault();
  document.getElementById('main').focus();
});

const TEXT_ENTRY = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, select';

// True while the user is in the middle of something: an open dialog, or typing (or about to)
// in this window. A re-draw then would lose their place, so it waits.
function isBusy() {
  if (document.querySelector('dialog[open]')) return true;
  const active = document.activeElement;
  if (document.hasFocus() && active && viewRoot.contains(active) && active.matches(TEXT_ENTRY)) return true;
  return [...viewRoot.querySelectorAll('input[type="text"], input[type="url"], input[type="search"]')]
    .some((el) => el.value.trim() !== '');
}

// While a finger or mouse button is down, a re-draw could swallow the click, so it waits.
let pointerDown = false;
window.addEventListener('pointerdown', () => { pointerDown = true; }, true);
window.addEventListener('pointercancel', () => { pointerDown = false; }, true);
window.addEventListener('pointerup', () => {
  pointerDown = false;
  catchUp();
}, true);

// The data changed elsewhere (another tab or device). Save any notes typed here on top of it,
// then re-draw the page, or do that as soon as the user is no longer busy.
function refreshView() {
  flushCurrent();
  if (pointerDown || isBusy()) {
    refreshPending = true;
    return;
  }
  render({ refresh: true });
}

// A dialog closed, a text field lost focus or a click ended: catch up on a re-draw that waited.
function catchUp() {
  if (!refreshPending) return;
  // Let the page finish what it's doing first (moving focus, handling the click).
  setTimeout(() => {
    if (refreshPending && !pointerDown && !isBusy()) render({ refresh: true });
  }, 0);
}
document.addEventListener('close', catchUp, true);
viewRoot.addEventListener('focusout', (event) => {
  if (event.target.matches(TEXT_ENTRY)) catchUp();
});

// Another tab saved. Take its data first, so nothing here overwrites it.
window.addEventListener('storage', (event) => {
  if (event.key === null || event.key === SYNC_STORAGE_KEY) sync.configChanged();
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  if (!store.reload()) return;
  applyTheme();
  applySidebar();
  refreshView();
});

render();
sync.start();
