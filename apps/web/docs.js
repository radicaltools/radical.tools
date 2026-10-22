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
