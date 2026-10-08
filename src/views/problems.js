import { h, srOnly, externalLink, armConfirm, toast, plural } from '../ui.js';
import { WEEKS, TOPIC_BY_ID, RESULTS, MISTAKES, DEFAULT_RESULT, DEFAULT_MISTAKE, topicsForWeek, labelFor } from '../data.js';
import {
  addProblem, updateProblem, deleteProblem, markResolved, filterProblems, mistakePatterns,
  defaultRevisit, isHttpUrl,
} from '../store.js';

function options(list, selected) {
  return list.map((o) => h('option', { value: o.id, selected: o.id === selected }, o.label));
}

function topicOptions(selected, emptyLabel) {
  return [
    h('option', { value: '', selected: !selected }, emptyLabel),
    WEEKS.filter((w) => topicsForWeek(w.n).length).map((w) => h('optgroup', { label: `Week ${w.n}: ${w.title}` },
      topicsForWeek(w.n).map((t) => h('option', { value: t.id, selected: t.id === selected }, t.title)))),
  ];
}

// Builds the problem fields used by both the add form and the edit dialog.
function problemFields(prefix, initial = {}) {
  const ids = (name) => `${prefix}-${name}`;
  const errorEl = (name) => h('p', { class: 'field-error', id: ids(`${name}-error`), hidden: true });

  const name = h('input', { type: 'text', id: ids('name'), name: 'name', autocomplete: 'off', 'aria-required': 'true' });
  const url = h('input', { type: 'url', id: ids('url'), name: 'url', autocomplete: 'off', inputmode: 'url', placeholder: 'https://' });
  const topic = h('select', { id: ids('topic'), name: 'topic' }, topicOptions(initial.topicId || '', 'No specific topic'));
  const result = h('select', { id: ids('result'), name: 'result' }, options(RESULTS, initial.result || DEFAULT_RESULT));
  const mistake = h('select', { id: ids('mistake'), name: 'mistake' }, options(MISTAKES, initial.mistake || DEFAULT_MISTAKE));
  const idea = h('input', { type: 'text', id: ids('idea'), name: 'idea', autocomplete: 'off' });
  const revisit = h('input', { type: 'checkbox', id: ids('revisit'), name: 'revisit' });
  const nameError = errorEl('name');
  const urlError = errorEl('url');

  let revisitTouched = false;

  function fill(values) {
    name.value = values.name || '';
    url.value = values.url || '';
    topic.value = values.topicId || '';
    result.value = values.result || DEFAULT_RESULT;
    mistake.value = values.mistake || DEFAULT_MISTAKE;
    idea.value = values.idea || '';
    revisit.checked = typeof values.revisit === 'boolean' ? values.revisit : defaultRevisit(result.value);
    revisitTouched = false;
    setErrors({});
  }

  // The revisit box follows the result until the user sets it themselves.
  result.addEventListener('change', () => {
    if (!revisitTouched) revisit.checked = defaultRevisit(result.value);
  });
  revisit.addEventListener('change', () => { revisitTouched = true; });

  function setError(input, el, message) {
    el.hidden = !message;
    el.textContent = message || '';
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', el.id);
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  }

  function setErrors(errors) {
    setError(name, nameError, errors.name);
    setError(url, urlError, errors.url);
    if (errors.name) name.focus();
    else if (errors.url) url.focus();
  }

  function read() {
    return {
      name: name.value, url: url.value, topicId: topic.value, result: result.value,
      mistake: mistake.value, idea: idea.value, revisit: revisit.checked,
    };
  }

  const field = (label, input, extra = null) => h('div', { class: 'field' }, h('label', { for: input.id }, label), input, extra);

  const element = h('div', { class: 'form-grid' },
    field('Problem name', name, nameError),
    field('Link (optional)', url, urlError),
    field('Topic', topic),
    field('Result', result),
    field('Mistake', mistake),
    field('Key idea I was missing', idea),
    h('div', { class: 'field field-check' }, revisit, h('label', { for: revisit.id }, 'Mark to revisit')),
  );

  fill(initial);
  return { element, fill, read, setErrors, focus: () => name.focus() };
}

