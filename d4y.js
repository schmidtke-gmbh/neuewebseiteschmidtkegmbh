/* Unterseite YouTube Done4You: Kanalzahlen im Hero wechseln durch die echten Kanäle unserer Kunden.
   Läuft von selbst, hält beim Darüberfahren an und bleibt nach einem Klick auf dem gewählten Kanal. */
/* Sprungziele der bisherigen Done4You-Seite (#leistung-video …) stehen noch im Menü der Seite „KI-Sichtbarkeit“.
   Die Leistungen stehen jetzt auf der Startseite: dorthin weiter, dort öffnet sich der passende Reiter. */
(function () {
  var h = location.hash.slice(1), home = document.querySelector('#nav a.logo');
  if (home && /^(leistung-(coaching|studio|video|landingpage|ads|skalierung)|growth-system|analyse|warum|foerderung)$/.test(h)) {
    location.replace(home.getAttribute('href').split('#')[0] + '#' + h);
  }
})();

(function () {
  'use strict';
  var box = document.getElementById('studio'), tabs = document.getElementById('stTabs');
  if (!box || !tabs) return;
  var btns = [].slice.call(tabs.querySelectorAll('button')), panes = [].slice.call(box.querySelectorAll('.st-pane'));
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cur = 0, auto = !reduced, timer = null, hover = false, visible = false, stand = document.getElementById('stStand');

  function show(i) {
    cur = i;
    btns.forEach(function (b, k) { b.setAttribute('aria-selected', String(k === i)); });
    panes.forEach(function (p, k) { p.classList.toggle('on', k === i); });
    if (stand && panes[i].dataset.stand) stand.textContent = 'Stand ' + panes[i].dataset.stand;
    if (window.v2count) [].forEach.call(panes[i].querySelectorAll('[data-count]'), window.v2count);
  }
  function loop() {
    clearTimeout(timer);
    tabs.classList.remove('auto');
    void tabs.offsetWidth;
    if (!auto || hover || !visible) return;
    tabs.classList.add('auto');
    timer = setTimeout(function () { show((cur + 1) % btns.length); loop(); }, 5200);
  }
  btns.forEach(function (b, i) { b.addEventListener('click', function () { auto = false; show(i); loop(); }); });
  box.addEventListener('mouseenter', function () { hover = true; loop(); });
  box.addEventListener('mouseleave', function () { hover = false; loop(); });
  new IntersectionObserver(function (es) { visible = es[0].isIntersecting; loop(); }, { threshold: 0.3 }).observe(box);
  show(0);
})();
