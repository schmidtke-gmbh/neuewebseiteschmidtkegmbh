(function () {
  'use strict';

  var mobileQuery = window.matchMedia('(max-width: 820px), (hover: none) and (pointer: coarse)');
  var widgetSrc = 'https://widget.trustmarkt.de/embed/v1/embed.js';

  function fallbackMarkup() {
    return '' +
      '<span class="agency-score-star" aria-hidden="true">★</span>' +
      '<span class="agency-score-copy">' +
        '<span class="agency-score-title">Agentur-Score</span>' +
        '<span class="agency-score-rating">4,9 <small aria-hidden="true">★★★★★</small></span>' +
        '<span class="agency-score-meta">Hervorragend · 76 Bewertungen · AgenturMarkt</span>' +
      '</span>';
  }

  function ensureFallback(widget) {
    widget.classList.add('agency-score-live');

    var next = widget.nextElementSibling;
    if (next && next.classList.contains('agency-score-fallback')) return next;

    var fallback = document.createElement('a');
    fallback.className = 'agency-score-fallback';
    fallback.href = 'https://agenturmarkt.de/agentur/schmidtke-gmbh-rottweil';
    fallback.target = '_blank';
    fallback.rel = 'noopener noreferrer';
    fallback.setAttribute('aria-label', 'Schmidtke GmbH bei AgenturMarkt: Agentur-Score 4,9 bei 76 Bewertungen');
    fallback.innerHTML = fallbackMarkup();
    widget.insertAdjacentElement('afterend', fallback);
    return fallback;
  }

  function loadDesktopWidget() {
    if (mobileQuery.matches || document.querySelector('script[data-agenturmarkt-loader]')) return;

    var script = document.createElement('script');
    script.src = widgetSrc;
    script.async = true;
    script.defer = true;
    script.dataset.agenturmarktLoader = 'true';
    document.head.appendChild(script);
  }

  var forceFallback = false;
  function applyMode() {
    document.documentElement.classList.toggle('agenturmarkt-mobile', mobileQuery.matches || forceFallback);
    if (!mobileQuery.matches) loadDesktopWidget();
  }

  function init() {
    document.querySelectorAll('.trustmarkt-widget').forEach(ensureFallback);
    applyMode();
    // Fördercheck: erscheint das Live-Widget nicht (Skript blockiert), den statischen Score zeigen
    var w0 = document.querySelector('.trustmarkt-widget');
    var initialHtml = w0 ? w0.innerHTML : '';
    setTimeout(function () {
      var w = document.querySelector('.trustmarkt-widget');
      if (w && w.innerHTML === initialHtml && !mobileQuery.matches) { forceFallback = true; applyMode(); }
    }, 6000);

    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', applyMode);
    } else if (typeof mobileQuery.addListener === 'function') {
      mobileQuery.addListener(applyMode);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