function problemRow(p, onDelete) {
  const topic = TOPIC_BY_ID[p.topicId];
  const title = p.url && isHttpUrl(p.url) ? externalLink(p.url, p.name) : p.name;
  const resolveBtn = h('button', { type: 'button', class: 'btn btn-small', dataset: { action: 'resolve' } }, 'Re-solved it', srOnly(`: ${p.name}`));
  const editBtn = h('button', { type: 'button', class: 'btn btn-small btn-quiet', dataset: { action: 'edit' } }, 'Edit', srOnly(` ${p.name}`));
  const deleteBtn = h('button', { type: 'button', class: 'btn btn-small btn-danger', dataset: { action: 'delete' } }, 'Delete', srOnly(` ${p.name}`));
  armConfirm(deleteBtn, { confirmLabel: 'Confirm delete', onConfirm: () => onDelete(p.id) });

  const meta = [topic ? topic.title : 'No specific topic', labelFor(RESULTS, p.result), `Mistake: ${labelFor(MISTAKES, p.mistake)}`];

  return h('li', { class: 'card problem', dataset: { id: p.id } },
    h('div', { class: 'problem-main' },
      h('div', { class: 'problem-head' },
        h('h3', { class: 'problem-name' }, title),
        p.revisit ? h('span', { class: 'badge badge-revisit' }, 'To revisit') : null),
      h('p', { class: 'muted' }, meta.join(' · ')),
      p.idea ? h('p', { class: 'problem-idea' }, h('span', { class: 'muted' }, 'Key idea: '), p.idea) : null,
      p.resolvedCount ? h('p', { class: 'muted small' }, `Re-solved ${plural(p.resolvedCount, 'time')}`) : null,
    ),
    h('div', { class: 'problem-actions' }, resolveBtn, editBtn, deleteBtn),
  );
}

