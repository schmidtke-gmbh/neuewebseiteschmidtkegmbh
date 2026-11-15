/* Fallstudien-Seite: Filter nach Branche und Leistung, ganze Karte anklickbar. Gleiche Logik wie auf der bisherigen Seite. */
(function () {
  'use strict';
  /* ganze Karte anklickbar, auch auf Seiten ohne Filter */
  Array.prototype.slice.call(document.querySelectorAll('.fs-card')).forEach(function (k) {
    k.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      var a = k.querySelector('a.fall-link');
      if (a) window.location.href = a.href;
    });
  });
  var grid = document.getElementById('fsGrid');
  if (!grid) return;
  var karten = Array.prototype.slice.call(grid.querySelectorAll('.fs-card'));
  var leer = document.getElementById('fsLeer');
  var branche = 'all', leistung = 'all';

  function filtern() {
    var sichtbar = 0;
    karten.forEach(function (k) {
      var passt = (branche === 'all' || k.getAttribute('data-branche') === branche) &&
        (leistung === 'all' || (k.getAttribute('data-leistung') || '').split(' ').indexOf(leistung) !== -1);
      k.hidden = !passt;
      /* eine eingeblendete Karte soll nicht auf das Einblenden beim Scrollen warten */
      if (passt) { k.classList.add('in'); sichtbar++; }
    });
    if (leer) leer.hidden = sichtbar > 0;
  }

  function gruppe(attribut, setzen) {
    var knoepfe = Array.prototype.slice.call(document.querySelectorAll('.fs-pill[' + attribut + ']'));
    knoepfe.forEach(function (b) {
      b.addEventListener('click', function () {
        knoepfe.forEach(function (x) { var an = x === b; x.classList.toggle('on', an); x.setAttribute('aria-pressed', String(an)); });
        setzen(b.getAttribute(attribut));
        filtern();
      });
    });
    return knoepfe;
  }
  var kb = gruppe('data-filter', function (v) { branche = v; });
  var kl = gruppe('data-lfilter', function (v) { leistung = v; });

  var alle = document.getElementById('fsAlle');
  if (alle) alle.addEventListener('click', function () { kb[0].click(); kl[0].click(); });

})();
