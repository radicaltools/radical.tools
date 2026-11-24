// Arriving with #section in the URL (a link from the landing page or
// elsewhere): the browser jumps before the web fonts arrive, and the text
// they reflow moves the section down. Jump again once they are in, unless
// the reader has scrolled meanwhile.
(function () {
  if (!location.hash) return;
  var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (!target) return;
  var moved = false;
  window.addEventListener('wheel', function () { moved = true; }, { once: true, passive: true });
  window.addEventListener('touchmove', function () { moved = true; }, { once: true, passive: true });
  window.addEventListener('keydown', function () { moved = true; }, { once: true });
  function land() {
    if (moved) return;
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(land);
  window.addEventListener('load', land);
})();

// Highlight the TOC entry for the part being read: the last section or
// heading the TOC links to whose top has passed under the site nav (the
// last one at the end of the page), and keep that entry in view in the TOC,
// which is taller than the window.
(function () {
  var toc = document.querySelector('.doc-toc');
  if (!toc) return;
  var entries = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]')).map(function (a) {
    return { link: a, target: document.getElementById(a.getAttribute('href').slice(1)) };
  }).filter(function (e) { return e.target; });
  entries.sort(function (a, b) {
    return a.target.compareDocumentPosition(b.target) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });
  if (!entries.length) return;
  var current = null;
  var queued = false;
  function update() {
    queued = false;
    var line = 96;
    var pick = entries[0];
    var atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    if (atEnd) pick = entries[entries.length - 1];
    else for (var i = 0; i < entries.length; i++) {
      if (entries[i].target.getBoundingClientRect().top <= line) pick = entries[i];
      else break;
    }
    if (pick.link === current) return;
    if (current) current.classList.remove('active');
    current = pick.link;
    current.classList.add('active');
    var t = toc.getBoundingClientRect();
    var r = current.getBoundingClientRect();
    var margin = 48;
    if (r.top < t.top + margin) toc.scrollTop -= t.top + margin - r.top;
    else if (r.bottom > t.bottom - margin) toc.scrollTop += r.bottom - (t.bottom - margin);
  }
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  update();
})();

// A code block or table that scrolls sideways (always on a phone, some at
// any width) can be scrolled with the keyboard: it takes focus while it
// overflows (WCAG 2.1.1; axe's scrollable-region-focusable). A table's wrap
// is named by the heading above it, a code block is read as its text.
(function () {
  var regions = Array.prototype.slice.call(document.querySelectorAll('pre, .doc-table-wrap'));
  if (!regions.length) return;
  function headingBefore(el) {
    for (var node = el; node && node !== document.body; node = node.parentElement) {
      for (var prev = node.previousElementSibling; prev; prev = prev.previousElementSibling) {
        if (/^H[2-4]$/.test(prev.tagName)) return prev.textContent.trim();
      }
    }
    return '';
  }
  function update() {
    regions.forEach(function (el) {
      var scrolls = el.scrollWidth > el.clientWidth + 1;
      if (scrolls && !el.hasAttribute('tabindex')) {
        el.setAttribute('tabindex', '0');
        if (el.tagName !== 'PRE') {
          var name = headingBefore(el);
          el.setAttribute('role', 'region');
          el.setAttribute('aria-label', name ? name + ' (table)' : 'Table');
        }
      } else if (!scrolls && el.getAttribute('tabindex') === '0') {
        el.removeAttribute('tabindex');
        if (el.tagName !== 'PRE') { el.removeAttribute('role'); el.removeAttribute('aria-label'); }
      }
    });
  }
  var queued = false;
  window.addEventListener('resize', function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; update(); });
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(update);
  update();
})();
