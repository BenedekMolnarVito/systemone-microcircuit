const AUTO_HIDE_MS = 8000;

// One banner at a time; error persists until dismissed; warn/info auto-hide unless ?test=1.
export function initBanner(store, bus) {
  const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
  const el = $('banner'), text = $('banner-text');
  const persist = new URLSearchParams(location.search).get('test') === '1';
  let timer = null;
  const dismiss = () => store.set({ banner: null });

  store.subscribe(({ banner }) => {
    clearTimeout(timer);
    el.hidden = !banner;
    if (!banner) return;
    text.textContent = banner.text;
    el.setAttribute('role', banner.level === 'error' ? 'alert' : 'status');
    el.dataset.level = banner.level;
    if (banner.level !== 'error' && !persist) timer = setTimeout(dismiss, AUTO_HIDE_MS);
  });
  $('banner-dismiss').addEventListener('click', dismiss);
  bus.on('banner', ({ level, text }) => store.set({ banner: { level, text } }));
}
