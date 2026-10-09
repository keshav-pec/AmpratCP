// The "Sync devices" button in the sidebar, its status line and its dialog.

import { h, toast, showNotice, clearNotice } from './ui.js';

const STATUS_TEXT = {
  off: 'Saved in this browser only.',
  syncing: 'Syncing…',
  synced: 'Synced with your other devices.',
  offline: "Offline. Changes will sync when you're back online.",
};

const ERROR_TEXT = {
  auth: "Sync stopped: the sync key wasn't accepted.",
  'not-configured': "Can't sync: the sync server isn't set up.",
  storage: "Can't sync: the server can't reach the database. Trying again soon.",
  'not-found': "Can't sync: the sync server wasn't found. Trying again soon.",
  'too-large': "Can't sync: your progress is too large for the server.",
  server: "Can't sync right now. Trying again soon.",
};

// Short words for the button's name and tooltip, which always start with its visible label.
const STATE_WORDS = { off: 'off', syncing: 'syncing', synced: 'synced', offline: 'offline', error: 'not syncing' };

// Why the server couldn't use the database, as the server reports it.
const STORAGE_REASONS = {
  auth: "The database didn't accept the username or password in MONGODB_URI. If you copied the string from Atlas, replace <db_password> (including the angle brackets) with the real password, and write characters like @ : / ? # % in it as %40 %3A %2F %3F %23 %25. If you changed the password, update MONGODB_URI in Vercel and redeploy.",
  network: "The server couldn't connect to your Atlas cluster. In Atlas, open Network Access, add 0.0.0.0/0 (Allow access from anywhere), wait until it shows Active, then try again. Also check the cluster isn't paused.",
  dns: "The cluster address in MONGODB_URI doesn't exist. Copy the connection string again from Atlas (Connect, then Drivers), put the password in, update MONGODB_URI in Vercel and redeploy.",
  uri: "MONGODB_URI isn't a valid connection string. It should look like mongodb+srv://user:password@cluster.xxxxx.mongodb.net/ with no quotes or spaces, and special characters in the password written as %40 and so on.",
  permission: "The database user can sign in but isn't allowed to read and write. In Atlas, open Database Access and give it the readWrite role on the balloonroom database (or 'Read and write to any database').",
  driver: "The server is missing the MongoDB driver. Redeploy from the latest code so Vercel installs it.",
};

function connectError(code, server, reason) {
  if (code === 'storage' && STORAGE_REASONS[reason]) return STORAGE_REASONS[reason];
  switch (code) {
    case 'address': return 'Enter a full address, like https://your-project.vercel.app, or leave this empty.';
    case 'https': return 'Use an address that starts with https://, so your sync key stays private on the way.';
    case 'key': return 'Enter your sync key.';
    case 'auth': return "That sync key wasn't accepted. Check that it matches SYNC_KEY on the server, including capitals.";
    case 'not-configured': return "The server is running, but sync isn't set up on it yet. Set MONGODB_URI and SYNC_KEY (at least 16 characters) in its settings, then deploy again.";
    case 'storage': return "The server couldn't use the database. Your Vercel project's Logs show the cause next to \"Sync storage error\".";
    case 'not-found': return server
      ? "There's no sync server at that address. Check it, or leave it empty if this page is served by your sync server."
      : "This site has no sync server. Enter your sync server's address, like https://your-project.vercel.app.";
    case 'network': return `Couldn't reach the server. Check the address and your connection. If this app and the server are on different sites, add ${window.location.origin} to ALLOWED_ORIGINS on the server.`;
    case 'too-large': return 'Your progress is too large for the server to accept.';
    default: return 'The server had a problem. Try again in a moment.';
  }
}

function statusText(status) {
  return status.state === 'error' ? ERROR_TEXT[status.error] || ERROR_TEXT.server : STATUS_TEXT[status.state];
}