export function mount(container, { store, params }) {
  const filter = { show: params.get('show') === 'revisit' ? 'revisit' : 'all', topicId: '', query: '' };

  // ----- add form -----
  const addFields = problemFields('add');
  const addForm = h('form', { class: 'problem-form', novalidate: true },
    addFields.element,
    h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'btn btn-primary' }, 'Add problem')),
  );
  addForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = addFields.read();
    const r = addProblem(store.get(), values);
    if (r.errors) {
      addFields.setErrors(r.errors);
      return;
    }
    store.commit(r.state);
    // Keep the topic for logging several problems from the same topic.
    addFields.fill({ topicId: values.topicId });
    addFields.focus();
    renderList();
    toast(`Added “${r.problem.name}”.`);
  });

  // ----- filters -----
  const showButtons = [
    { id: 'revisit', label: 'To revisit' },
    { id: 'all', label: 'All' },
  ].map((f) => h('button', {
    type: 'button', class: 'chip chip-filter', 'aria-pressed': String(filter.show === f.id), dataset: { show: f.id },
  }, f.label));
  const topicFilter = h('select', { id: 'problem-topic-filter', name: 'problem-topic-filter' }, topicOptions('', 'All topics'));
  const search = h('input', { type: 'search', id: 'problem-search', name: 'problem-search', autocomplete: 'off' });

  const patterns = h('p', { class: 'patterns' });
  const status = h('p', { class: 'muted', 'aria-live': 'polite' });
  const list = h('ul', { class: 'problem-list' });
  const empty = h('p', { class: 'empty', hidden: true });
  const listHeading = h('h2', { id: 'problem-list-title', tabindex: '-1' }, 'Your problems');

  // ----- edit dialog -----
  const editFields = problemFields('edit');
  let editingId = null;
  const formError = h('p', { class: 'field-error', hidden: true });
  const cancelBtn = h('button', { type: 'button', class: 'btn btn-quiet' }, 'Cancel');
  const editForm = h('form', { class: 'problem-form', novalidate: true },
    h('h2', { id: 'edit-title' }, 'Edit problem'),
    editFields.element,
    formError,
    h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'btn btn-primary' }, 'Save changes'), cancelBtn),
  );
  const dialog = h('dialog', { class: 'dialog', 'aria-labelledby': 'edit-title' }, editForm);
  cancelBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    const id = editingId;
    editingId = null;
    focusRow(id, 'edit');
  });
  editForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const r = updateProblem(store.get(), editingId, editFields.read());
    if (r.errors) {
      editFields.setErrors(r.errors);
      formError.hidden = !r.errors.form;
      formError.textContent = r.errors.form || '';
      return;
    }
    store.commit(r.state);
    renderList();
    toast('Changes saved.');
    dialog.close();
  });

  function openEdit(id) {
    const p = store.get().problems.find((x) => x.id === id);
    if (!p) return;
    editingId = id;
    formError.hidden = true;
    editFields.fill(p);
    dialog.showModal();
    editFields.focus();
  }

  // ----- list -----
  function renderPatterns() {
    const problems = store.get().problems;
    if (!problems.length) {
      patterns.replaceChildren(h('span', { class: 'muted' }, 'Mistake patterns will show here once you log problems.'));
      return;
    }
    const counts = mistakePatterns(problems);
    patterns.replaceChildren(
      h('strong', null, 'Mistake patterns: '),
      ...counts.flatMap((c, i) => [i ? ' · ' : '', `${c.label} ${c.count}`]),
    );
  }

  function renderList() {
    const all = store.get().problems;
    const shown = filterProblems(all, filter);
    list.replaceChildren(...shown.map((p) => problemRow(p, onDelete)));
    if (!all.length) {
      empty.textContent = 'No problems logged yet. Add one above when a problem gives you trouble.';
    } else if (filter.show === 'revisit' && !filter.topicId && !filter.query.trim() && !shown.length) {
      empty.textContent = 'Nothing is marked to revisit. Nice.';
    } else {
      empty.textContent = 'No problems match these filters.';
    }
    empty.hidden = shown.length !== 0;
    status.textContent = all.length ? `Showing ${shown.length} of ${plural(all.length, 'problem')}` : '';
    renderPatterns();
  }

  // After a row changes or disappears, keep keyboard focus somewhere sensible.
  function focusRow(id, action, fallbackIndex = 0) {
    const row = id && list.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (row) {
      row.querySelector(`[data-action="${action}"]`).focus();
      return;
    }
    const rows = list.querySelectorAll('.problem');
    const next = rows[Math.min(fallbackIndex, rows.length - 1)];
    if (next) next.querySelector('[data-action="resolve"]').focus();
    else listHeading.focus();
  }

  function onListClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const row = button.closest('.problem');
    const id = row.dataset.id;
    const index = Array.prototype.indexOf.call(list.children, row);
    if (button.dataset.action === 'resolve') {
      store.commit(markResolved(store.get(), id));
      const p = store.get().problems.find((x) => x.id === id);
      renderList();
      focusRow(id, 'resolve', index);
      toast(`Re-solved “${p.name}” (${plural(p.resolvedCount, 'time')} so far).`);
    } else if (button.dataset.action === 'edit') {
      openEdit(id);
    }
  }

  function onDelete(id) {
    const row = list.querySelector(`[data-id="${CSS.escape(id)}"]`);
    const index = Array.prototype.indexOf.call(list.children, row);
    const p = store.get().problems.find((x) => x.id === id);
    store.commit(deleteProblem(store.get(), id));
    renderList();
    focusRow(null, 'resolve', index);
    if (p) toast(`Deleted \u201c${p.name}\u201d.`);
  }

  list.addEventListener('click', onListClick);

  for (const b of showButtons) {
    b.addEventListener('click', () => {
      filter.show = b.dataset.show;
      for (const other of showButtons) other.setAttribute('aria-pressed', String(other === b));
      renderList();
    });
  }
  topicFilter.addEventListener('change', () => { filter.topicId = topicFilter.value; renderList(); });
  search.addEventListener('input', () => { filter.query = search.value; renderList(); });

  container.append(
    h('header', { class: 'page-head' },
      h('h1', { tabindex: '-1' }, 'Problem log'),
      h('p', { class: 'lede' }, 'Problems that gave you trouble, newest first. Re-solve the ones marked to revisit.'),
    ),
    h('section', { class: 'card', 'aria-labelledby': 'add-title' },
      h('h2', { id: 'add-title' }, 'Log a problem'),
      addForm),
    h('section', { class: 'problem-section', 'aria-labelledby': 'problem-list-title' },
      listHeading,
      patterns,
      h('div', { class: 'filters card' },
        h('div', { class: 'field field-show' },
          h('span', { class: 'field-label', id: 'problem-show-label' }, 'Show'),
          h('div', { class: 'filter-group', role: 'group', 'aria-labelledby': 'problem-show-label' }, showButtons)),
        h('div', { class: 'field' }, h('label', { for: topicFilter.id }, 'Topic'), topicFilter),
        h('div', { class: 'field field-search' }, h('label', { for: search.id }, 'Search problems'), search),
      ),
      status,
      list,
      empty),
    dialog,
  );

  renderList();

  return {
    unmount() {
      if (dialog.open) dialog.close();
    },
  };
}
