// Keyboard shortcuts (SPEC 4.5). Reuses the buttons so behaviour matches clicks (disabled buttons ignore .click()).
const PRESETS = ['blank', 'vbar', 'hbar', 'diag45', 'diag135', 'checker', 'digit1', 'digit7', 'digit0', 'noise']; // index = digit
const BUTTONS = { s: 'btn-step', r: 'btn-reset', j: 'btn-ask-jev' };

export function initKeyboard(store, bus) {
  const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const t = e.target;
    if (t?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    if (!$('key-modal').hidden || !$('about-drawer').hidden) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === ' ') {
      if (t?.closest?.('[role="button"]')) return; // neuron nodes: Space selects (FR-UI-13)
      e.preventDefault();
      $('btn-play').click();
    } else if (BUTTONS[k]) $(BUTTONS[k]).click();
    else if (k === 'k') bus.emit('key:open', {});
    else if (k === 'a') bus.emit('about:open', {});
    else if (/^[0-9]$/.test(k)) $(`stimulus-preset-${PRESETS[+k]}`)?.click();
  });
}