export function createSyncUi({ sync, button, note }) {
  let collapsed = false;
  let shownNotice = null;

  // ----- connect form -----
  const serverInput = h('input', {
    type: 'url', id: 'sync-server', name: 'sync-server', inputmode: 'url', autocomplete: 'off', spellcheck: 'false',
    autocapitalize: 'off', 'aria-describedby': 'sync-server-hint',
  });
  const keyInput = h('input', {
    type: 'password', id: 'sync-key', name: 'sync-key', autocomplete: 'current-password', spellcheck: 'false',
    autocapitalize: 'off', 'aria-describedby': 'sync-key-hint',
  });
  // Lets a password manager save the key under a clear name, ready to fill on your other devices.
  const accountName = h('input', {
    type: 'text', name: 'username', autocomplete: 'username', value: 'Balloon Room sync', hidden: true, tabindex: '-1',
  });
  const showKey = h('input', { type: 'checkbox', id: 'sync-show-key', name: 'sync-show-key' });
  showKey.addEventListener('change', () => { keyInput.type = showKey.checked ? 'text' : 'password'; });
  const formError = h('p', { class: 'field-error', id: 'sync-form-error', role: 'alert', hidden: true });
  const refusedNote = h('p', { class: 'field-error', hidden: true },
    "The saved sync key wasn't accepted. Enter the current one to sync again.");
  const connectBtn = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Connect');
  const cancelBtn = h('button', { type: 'button', class: 'btn btn-quiet' }, 'Cancel');

  const connectForm = h('form', { class: 'sync-form', novalidate: true },
    h('p', null, 'Keep the same progress on all your devices. Every change is saved in this browser first, then sent to your own sync server, which keeps it in your MongoDB database.'),
    h('p', { class: 'muted small' }, 'Setting up the server takes a few minutes, once. The README explains how.'),
    refusedNote,
    h('div', { class: 'field' },
      h('label', { for: serverInput.id }, 'Server address (optional)'),
      h('p', { class: 'field-hint', id: 'sync-server-hint' }, 'Leave empty if this page is served by your sync server. Otherwise enter its address, like https://your-project.vercel.app.'),
      serverInput),
    h('div', { class: 'field' },
      h('label', { for: keyInput.id }, 'Sync key'),
      h('p', { class: 'field-hint', id: 'sync-key-hint' }, 'The SYNC_KEY you set on the server. This browser remembers it, and your password manager can save it for your other devices.'),
      accountName,
      keyInput,
      h('div', { class: 'field field-check' }, showKey, h('label', { for: showKey.id }, 'Show key'))),
    formError,
    h('div', { class: 'form-actions' }, connectBtn, cancelBtn),
  );

  // ----- connected panel -----
  const statusLine = h('p', { class: 'sync-status', 'aria-live': 'polite' });
  const serverLine = h('p', { class: 'muted' });
  const syncNowBtn = h('button', { type: 'button', class: 'btn btn-primary' }, 'Sync now');
  const disconnectBtn = h('button', { type: 'button', class: 'btn' }, 'Disconnect this device');
  const closeBtn = h('button', { type: 'button', class: 'btn btn-quiet' }, 'Close');
  const connectedPanel = h('div', { class: 'sync-connected' },
    statusLine,
    serverLine,
    h('p', null, 'Changes made here are sent to your sync server. Changes from your other devices show up when the app opens or comes back into view.'),
    h('div', { class: 'form-actions' }, syncNowBtn, disconnectBtn, closeBtn),
    h('p', { class: 'muted small' }, 'Disconnecting keeps your progress in this browser. It only stops syncing here.'),
  );

  const dialog = h('dialog', { class: 'dialog sync-dialog', 'aria-labelledby': 'sync-title' },
    h('h2', { id: 'sync-title' }, 'Sync across devices'),
    connectForm,
    connectedPanel,
  );
  document.body.append(dialog);

  function showForm(error) {
    formError.hidden = !error;
    formError.textContent = error || '';
    for (const input of [serverInput, keyInput]) input.removeAttribute('aria-invalid');
  }

  function render() {
    const status = sync.status();
    const refused = status.state === 'error' && status.error === 'auth';
    const connected = sync.isConnected() && !refused;
    // If the panel with focus is about to hide (say, the key was refused during "Sync now"),
    // move focus to the panel that replaces it.
    const hiding = connected ? connectForm : connectedPanel;
    const moveFocus = dialog.open && !hiding.hidden && hiding.contains(document.activeElement);
    connectForm.hidden = connected;
    connectedPanel.hidden = !connected;
    refusedNote.hidden = !refused;
    statusLine.textContent = statusText(status);
    serverLine.textContent = `Server: ${sync.server() || 'this site'}`;
    if (moveFocus) (connected ? syncNowBtn : keyInput).focus();
  }

  function open() {
    if (dialog.open) return;
    showForm(null);
    serverInput.value = sync.server();
    keyInput.value = '';
    keyInput.type = 'password';
    showKey.checked = false;
    render();
    dialog.showModal();
    if (connectForm.hidden) syncNowBtn.focus();
    else if (!refusedNote.hidden || serverInput.value) keyInput.focus();
    else serverInput.focus();
  }

  connectForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showForm(null);
    connectBtn.disabled = true;
    cancelBtn.disabled = true;
    connectBtn.textContent = 'Connecting…';
    const result = await sync.connect({ server: serverInput.value, key: keyInput.value });
    connectBtn.disabled = false;
    cancelBtn.disabled = false;
    connectBtn.textContent = 'Connect';
    if (!result.ok) {
      showForm(connectError(result.error, serverInput.value.trim(), result.reason));
      const field = ['key', 'auth'].includes(result.error) ? keyInput : serverInput;
      field.setAttribute('aria-invalid', 'true');
      field.focus();
      return;
    }
    keyInput.value = '';
    dialog.close();
    toast('Sync is on for this device.');
  });

  cancelBtn.addEventListener('click', () => dialog.close());
  closeBtn.addEventListener('click', () => dialog.close());
  syncNowBtn.addEventListener('click', async () => {
    syncNowBtn.disabled = true;
    await sync.syncNow();
    syncNowBtn.disabled = false;
    // The status line above says how it went.
    if (dialog.open) syncNowBtn.focus();
  });
  disconnectBtn.addEventListener('click', () => {
    sync.disconnect();
    dialog.close();
    toast('Sync is off on this device. Your progress stays here.');
  });
  dialog.addEventListener('close', () => {
    keyInput.value = '';
    button.focus();
  });
  button.addEventListener('click', open);

  function update(status) {
    const words = STATE_WORDS[status.state];
    button.dataset.state = status.state;
    button.setAttribute('aria-label', status.state === 'off' ? 'Sync devices' : `Sync devices, ${words}`);
    note.textContent = statusText(status);
    if (collapsed) button.title = status.state === 'off' ? 'Sync devices' : `Sync devices: ${words}`;
    else button.removeAttribute('title');
    if (dialog.open) render();

    // Problems that need you get a notice; ones that fix themselves only show in the status.
    // A notice shows once per problem, so dismissing it sticks.
    const problem = status.state === 'error' && ['auth', 'too-large'].includes(status.error) ? status.error : null;
    if (problem === shownNotice) return;
    shownNotice = problem;
    if (problem === 'auth') {
      showNotice('sync-notice', "Sync has stopped on this device because the server didn't accept its sync key. Your progress is still saved here.",
        { label: 'Enter the key', onClick: open });
    } else if (problem === 'too-large') {
      showNotice('sync-notice', "Your progress is too large for the sync server, so this device isn't syncing. It's still saved here. Shortening long notes can help.");
    } else {
      clearNotice('sync-notice');
    }
  }

  update(sync.status());

  return {
    update,
    open,
    setCollapsed(value) {
      collapsed = value;
      update(sync.status());
    },
  };
}
