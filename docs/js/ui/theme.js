const KEY = 'smc.theme';
const NEXT = { system: 'dark', dark: 'light', light: 'system' };

export function initTheme(store) {
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'dark' || t === 'light') store.set({ theme: t });
  } catch { /* EC-22: preference not persisted */ }
  if (window.matchMedia) {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    store.set({ reducedMotion: mq.matches });
    mq.addEventListener('change', (e) => store.set({ reducedMotion: e.matches }));
  }
  let last;
  const apply = ({ theme }) => {
    if (theme === last) return;
    last = theme;
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    try {
      if (theme === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, theme);
    } catch { /* EC-22 */ }
  };
  apply(store.get());
  return store.subscribe(apply);
}

export function cycleTheme(store) {
  store.set({ theme: NEXT[store.get().theme] || 'system' });
}
