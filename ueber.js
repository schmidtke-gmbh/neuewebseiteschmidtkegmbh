/* Über-uns-Seite: Schrittfolgen der kleinen Animationen und die Zeitleiste von Fabians Weg.
   Menü, Einblenden, Zahlenregen und Video-Fenster kommen wie auf allen Seiten aus v2.js. */
(function () {
  'use strict';

  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Schrittfolgen ──
     Ein Baustein mit data-steps="N" zählt von 0 bis N und beginnt dann neu, aber nur solange er im Bild ist.
     Kinder mit data-s="k" bekommen die Klasse „on“, sobald Schritt k erreicht ist.
     Kinder mit data-n="a-b" bekommen „now“, solange der Schritt zwischen a und b liegt (die gerade gestellte Frage).
     Ohne Bewegung (Systemeinstellung) steht alles gleich im Endzustand. */
  $$('[data-steps]').forEach(function (box) {
    var n = parseInt(box.dataset.steps, 10), ms = parseInt(box.dataset.ms || '1300', 10), step = 0, timer = null;
    var ons = $$('[data-s]', box);
    var nows = $$('[data-n]', box).map(function (el) { var r = el.dataset.n.split('-'); return { el: el, a: +r[0], b: +(r[1] || r[0]) }; });
    function paint() {
      box.dataset.step = step;
      ons.forEach(function (el) { el.classList.toggle('on', step >= +el.dataset.s); });
      nows.forEach(function (o) { o.el.classList.toggle('now', step >= o.a && step <= o.b); });
    }
    function next() { step = step >= n ? 0 : step + 1; paint(); wait(); }
    /* Endzustand bleibt länger stehen, der leere Anfang nur kurz */
    function wait() { timer = setTimeout(next, step === n ? ms * 2.6 : step === 0 ? ms * 0.5 : ms); }
    if (reduced || !('IntersectionObserver' in window)) { step = n; paint(); return; }
    paint();
    new IntersectionObserver(function (es) {
      clearTimeout(timer); timer = null;
      if (es[0].isIntersecting) wait();
    }, { threshold: 0.3 }).observe(box);
  });

  /* ── Zeitleiste: Die Linie füllt sich beim Scrollen, erreichte Stationen leuchten auf ── */
  var tl = document.getElementById('abTl');
  if (tl) {
    var items = $$('li', tl), busy = false;
    var update = function () {
      busy = false;
      var r = tl.getBoundingClientRect(), line = window.innerHeight * 0.68;
      var p = Math.max(0, Math.min(1, (line - r.top - 10) / Math.max(1, r.height - 20)));
      tl.style.setProperty('--p', p.toFixed(4));
      tl.style.setProperty('--y', (p * Math.max(0, r.height - 20)).toFixed(1) + 'px');
      items.forEach(function (li) { li.classList.toggle('on', li.getBoundingClientRect().top + 12 < line); });
    };
    if (reduced) {
      var full = function () { tl.style.setProperty('--p', '1'); tl.style.setProperty('--y', Math.max(0, tl.getBoundingClientRect().height - 20).toFixed(1) + 'px'); };
      full();
      window.addEventListener('resize', full);
      items.forEach(function (li) { li.classList.add('on'); });
    } else {
      window.addEventListener('scroll', function () { if (!busy) { busy = true; requestAnimationFrame(update); } }, { passive: true });
      window.addEventListener('resize', update);
      update();
    }
  }
})();
