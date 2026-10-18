const AUTO_HIDE_MS = 8000;

// One banner at a time; error persists until dismissed; warn/info auto-hide unless ?test=1.
export function initBanner(store, bus) {
  const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
  const el = $('banner'), text = $('banner-text');
  const persist = new URLSearchParams(location.search).get('test') === '1';
  let timer = null, last = null;
  const dismiss = () => store.set({ banner: null });

  store.subscribe(({ banner }) => {
    if (banner === last) return; // re-arm the auto-hide timer only when the banner changes (I3)
    last = banner;
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
