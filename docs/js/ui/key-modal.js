const FOCUSABLE = 'button:not([disabled]),input:not([disabled])';
export const SAFETY_TEXT = "Your key is only sent to the local proxy on this computer, which forwards it to api.typesafe.ai. It is never put in the URL, logs, or recordings. A pasted key is visible in your browser's developer tools (Network tab), so when presenting prefer the proxy's environment key.";
const NO_PROXY = 'Keys can only be used with the local proxy (node tools/jev-proxy.mjs)';

// Needs store.availability.live (health passed) and store.keySource ('env'|'none'|'mock'; T15 sets after health()).
export function initKeyModal(store, bus, keystore) {
  const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
  const modal = $('key-modal'), input = $('key-input'), remember = $('key-remember');
  const save = $('btn-key-save'), cancel = $('btn-key-cancel'), forget = $('btn-key-forget');
  const masked = $('key-masked'), err = $('key-error'), note = $('key-proxy-note'), btnKey = $('btn-key');
  input.spellcheck = false;
  input.autocomplete = 'off';

  let safety = modal.querySelector('.key-safety');
  if (!safety) { safety = document.createElement('p'); safety.className = 'key-safety'; safety.textContent = SAFETY_TEXT; modal.insertBefore(safety, masked.parentNode === modal ? masked : null); }

  const sync = () => {
    const s = store.get();
    const proxyKey = s.keySource === 'env' || s.keySource === 'mock';
    masked.textContent = keystore.masked();
    note.hidden = !proxyKey;
    if (proxyKey) note.textContent = s.keySource === 'env' ? 'The proxy is using its own key.' : 'The proxy is using a mock upstream; no key is needed.';
    input.hidden = save.hidden = remember.parentElement.hidden = proxyKey;
    // label "Key ✓" on header button when a key is held (or the proxy has its own)
    const has = keystore.has() || proxyKey;
    if (s.availability?.live) btnKey.textContent = has ? 'Key ✓' : 'Key';
  };

  let opener = null;
  const close = () => {
    if (modal.hidden) return;
    modal.hidden = true;
    input.value = '';
    opener?.focus?.();
  };
  const open = () => {
    if (!modal.hidden || !store.get().availability?.live) return; // FR-KEY-11
    opener = document.activeElement;
    err.textContent = '';
    input.value = '';
    remember.checked = false;
    sync();
    modal.hidden = false;
    (input.hidden ? cancel : input).focus();
  };

  save.addEventListener('click', () => {
    const r = keystore.set(input.value, remember.checked);
    if (!r.ok) { err.textContent = r.error; return; }
    err.textContent = '';
    if (r.memoryOnly) bus.emit('banner', { level: 'info', text: 'Storage unavailable — key kept for this tab only' });
    sync();
    close();
  });
  cancel.addEventListener('click', close);
  forget.addEventListener('click', () => {
    keystore.forget();
    const s = store.get();
    if (s.mode === 'LIVE' && s.keySource === 'none') {
      store.set({ mode: 'SIMULATED' });
      bus.emit('mode:changed', { mode: 'SIMULATED' });
    }
    sync();
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save.click(); } });
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...modal.querySelectorAll(FOCUSABLE)].filter((x) => !x.hidden && !x.closest('[hidden]'));
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  store.subscribe(sync);
  bus.on('key:open', open);
  sync();
  return { open, close };
}
