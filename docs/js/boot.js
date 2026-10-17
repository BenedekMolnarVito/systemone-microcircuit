// Classic script: runs before first paint.
(function () {
  try {
    var t = localStorage.getItem('smc.theme');
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* storage blocked */ }
  if (location.protocol === 'file:') {
    document.addEventListener('DOMContentLoaded', function () {
      var n = document.querySelector('[data-testid="file-protocol-notice"]');
      if (!n) return;
      n.textContent = 'This page needs a web server (ES modules do not load from file://). Run: node tools/jev-proxy.mjs --no-api  then open http://127.0.0.1:8080, or use the GitHub Pages URL.';
      n.hidden = false;
    });
  }
})();
