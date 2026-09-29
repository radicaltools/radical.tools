/* Theme bootstrap for radical.tools pages. Loaded synchronously in <head> so
   the first paint already has the right theme. Same storage key as Studio/Hub. */
(function () {
  var KEY = 'radical-theme';
  var root = document.documentElement;

  function current() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }
  function apply(theme) {
    root.setAttribute('data-theme', theme);
  }

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
  apply(saved === 'light' || saved === 'dark'
    ? saved
    : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));

  document.addEventListener('DOMContentLoaded', function () {
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    function paint() {
      var t = current();
      buttons.forEach(function (b) {
        b.textContent = t === 'dark' ? '\u2600' : '\u263E';
        b.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
        b.title = b.getAttribute('aria-label');
      });
    }
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        var next = current() === 'dark' ? 'light' : 'dark';
        apply(next);
        try { localStorage.setItem(KEY, next); } catch (e) { /* ignore */ }
        paint();
      });
    });
    paint();
  });
})();
