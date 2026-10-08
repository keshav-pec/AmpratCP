// Router and boot.

import { createStore, STORAGE_KEY, BACKUP_KEY, setTheme, setSidebar, resolveTheme } from './store.js';
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

function onSave(result) {
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
let firstRender = true;

function parseHash() {
  const raw = location.hash.slice(1);
  if (!raw.startsWith('/')) return null;
  const [path, query = ''] = raw.slice(1).split('?');
  return { name: path, params: new URLSearchParams(query) };
}

function flushCurrent() {
  if (current && current.flush) current.flush();
}

// `refresh` re-draws the current page in place (after another tab saved): no focus move, same scroll.
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

  if (current && current.unmount) current.unmount();
  const { title, view } = ROUTES[route.name];
  document.title = `${title} · Balloon Room`;

  for (const link of document.querySelectorAll('[data-route]')) {
    if (link.dataset.route === route.name) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  const scrollY = window.scrollY;
  viewRoot.replaceChildren();
  current = view.mount(viewRoot, { store, params: route.params }) || null;

  if (refresh) {
    window.scrollTo(0, scrollY);
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
window.addEventListener('pagehide', flushCurrent);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushCurrent();
});

// The skip link must not change the hash, or the router would treat it as a route.
document.querySelector('.skip-link').addEventListener('click', (event) => {
  event.preventDefault();
  document.getElementById('main').focus();
});

// True while the user is in the middle of something here: an open dialog, typed text, or
// focus on a control in this (focused) window. A re-draw then would lose their place.
function isBusy() {
  if (viewRoot.querySelector('dialog[open]')) return true;
  const active = document.activeElement;
  if (document.hasFocus() && active && active !== viewRoot && viewRoot.contains(active)) return true;
  return [...viewRoot.querySelectorAll('input[type="text"], input[type="url"], input[type="search"]')]
    .some((el) => el.value.trim() !== '');
}

// Another tab saved. Take its data first, so nothing here overwrites it, then save any
// notes typed here and re-draw the page unless that would throw away what is being typed.
window.addEventListener('storage', (event) => {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  if (!store.reload()) return;
  applyTheme();
  applySidebar();
  flushCurrent();
  if (!isBusy()) render({ refresh: true });
});

render();
