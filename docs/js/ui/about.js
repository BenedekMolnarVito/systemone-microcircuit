import { ABOUT as C } from './about-content.js';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex="0"]';

// Drawer: rendered once via textContent; focus trap, Esc closes, focus restored.
export function initAbout(store, bus) {
  const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
  const drawer = $('about-drawer'), closeBtn = $('btn-about-close');
  const el = (tag, text, parent) => { const e = document.createElement(tag); if (text != null) e.textContent = text; parent?.appendChild(e); return e; };
  const list = (items, parent) => { const ul = el('ul', null, parent); items.forEach((t) => el('li', t, ul)); };
  const sect = (id, title) => { const s = $(id); s.replaceChildren(); el('h2', title, s); return s; };

  let s = sect('about-pitch', 'What if a neuron were three typed decisions?');
  el('p', C.pitch, s);

  s = sect('about-mapping', 'Mapping');
  const table = el('table', null, s), head = el('tr', null, el('thead', null, table));
  C.mapping.header.forEach((h) => el('th', h, head));
  const body = el('tbody', null, table);
  C.mapping.rows.forEach((r) => { const tr = el('tr', null, body); r.forEach((c) => el('td', c, tr)); });
  el('p', C.mapping.note, s);

  s = sect('about-established', 'Established background');
  list(C.established, s);

  s = sect('about-proposal', "The owner's proposal");
  const nb = C.proposal.length - 2;
  list(C.proposal.slice(0, nb), s);
  el('p', C.proposal[nb], s);
  el('blockquote', C.proposal[nb + 1], s);

  s = sect('about-simplification', 'Simplifications');
  list(C.simplification, s);

  s = sect('about-refs', 'References');
  const ol = el('ol', null, s);
  C.refs.forEach(({ n, text, href }) => {
    const li = el('li', `${text} `, ol);
    li.value = n;
    const a = el('a', href, li);
    a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
  });

  let opener = null;
  const open = () => {
    if (!drawer.hidden) return;
    opener = document.activeElement;
    drawer.hidden = false;
    closeBtn.focus();
  };
  const close = () => {
    if (drawer.hidden) return;
    drawer.hidden = true;
    opener?.focus?.();
  };
  closeBtn.addEventListener('click', close);
  drawer.tabIndex = -1; // clicks on dialog text keep focus inside, so the trap below still sees Tab
  drawer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...drawer.querySelectorAll(FOCUSABLE)];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1], out = !f.includes(document.activeElement);
    if (e.shiftKey && (out || document.activeElement === first)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (out || document.activeElement === last)) { e.preventDefault(); first.focus(); }
  });
  bus.on('about:open', open);
  return { open, close };
}
