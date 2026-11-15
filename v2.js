/* Startseite v2: Bewegung und Interaktion. Impact-Sektion läuft über v2-impact.js (aus der Live-Seite). */
(function () {
  'use strict';
  window.__v2 = 1; /* Lebenszeichen für das Notnetz im Seitenkopf */

  /* Der Verweis „Förderung“ in der Fußzeile von Impressum, Datenschutz und AGB zeigt noch auf die Startseite: weiter zur Förderseite */
  if (location.hash === '#foerderung') { location.replace('/foerderung/'); return; }

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Navigation ── */
  var nav = $('#nav'), dd = $('#dd');
  $('#burger').addEventListener('click', function () { nav.classList.toggle('open'); });
  $('.dd-btn', dd).addEventListener('click', function () {
    this.setAttribute('aria-expanded', String(dd.classList.toggle('open')));
  });
  document.addEventListener('click', function (e) { if (!dd.contains(e.target)) dd.classList.remove('open'); });
  $$('.nav-links a').forEach(function (a) { a.addEventListener('click', function () { nav.classList.remove('open'); dd.classList.remove('open'); }); });

  /* ── Origami-Icons: Sie bewegen sich nur, solange sie im Bild sind (Klasse „an“, Regeln in v2.css). Die Icons im Menü reagieren nur auf die Maus. ── */
  (function () {
    var oris = $$('.ori').filter(function (o) { return !o.closest('.dd-menu'); });
    if (!oris.length || reduced || !('IntersectionObserver' in window)) return;
    var oriIo = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle('an', e.isIntersecting); });
    }, { rootMargin: '-60px 0px -20px 0px' });
    oris.forEach(function (o) { oriIo.observe(o); });
  })();

  /* ── Fallstudien am Handy: Die Karten lassen sich wischen (Regeln in v2.css). Darunter Punkte, die zeigen, wo man ist, und die man antippen kann. ── */
  $$('.falls').forEach(function (falls) {
    var karten = $$('.fall', falls);
    if (karten.length < 2) return;
    var dots = document.createElement('div');
    dots.className = 'falls-dots';
    karten.forEach(function (k, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Fallstudie ' + (i + 1) + ' von ' + karten.length);
      b.addEventListener('click', function () { falls.scrollTo({ left: k.offsetLeft - (falls.clientWidth - k.offsetWidth) / 2, behavior: reduced ? 'auto' : 'smooth' }); });
      dots.appendChild(b);
    });
    /* Pfeile links und rechts neben den Punkten: zur vorigen und zur nächsten Karte */
    var leiste = document.createElement('div'), aktuell = 0;
    leiste.className = 'falls-nav';
    function pfeil(richtung, text) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'falls-pf' + (richtung < 0 ? ' zurueck' : '');
      b.setAttribute('aria-label', text);
      b.innerHTML = '<svg aria-hidden="true"><use href="#i-arrow"/></svg>';
      b.addEventListener('click', function () {
        var k = karten[Math.max(0, Math.min(karten.length - 1, aktuell + richtung))];
        falls.scrollTo({ left: k.offsetLeft - (falls.clientWidth - k.offsetWidth) / 2, behavior: reduced ? 'auto' : 'smooth' });
      });
      return b;
    }
    var zurueck = pfeil(-1, 'Vorige Fallstudie'), weiter = pfeil(1, 'Nächste Fallstudie');
    leiste.appendChild(zurueck); leiste.appendChild(dots); leiste.appendChild(weiter);
    falls.parentNode.insertBefore(leiste, falls.nextSibling);
    var knoepfe = $$('button', dots), wartet = false;
    function malen() {
      wartet = false;
      var mitte = falls.scrollLeft + falls.clientWidth / 2, nah = 0, weg = Infinity;
      karten.forEach(function (k, i) { var d = Math.abs(k.offsetLeft + k.offsetWidth / 2 - mitte); if (d < weg) { weg = d; nah = i; } });
      knoepfe.forEach(function (b, i) { b.setAttribute('aria-current', String(i === nah)); });
      aktuell = nah;
      zurueck.disabled = nah === 0; weiter.disabled = nah === karten.length - 1;
    }
    falls.addEventListener('scroll', function () { if (!wartet) { wartet = true; requestAnimationFrame(malen); } }, { passive: true });
    malen();
  });

  /* ── Fußzeile: Sie liegt unter der Seite und kommt beim Scrollen hervor (Regeln in v2.css). Nur wenn sie ganz ins Fenster passt,
     sonst wäre ihr oberer Teil nie zu sehen. ── */
  (function () {
    var foot = $('footer.foot'), main = $('main');
    if (!foot || !main || reduced) return;
    function pruefen() { document.documentElement.classList.toggle('foot-reveal', window.innerWidth > 900 && foot.offsetHeight <= window.innerHeight - 8); }
    pruefen();
    window.addEventListener('resize', pruefen);
    window.addEventListener('load', pruefen);
  })();

  /* ── Fußzeile: Das Laufband läuft nur, solange die Fußzeile zu sehen ist. Weil sie am Rechner unter der Seite liegt, zählt das Ende von <main>. ── */
  (function () {
    var foot = $('footer.foot'), main = $('main');
    if (!foot || !main) return;
    if (reduced) { foot.classList.add('sicht'); return; }
    var war = null, wartet = false;
    /* „sicht“ startet auch das gestaffelte Einblenden der Inhalte: erst, wenn ein gutes Stück der Fußzeile zu sehen ist */
    function sehen() { wartet = false; var s = main.getBoundingClientRect().bottom < window.innerHeight - Math.min(160, window.innerHeight * 0.18); if (s !== war) { war = s; foot.classList.toggle('sicht', s); } }
    sehen();
    /* bewusst ohne requestAnimationFrame: Käme der Aufruf einmal nicht an, bliebe der Inhalt der Fußzeile unsichtbar */
    window.addEventListener('scroll', sehen, { passive: true });
    window.addEventListener('resize', sehen);
    window.addEventListener('load', sehen);
  })();

  /* ── Kopfleiste: ganz oben auf der Seite ist sie am Handy durchsichtig (Klasse „oben“, Regeln in v2.css), beim Scrollen bekommt sie ihren Grund. ── */
  (function () {
    var war = null;
    function oben() { var o = window.scrollY < 24; if (o !== war) { war = o; nav.classList.toggle('oben', o); } }
    oben();
    window.addEventListener('scroll', oben, { passive: true });
  })();

  /* ── Knopf der Kopfleiste am Handy (unter 520 px, Regeln in v2.css): Er zeigt sich erst, wenn kein anderer Knopf zum Formular im Bild ist.
     Oben im ersten Bildschirm, bei „Was wir für dich umsetzen“ und unten im Abschluss stünden sonst zwei gleiche Knöpfe übereinander.
     Die Klasse „weg“ steht schon im Seitenquelltext, damit der Knopf beim Laden nicht kurz aufblitzt. Breiter als 520 px bewirkt sie nichts.
     Gilt für alle drei Seiten, weil alle dieses Skript laden. ── */
  (function () {
    var cta = $('.nav-cta', nav);
    if (!cta) return;
    if (!('IntersectionObserver' in window)) { cta.classList.remove('weg'); return; }
    var imBild = 0;
    /* oben 72 px abziehen: Was unter der Kopfleiste liegt, zählt nicht als sichtbar */
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var war = e.target.getAttribute('data-im-bild') === '1';
        if (e.isIntersecting === war) return;
        e.target.setAttribute('data-im-bild', e.isIntersecting ? '1' : '0');
        imBild += e.isIntersecting ? 1 : -1;
      });
      cta.classList.toggle('weg', imBild > 0);
    }, { rootMargin: '-72px 0px 0px 0px', threshold: 0.5 });
    $$('a[href*="/formular"]').forEach(function (a) { if (!nav.contains(a)) io.observe(a); });
  })();

  /* ── Herkunft merken, wie auf der bisherigen Seite: Kampagnen-Angaben (utm_…), erste Seite und Verweis bleiben für das Erstgespräch-Formular erhalten.
     Das Formular liest diese Werte aus dem Sitzungsspeicher; ohne diesen Block kämen Anfragen ohne Herkunft an. ── */
  (function () {
    try {
      var params = new URLSearchParams(location.search), keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
      keys.forEach(function (k) { var v = params.get(k); if (v) sessionStorage.setItem(k, v); });
      if (!sessionStorage.getItem('original_referrer')) sessionStorage.setItem('original_referrer', document.referrer || 'direct');
      if (!sessionStorage.getItem('landing_page')) sessionStorage.setItem('landing_page', location.href);
      $$('a[href*="/formular"]').forEach(function (a) {
        var url = new URL(a.href, location.href), changed = false;
        keys.forEach(function (k) { var v = params.get(k) || sessionStorage.getItem(k); if (v) { url.searchParams.set(k, v); changed = true; } });
        if (changed) a.href = url.href;
      });
    } catch (e) { /* ohne Sitzungsspeicher (privater Modus) geht es ohne Herkunft weiter */ }
  })();

  /* ── Google-Bewertungen in der Fußzeile: Im Seitenquelltext steht ein fester Stand (15.11.2026: 5,0 bei 47). Auf der echten Adresse holt
     dieses Stück den aktuellen Stand von der eigenen Netlify-Funktion (netlify/functions/bewertungen.mjs, höchstens zweimal am Tag gegen
     DataForSEO). Antwortet sie nicht oder liefert Unsinn, bleibt der feste Stand stehen. Es wird nichts von Google geladen. ── */
  (function () {
    var el = $('[data-gbew]');
    if (!el || !window.fetch || !/(^|\.)schmidtke-gmbh\.de$/.test(location.hostname)) return;
    fetch('/.netlify/functions/bewertungen').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !(d.wert >= 1 && d.wert <= 5) || !(d.anzahl >= 1)) return;
      $('[data-gbew-wert]', el).textContent = d.wert.toFixed(1).replace('.', ',');
      $('[data-gbew-zahl]', el).textContent = String(Math.round(d.anzahl));
    }).catch(function () {});
  })();

  /* ── Einblenden beim Scrollen ── */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
  /* Ein Element ohne eigene Fläche (display: contents, am Handy die Leiste der Leistungen) kommt nie „ins Bild“: gleich als eingeblendet zählen */
  $$('.rv').forEach(function (el) { if (getComputedStyle(el).display === 'contents') el.classList.add('in'); else io.observe(el); });

  /* ── Zähler ── */
  function fmt(n, dec) { return n.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
  function count(el) {
    var target = parseFloat(el.dataset.count), dec = parseInt(el.dataset.dec || '0', 10), suf = el.dataset.suffix || '';
    if (reduced) { el.textContent = fmt(target, dec) + suf; return; }
    var t0 = null, dur = 1800;
    function step(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4), v = target * e;
      el.textContent = fmt(dec ? v : Math.round(v), dec) + suf;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  window.v2count = count; /* die Unterseite zählt damit ihre Kanalzahlen hoch */
  var cio = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { count(e.target); cio.unobserve(e.target); } });
  }, { threshold: 0.7 });
  $$('[data-count]').forEach(function (el) { if (!el.closest('.panel')) cio.observe(el); });

  /* ── Laufender Zahlenregen (Mechanik aus der Live-Seite) ── */
  function rain(canvas) {
    if (reduced) return;
    var ctx = canvas.getContext('2d'), host = canvas.parentElement, w = 0, h = 0, raf = null, streams = [];
    var fontSize = 18, lineH = fontSize * 1.3, colW = fontSize * 1.5;
    function mk(col, scatter) {
      var len = 6 + Math.floor(Math.random() * 16), g = [];
      for (var j = 0; j < len; j++) g.push(Math.random() < 0.5 ? '0' : '1');
      return { x: col * colW + 6, y: scatter ? -(Math.random() * h * 2) : -(len * lineH + Math.random() * 200), speed: 0.55 + Math.random() * 0.95, len: len, g: g, tick: 0 };
    }
    function size() {
      w = canvas.width = host.offsetWidth; h = canvas.height = host.offsetHeight;
      streams = [];
      for (var i = 0, cols = Math.floor(w / colW); i < cols; i++) if (Math.random() < 0.7) streams.push(mk(i, true));
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      ctx.font = 'bold ' + fontSize + 'px "Courier New", monospace';
      ctx.textBaseline = 'top';
      for (var s = 0; s < streams.length; s++) {
        var st = streams[s];
        if (++st.tick > 8) { st.tick = 0; st.g[Math.floor(Math.random() * st.len)] = Math.random() < 0.5 ? '0' : '1'; }
        for (var j = 0; j < st.len; j++) {
          var cy = st.y + j * lineH;
          if (cy < -lineH || cy > h + lineH) continue;
          var a = j === st.len - 1 ? 1 : 0.08 + 0.82 * (j / (st.len - 1));
          if (cy > h * 0.85) a *= Math.max(0, 1 - (cy - h * 0.85) / (h * 0.15));
          if (a <= 0.01) continue;
          ctx.fillStyle = j === st.len - 1 ? 'rgba(140,200,240,' + a.toFixed(2) + ')' : 'rgba(39,125,193,' + a.toFixed(2) + ')';
          ctx.fillText(st.g[j], st.x, cy);
        }
        st.y += st.speed;
        if (st.y > h + 50) streams[s] = mk(Math.floor(Math.random() * Math.floor(w / colW)), false);
      }
      raf = requestAnimationFrame(draw);
    }
    size();
    window.addEventListener('resize', size);
    new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { if (!raf) raf = requestAnimationFrame(draw); }
      else if (raf) { cancelAnimationFrame(raf); raf = null; }
    }).observe(host);
  }
  $$('canvas.rain').forEach(rain);

  /* ── Mediathek: echte Arbeiten für die bewegten Wände ──
     Thumbnails: Dateien aus thumbs/ oder mit „yt:“ direkt von YouTube. Reels: Standbilder in reels/. Webdesigns: Kacheln in web/. */
  var THUMBS = ['yt:thxTIlBKZ_U', 'yt:ZkMuVvicPtg', 'yt:SeZ0hcw9Vz8', 'yt:8KQGOPuljeo', 'yt:l0Uzy3Fut5I', 'yt:Mivi-KOJ1HQ', 'yt:1J2UOTeFHwY', 'yt:KD-L6ZDriWE',
    'yt:da7-pkg8yrU', 'yt:-YqpziKoXDs', 'yt:LHd5tMoFnKI', 'yt:3UAfkYxvx1E', 'yt:T0_12xlXJJ8', 'yt:OcJQ4zDhbBI', 'yt:Jg01caHzqpE', 'yt:4zAKUhoF3rg',
    'yt:6oDv21xyoxU', 'jasmin_1ZMqkl_Y6xs', 'yt:sUmk3_v8344', 'yt:7qxLOxM1Qso', 'grebe_BE5EhPJ6lv4', 'yt:fh4ZYignNY0', 'yt:LUjNR06rTmk', 'yt:fiuZtedQ9oQ',
    'yt:wiLNZuwnPZo', 'yt:6kjQ8Iy3zuw', 'jasmin_5ZPAxGoGkKA', 'barwig_Gaqmh6ziPEo', 'yt:ekjEpMg1C4E', 'yt:iIaW_c6snGw', 'yt:sfMi6RJMhgM', 'barwig_YELfxVLFfHA',
    'yt:Dpmfp_o_Jpg', 'grebe_KS4anUJlwy0', 'yt:XReRCOh0Bu4', 'yt:l9L5HkMmO0k', 'yt:HaCWh_wOPBg', 'yt:BGVGxos8DsY', 'jasmin_Ag_AetLr514', 'yt:Z27rLwGNSk8',
    'barwig_cKR63b_75bM', 'yt:FCHMeJh5u-I', 'yt:wN6FBisLimg', 'yt:TUsxnDrDW9Y', 'grebe_OL-jzv6cOhw', 'jasmin_GPgGX5Q9W-Q', 'yt:b4sNeBZkFms', 'barwig_gjzfIMl8B8I',
    'yt:S-DoxQWolJY', 'yt:Mro3Y8hgkek', 'jasmin_o-3U7gOQiM8', 'yt:-FbGer_oyn0', 'yt:-lIwU1Qvwvg', 'grebe_bQI4hIsDMUM', 'yt:yeC7wJPSFe4', 'yt:37Td-Cs4Swg',
    'barwig_nK776sdDXcM', 'yt:IewCupGtiug', 'jasmin_tybgS0QUyuw', 'yt:2rTVQaeoV6g', 'yt:GVNoSpyCmCg', 'grebe_j2-3Ld7ZnTA', 'yt:U94DBlhcmrk', 'yt:02FfRw_jlSA',
    'barwig_twlh5d443NY', 'yt:kiZWZNqighk', 'yt:mzboxjAqQEM', 'grebe_td548rzULas', 'yt:CCZk5hs10Ig', 'yt:m4fTD0D9rwU', 'yt:-GsDCE0Seos', 'yt:hRx8HH3igok'];
  /* Aufrufe der YouTube-Videos (Video-Kennung → Zahl), Abfrage vom 12.11.2026; Grebe laut YouTube Studio vom selben Tag.
     Eine Zahl bekommt nur, was hier steht (ab 10.000 Aufrufen). Die ersten 14 Thumbnails laufen in der Hero-Wand der Startseite. */
  var THUMB_VIEWS = { '-YqpziKoXDs': 414458, 'thxTIlBKZ_U': 259853, 'LHd5tMoFnKI': 214699, 'T0_12xlXJJ8': 172130, '4zAKUhoF3rg': 102846, 'OcJQ4zDhbBI': 81315,
    'ZkMuVvicPtg': 73030, 'Jg01caHzqpE': 68994, 'sUmk3_v8344': 65870, 'Mivi-KOJ1HQ': 60033, 'fh4ZYignNY0': 48419, 'wiLNZuwnPZo': 35465,
    '1J2UOTeFHwY': 28296, '3UAfkYxvx1E': 27969, '8KQGOPuljeo': 27082, '7qxLOxM1Qso': 27062, 'KD-L6ZDriWE': 25189, 'LUjNR06rTmk': 23072,
    'l0Uzy3Fut5I': 20647, 'da7-pkg8yrU': 20365, 'SeZ0hcw9Vz8': 19821, '6oDv21xyoxU': 18053, 'fiuZtedQ9oQ': 13419, '6kjQ8Iy3zuw': 10224 };
  /* Die ersten zwölf Reels laufen in der Hero-Wand, immer zwei nebeneinander (links, rechts), je zwei Paare pro Spalte.
     Gut zu sehen sind dort: Spalte 1 rechts, Spalte 2 rechts, Spalte 3 beide. Spalte 1 links blendet zum Text hin aus, Spalte 2 links liegt hinter Fabian.
     Deshalb stehen die Reels mit den meisten Aufrufen auf den gut sichtbaren Plätzen. Alle zusammen laufen in der Reihe bei „Reels & Shorts“. */
  var REELS = ['boerner-umwelt', 'zotzmann-1', 'alesi-schlaf', 'jasmin-blutwerte',
    'chemnitz-torsten', 'emrich-nackentest', 'zotzmann-3', 'emrich-ohren',
    'boerner-entgiftung', 'emrich-platysma', 'boerner-kasse', 'emrich-nacken',
    'jasmin-menopause', 'emrich-augen', 'boerner-cortisol', 'jasmin-oestrogen', 'emrich-hallux', 'jasmin-probiert', 'emrich-1', 'zotzmann-6',
    'jasmin-schritte', 'emrich-2', 'jasmin-cortisol'];
  /* Aufrufe laut Instagram. Drei angeheftete Emrich-Reels: Zahl aus der Instagram-App (Report, Stand Oktober 2026). Alle anderen: Abfrage vom 12.11.2026.
     Reels ohne Eintrag (unbekannt oder noch klein) zeigen keine Zahl. Neue Zahl = hier eintragen, mehr ist nicht nötig. */
  /* Zotzmann: Das Weisheitszahn-Reel (441.500 und 203.700 Aufrufe, zweimal veröffentlicht) ist nicht von uns produziert und steht
     deshalb nicht mehr in der Liste (Fabian, 13.11.2026). Von uns sind zotzmann-1, -3 und -6. */
  var REEL_VIEWS = { 'emrich-nackentest': 283000, 'emrich-ohren': 238000, 'emrich-platysma': 142500, 'emrich-nacken': 90600, 'emrich-augen': 48100, 'emrich-hallux': 33700,
    'jasmin-blutwerte': 317100, 'jasmin-menopause': 41300, 'jasmin-oestrogen': 40900 };
  var WEBS = ['alesi', 'hellriegel', 'chemnitz', 'jasmin'];
  /* Wand nur mit Medizin-Themen (Seite Zahnarzt Marketing, data-wall="medizin"): Videos der Kanäle Zotzmann, Börner und Emrich,
     Kanalzuordnung am 15.11.2026 über YouTube geprüft. Zuerst die Videos mit Aufrufzahl, Zahnmedizin vorn. */
  var MED_THUMBS = ['yt:ZkMuVvicPtg', 'yt:thxTIlBKZ_U', 'yt:OcJQ4zDhbBI', 'yt:LHd5tMoFnKI', 'yt:Jg01caHzqpE', 'yt:T0_12xlXJJ8', 'yt:sUmk3_v8344', 'yt:4zAKUhoF3rg',
    'yt:Mivi-KOJ1HQ', 'yt:fh4ZYignNY0', 'yt:wiLNZuwnPZo', 'yt:1J2UOTeFHwY', 'yt:7qxLOxM1Qso', 'yt:LUjNR06rTmk', 'yt:l0Uzy3Fut5I', 'yt:da7-pkg8yrU', 'yt:6kjQ8Iy3zuw',
    'yt:Dpmfp_o_Jpg', 'yt:yeC7wJPSFe4', 'yt:ekjEpMg1C4E', 'yt:BGVGxos8DsY', 'yt:TUsxnDrDW9Y', 'yt:2rTVQaeoV6g', 'yt:kiZWZNqighk'];
  var MED_REELS = ['zotzmann-1', 'emrich-nackentest', 'zotzmann-3', 'emrich-ohren', 'boerner-umwelt', 'emrich-platysma', 'zotzmann-6', 'emrich-nacken',
    'boerner-entgiftung', 'emrich-augen', 'boerner-kasse', 'emrich-hallux'];
  var REEL_WHO = { boerner: 'Börner Lebenswerk', emrich: 'Tobias Emrich', jasmin: 'Jasmin Schmidtke', zotzmann: 'Zahnarzt Zotzmann', alesi: 'Dr. André Alesi', chemnitz: 'Kampfsportakademie Chemnitz' };
  function thumbSrc(n) { return n.indexOf('yt:') === 0 ? 'https://i.ytimg.com/vi/' + n.slice(3) + '/mqdefault.jpg' : 'thumbs/' + n + '.webp'; }
  function thumbId(n) { return n.indexOf('yt:') === 0 ? n.slice(3) : n.slice(n.indexOf('_') + 1); }
  /* Thumbnail; mit bekannter Aufrufzahl bekommt es Auge + Zahl wie die Reels */
  function thumbImg(n, lazy) {
    var v = THUMB_VIEWS[thumbId(n)], img = '<img src="' + thumbSrc(n) + '" alt="" loading="' + (lazy ? 'lazy' : 'eager') + '">';
    return v ? '<span class="wy">' + img + '<b class="wv">' + EYE + fmtNum(v) + '</b></span>' : img;
  }
  function reelImg(n, lazy) { return '<img src="reels/' + n + '.webp" alt="" loading="' + (lazy ? 'lazy' : 'eager') + '">'; }
  function fmtNum(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  var EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5C6.5 5 2.4 9 1 12c1.4 3 5.5 7 11 7s9.6-4 11-7c-1.4-3-5.5-7-11-7Zm0 11.2a4.2 4.2 0 1 1 0-8.4 4.2 4.2 0 0 1 0 8.4Zm0-6.3a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Z"/></svg>';
  /* Reel-Kachel der Hero-Wand: Standbild, dazu unten links die Aufrufe wie im Instagram-Raster (Auge + Zahl) */
  function reelTile(n) {
    var v = REEL_VIEWS[n];
    return '<span class="wr' + (v ? ' has-v' : '') + '">' + reelImg(n) + (v ? '<b class="wv">' + EYE + fmtNum(v) + '</b>' : '') + '</span>';
  }

  /* ── Hero: bewegte Wand. Startseite gemischt aus Thumbnails, Reels und Webdesigns; mit data-wall="yt" nur Thumbnails. ── */
  var wall = $('#wall');
  if (wall) {
    var ti = 0, ri = 0, wi = 0, wallHtml = '';
    var med = wall.dataset.wall === 'medizin', TH = med ? MED_THUMBS : THUMBS, RE = med ? MED_REELS : REELS;
    var plan = wall.dataset.wall === 'yt'
      ? ['yyyyyyyyy', 'yyyyyyyyy', 'yyyyyyyyy']
      : med ? ['yryyyryy', 'yyryyyry', 'yryyyryy'] : ['yrywyryy', 'wyryywry', 'yrywyryy'];
    plan.forEach(function (col) {
      var tiles = '';
      col.split('').forEach(function (k) {
        if (k === 'y') tiles += thumbImg(TH[ti++ % TH.length]);
        else if (k === 'w') tiles += '<div class="wt-w">' + '<img src="web/' + WEBS[wi++ % WEBS.length] + '.webp" alt="" loading="eager">' + '</div>';
        else tiles += '<div class="wt-r">' + reelTile(RE[ri++ % RE.length]) + reelTile(RE[ri++ % RE.length]) + '</div>';
      });
      wallHtml += '<div class="wall-col">' + tiles + tiles + '</div>';
    });
    wall.innerHTML = wallHtml.replace(/<img /g, '<img decoding="async" fetchpriority="low" ');
  }

  /* ── Hero: Anfrage-Karten (3er-Stapel, schiebt von unten hoch) ── */
  (function () {
    var cards = $$('.hero .lead-stack .lead-card');
    if (cards.length < 4) return;
    var next = 0;
    function tick() {
      cards.forEach(function (c) {
        if (c.classList.contains('slot-2')) { c.classList.remove('slot-2'); c.classList.add('slot-out'); setTimeout(function () { c.classList.remove('slot-out'); }, 650); }
      });
      cards.forEach(function (c) { if (c.classList.contains('slot-1')) { c.classList.remove('slot-1'); c.classList.add('slot-2'); } });
      cards.forEach(function (c) { if (c.classList.contains('slot-0')) { c.classList.remove('slot-0'); c.classList.add('slot-1'); } });
      cards[next].classList.add('slot-0');
      next = (next + 1) % cards.length;
    }
    tick(); setTimeout(tick, 400); setTimeout(tick, 800);
    if (!reduced) setInterval(tick, 3800);
  })();

  /* ── Hero: „Deine Kunden finden dich auf …“ ── */
  (function () {
    var items = $$('.found .fi'), i = 0;
    if (items.length < 2 || reduced) return;
    setInterval(function () { items[i].classList.remove('on'); i = (i + 1) % items.length; items[i].classList.add('on'); }, 2200);
  })();

  /* ── Hero: Fallstudien-Karte wechselt durch die Kunden ──
     Der Wechsel hängt am Ende der Fortschritts-Animation. Hält die Animation an (Maus darüber, Karte nicht im Bild), wartet auch der Wechsel. */
  (function () {
    var chip = $('.chip-case');
    if (!chip) return;
    var items = $$('.cc-item', chip), bar = $('.cc-bar', chip), i = 0;
    if (items.length < 2 || !bar || reduced) return;
    bar.innerHTML = items.map(function () { return '<i><b></b></i>'; }).join('');
    var segs = $$('i', bar);
    function show(n) {
      if (n !== i) {
        var prev = items[i];
        prev.classList.remove('on'); prev.classList.add('cc-leave');
        setTimeout(function () { prev.classList.remove('cc-leave'); }, 520);
      }
      i = n;
      items[i].classList.add('on');
      segs.forEach(function (s, k) { s.classList.remove('run'); s.classList.toggle('done', k < i); });
      void bar.offsetWidth;
      segs[i].classList.add('run');
      chip.setAttribute('href', items[i].dataset.href || '#cases');
    }
    bar.addEventListener('animationend', function () { show((i + 1) % items.length); });
    new IntersectionObserver(function (es) { chip.classList.toggle('paused', !es[0].isIntersecting); }).observe(chip);
    show(0);
  })();

  /* ── Agentur-Score: Karte erst zeigen, wenn das Widget da ist. Lädt es nicht, kommt die feste Karte. ── */
  (function () {
    var touch = window.matchMedia('(max-width: 820px), (hover: none) and (pointer: coarse)');
    $$('.trust-card').forEach(function (card) {
      var w = $('.trustmarkt-widget', card), done = false;
      function ready(live) { if (done) return; done = true; if (!live) card.classList.add('no-live'); card.classList.add('ready'); }
      if (!w || touch.matches) { card.classList.add('ready'); return; }
      function hook(f) { f.addEventListener('load', function () { setTimeout(function () { ready(true); }, 220); }); }
      var f = $('iframe', w);
      if (f) hook(f);
      else new MutationObserver(function (m, o) { var fr = $('iframe', w); if (fr) { o.disconnect(); hook(fr); } }).observe(w, { childList: true, subtree: true });
      setTimeout(function () { ready(!!$('iframe', w)); }, 4000);
    });
  })();

  /* ── Hero: Aufnahme-Zeit ── */
  (function () {
    var el = $('#tc'), s = 0;
    if (!el || reduced) return;
    function two(n) { return (n < 10 ? '0' : '') + n; }
    setInterval(function () { s++; el.textContent = two(Math.floor(s / 3600)) + ':' + two(Math.floor(s / 60) % 60) + ':' + two(s % 60); }, 1000);
  })();

  /* ── Fallstudien: Vorschau-Video erst laden, wenn es in Sicht kommt ── */
  var lazyIo = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.src = e.target.dataset.src; lazyIo.unobserve(e.target); } });
  }, { rootMargin: '300px' });
  $$('iframe[data-src]').forEach(function (f) { lazyIo.observe(f); });

  /* ── Fallstudien: Foto und Freisteller zoomen beim Scrollen gemeinsam leicht heran, der Kopf ragt dadurch weiter heraus ── */
  (function () {
    var pops = $$('.pop');
    if (!pops.length || reduced) return;
    var live = [], ticking = false;
    function paint() {
      ticking = false;
      var vh = window.innerHeight;
      live.forEach(function (p) {
        var r = p.getBoundingClientRect();
        var t = 1 - (r.top + r.height * 0.5) / vh;
        p.style.setProperty('--z', Math.max(0, Math.min(1, t * 1.15)).toFixed(3));
      });
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }
    var popIo = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var k = live.indexOf(e.target);
        if (e.isIntersecting && k < 0) live.push(e.target);
        if (!e.isIntersecting && k >= 0) live.splice(k, 1);
      });
      onScroll();
    }, { rootMargin: '10% 0px' });
    pops.forEach(function (p) { popIo.observe(p); });
    window.addEventListener('scroll', onScroll, { passive: true });
  })();

  /* ── Galerie: Tipp vergrößert die Kachel auf dem Handy ── */
  (function () {
    var mq = window.matchMedia('(max-width: 900px)');
    $$('.kg-item').forEach(function (t) {
      t.addEventListener('click', function () {
        if (!mq.matches) return;
        var was = t.classList.contains('kg-open');
        $$('.kg-item.kg-open').forEach(function (o) { o.classList.remove('kg-open'); });
        if (!was) t.classList.add('kg-open');
      });
    });
  })();

  /* ── System-Vergleich: KI-Tool, Videoagentur, Schmidtke OS ── */
  (function () {
    var sys = $('#system');
    if (!sys) return;
    var btns = $$('.seg button', sys), ind = $('.seg-ind', sys), ibn = $('#ibn');
    var order = ['ki', 'va', 'os'], hold = { ki: 2800, va: 2800, os: 8500 };
    var auto = !reduced, timer = null, ibTimers = [], visible = false;

    function place() {
      var b = btns.filter(function (x) { return x.getAttribute('aria-pressed') === 'true'; })[0];
      if (!b) return;
      ind.style.width = b.offsetWidth + 'px';
      ind.style.transform = 'translateX(' + (b.offsetLeft - 5) + 'px)';
    }
    function set(m) {
      sys.dataset.mode = m;
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.m === m)); });
      place();
      ibTimers.forEach(clearTimeout); ibTimers = [];
      ibn.textContent = '0';
      if (m === 'os') [1, 2, 3, 4].forEach(function (n, i) { ibTimers.push(setTimeout(function () { ibn.textContent = String(n); }, 1100 + i * 550)); });
    }
    function loop() {
      clearTimeout(timer);
      if (!auto || !visible) return;
      timer = setTimeout(function () {
        var i = order.indexOf(sys.dataset.mode);
        set(order[(i + 1) % order.length]);
        loop();
      }, hold[sys.dataset.mode]);
    }
    btns.forEach(function (b) { b.addEventListener('click', function () { auto = false; clearTimeout(timer); set(b.dataset.m); }); });
    window.addEventListener('resize', place);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    set(reduced ? 'os' : 'ki');
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; loop(); }, { threshold: 0.3 }).observe($('.pipe', sys));
  })();

  /* ── Leistungen: Reiter. Am Rechner laufen sie von selbst weiter. Am Handy (bis 760 px, Regeln in v2.css) stehen sie untereinander:
     Der getippte Reiter klappt auf, ein zweiter Tipp klappt ihn zu, und nichts wechselt von selbst (sonst springt die Seite beim Lesen). ── */
  (function () {
    var tabs = $('#tabs');
    if (!tabs) return;
    var stapel = window.matchMedia('(max-width: 760px)');
    var btns = $$('.tab', tabs), panels = $$('.lst .panel'), cur = 0, auto = !reduced && !stapel.matches, timer = null, visible = false, hover = false;
    function show(i) {
      var b = btns[i], vorher = stapel.matches && b ? b.getBoundingClientRect().top : null;
      cur = i;
      btns.forEach(function (x, k) { x.setAttribute('aria-selected', String(k === i)); });
      panels.forEach(function (p, k) { p.classList.toggle('on', k === i); });
      if (!b) return; /* am Handy: alle zugeklappt */
      $$('[data-count]', panels[i]).forEach(count);
      if (vorher !== null) {
        /* Die getippte Zeile bleibt unter dem Finger, auch wenn darüber ein langer Reiter zuklappt */
        var weg = b.getBoundingClientRect().top - vorher, de = document.documentElement;
        if (Math.abs(weg) > 1) { de.style.scrollBehavior = 'auto'; window.scrollBy(0, weg); de.style.scrollBehavior = ''; }
      } else if (tabs.scrollWidth > tabs.clientWidth) tabs.scrollTo({ left: b.offsetLeft - 16, behavior: 'smooth' });
    }
    function restartBar() { tabs.classList.remove('auto'); void tabs.offsetWidth; if (auto && visible && !hover) tabs.classList.add('auto'); }
    function loop() {
      clearTimeout(timer);
      restartBar();
      if (!auto || !visible || hover) return;
      timer = setTimeout(function () { show((cur + 1) % btns.length); loop(); }, 7000);
    }
    btns.forEach(function (b, i) { b.addEventListener('click', function () { auto = false; clearTimeout(timer); tabs.classList.remove('auto'); show(stapel.matches && cur === i ? -1 : i); }); });
    /* Wechsel zwischen Handy- und breiter Ansicht (Handy drehen): Am Handy läuft nichts von selbst; in der breiten Ansicht ist immer ein Reiter offen */
    function wechsel() {
      if (stapel.matches) { auto = false; clearTimeout(timer); tabs.classList.remove('auto'); }
      else if (cur < 0) show(0);
    }
    if (stapel.addEventListener) stapel.addEventListener('change', wechsel); else if (stapel.addListener) stapel.addListener(wechsel);
    var area = $('.lst .wrap');
    panels.forEach(function (p) {
      p.addEventListener('mouseenter', function () { hover = true; loop(); });
      p.addEventListener('mouseleave', function () { hover = false; loop(); });
    });
    tabs.classList.remove('auto');
    /* Sprungziele der bisherigen Startseite stehen noch in den Menüs der anderen Seiten (index.html#leistung-video …): passenden Reiter öffnen */
    var alt = { 'leistung-coaching': 0, 'growth-system': 0, 'leistung-studio': 1, 'leistung-video': 1, 'leistung-landingpage': 3, 'leistung-ads': 4, 'analyse': 5, 'leistung-skalierung': 6 };
    function fromHash() {
      var h = location.hash.slice(1);
      if (alt.hasOwnProperty(h)) {
        auto = false; clearTimeout(timer); show(alt[h]);
        /* am Handy zur aufgeklappten Zeile scrollen (das Sprungziel selbst liegt über der ganzen Liste) */
        if (stapel.matches) setTimeout(function () { btns[alt[h]].scrollIntoView(); }, 80);
      }
    }
    window.addEventListener('hashchange', fromHash);
    fromHash();
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; loop(); }, { threshold: 0.25 }).observe(area);
  })();

  /* ── Kalender: ein Drehtag füllt sechs Wochen ── */
  (function () {
    var cal = $('#cal');
    if (!cal) return;
    var icon = { d: 'i-video', v: 'i-ytm', s: 'i-phone', p: 'i-post' }, pat = ['s', 'v', 's', 'p', 's'], html = '', n = 0;
    for (var w = 0; w < 6; w++) {
      html += '<div class="cal-w"><small>W' + (w + 1) + '</small>';
      for (var d = 0; d < 5; d++) {
        var t = w === 0 && d === 0 ? 'd' : pat[d];
        html += '<div class="cc ' + t + '"><svg style="--i:' + (n++) + '"><use href="#' + icon[t] + '"/></svg></div>';
      }
      html += '</div>';
    }
    cal.innerHTML = html;
  })();

  /* ── Aufwand: Aufgaben-Brett. Unser Team hakt eine Aufgabe nach der anderen ab, dann beginnt es von vorn. ── */
  (function () {
    var list = $('#todo');
    if (!list) return;
    var items = $$('li', list), nEl = $('#todoN'), pEl = $('#todoP'), n = 0, timer = null;
    function paint() { nEl.textContent = String(n); pEl.style.transform = 'scaleX(' + (n / items.length) + ')'; }
    if (reduced) { items.forEach(function (li) { li.classList.add('done'); }); n = items.length; paint(); return; }
    function step() {
      if (n < items.length) { items[n].classList.add('done'); n++; paint(); timer = setTimeout(step, 640); return; }
      timer = setTimeout(function () {
        items.forEach(function (li) { li.classList.remove('done'); });
        n = 0; paint();
        timer = setTimeout(step, 1000);
      }, 3400);
    }
    new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { if (timer === null) timer = setTimeout(step, 700); }
      else { clearTimeout(timer); timer = null; }
    }, { threshold: 0.35 }).observe(list);
  })();

  /* ── Thumbnail-Spalten und Thumbnail-Bänder aus der Mediathek ── */
  (function () {
    var tw = $('#tw');
    if (tw) {
      var colsN = 4, out = '';
      for (var c = 0; c < colsN; c++) {
        var imgs = '';
        for (var k = c; k < THUMBS.length; k += colsN) imgs += thumbImg(THUMBS[k], true);
        out += '<div class="tw-col">' + imgs + imgs + '</div>';
      }
      tw.innerHTML = out;
    }
    /* Bänder: jede Reihe zeigt einen anderen Teil der Mediathek und läuft endlos */
    var rows = $$('[data-tb]');
    rows.forEach(function (row, r) {
      var imgs = '';
      for (var k = r; k < THUMBS.length; k += rows.length) imgs += thumbImg(THUMBS[k], true);
      row.innerHTML = imgs + imgs;
    });
  })();

  /* ── Leistungen: Reels mehrerer Kunden als laufende Reihe ── */
  (function () {
    var row = $('#rmq');
    if (!row) return;
    var h = REELS.map(function (n) {
      var who = REEL_WHO[n.split('-')[0]] || '', v = REEL_VIEWS[n];
      return '<figure class="rp' + (v ? ' has-v' : '') + '">' + reelImg(n, true) + '<figcaption>' + (v ? '<b>' + EYE + fmtNum(v) + '<u> Aufrufe</u></b>' : '') + '<span>' + who + '</span></figcaption></figure>';
    }).join('');
    row.innerHTML = h + h;
  })();

  /* ── Hero: Anzeige oben links. Im Entwurf umschaltbar, die Wahl bleibt im Browser gespeichert. ── */
  (function () {
    var stage = $('.stage[data-chip]'), sw = $('#chipSw');
    if (!stage) return;
    var allowed = ['name', 'drehtag', 'system', 'rec', 'none'], pick = null;
    try { pick = new URLSearchParams(location.search).get('chip') || localStorage.getItem('v2chip'); } catch (e) { /* ohne Speicher bleibt die Vorgabe */ }
    function set(v, store) {
      if (allowed.indexOf(v) < 0) v = 'name';
      stage.dataset.chip = v;
      if (sw) $$('button', sw).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.chip === v)); });
      if (store) { try { localStorage.setItem('v2chip', v); } catch (e) { /* nicht schlimm */ } }
    }
    set(pick || stage.dataset.chip, false);
    if (sw) $$('button', sw).forEach(function (b) { b.addEventListener('click', function () { set(b.dataset.chip, true); }); });

    var os = $('#osT');
    if (os && !reduced) {
      var states = ['Themenplan steht', 'Dreh ist im Kasten', 'Schnitt läuft', 'Video ist online', 'Anfrage kommt rein'], i = 2;
      setInterval(function () {
        if (stage.dataset.chip !== 'system') return;
        os.classList.add('sw');
        setTimeout(function () { i = (i + 1) % states.length; os.textContent = states[i]; os.classList.remove('sw'); }, 320);
      }, 2600);
    }
  })();

  /* ── Laufbänder ── */
  $$('[data-mq]').forEach(function (row) {
    var h = row.dataset.mq.split('|').map(function (t) { return '<span>' + t + '</span>'; }).join('');
    row.innerHTML = h + h;
  });
  var ytb = $('#ytb');
  if (ytb) ytb.innerHTML += ytb.innerHTML;

  /* ── Hintergrundvideos: laden erst, wenn sie in die Nähe des Bildschirms kommen, und halten an, sobald sie ihn verlassen.
     Bei „weniger Bewegung“ bleibt das Standbild stehen. ── */
  (function () {
    var vids = $$('video[data-lazy]');
    function prepare(v) {
      if (v.dataset.ready) return;
      v.dataset.ready = '1';
      if (v.dataset.poster) v.poster = v.dataset.poster;
      if (reduced) return;
      $$('source[data-src]', v).forEach(function (s) { s.src = s.dataset.src; });
      v.load();
    }
    function play(v) { prepare(v); if (reduced) return; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    if (!vids.length) return;
    if (!('IntersectionObserver' in window)) { vids.forEach(play); return; }
    var vio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) play(e.target); else if (e.target.dataset.ready) e.target.pause(); });
    }, { rootMargin: '500px 0px' });
    vids.forEach(function (v) { vio.observe(v); });
  })();

  /* ── Video-Fenster: 2-Minuten-Video und die Videos der Fallstudien. Geladen wird erst beim Klick. ── */
  (function () {
    var modal = $('#vsl'), body = $('#vslBody'), loaded = false, from = null;
    if (!modal || !body) return;
    /* Beim Öffnen springt der Tastatur-Fokus auf „Schließen“, beim Schließen zurück auf den Knopf, der das Video geöffnet hat */
    function show() {
      from = document.activeElement;
      modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false');
      var x = $('.modal-x', modal); if (x) x.focus();
    }
    function openVsl() {
      if (!loaded) {
        loaded = true;
        ['https://fast.wistia.com/player.js', 'https://fast.wistia.com/embed/yv7ne517ww.js'].forEach(function (src, i) {
          var sc = document.createElement('script'); sc.src = src; sc.async = true; if (i) sc.type = 'module'; document.head.appendChild(sc);
        });
      }
      modal.classList.remove('wide');
      body.innerHTML = '<wistia-player media-id="yv7ne517ww" seo="false" aspect="0.8"></wistia-player>';
      show();
    }
    function openVideo(spec, ratio) {
      var kind = spec.split(':')[0], id = spec.slice(kind.length + 1);
      var src = kind === 'yt'
        ? 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0'
        : 'https://fast.wistia.net/embed/iframe/' + encodeURIComponent(id) + '?autoPlay=true';
      modal.classList.add('wide');
      var rt = (ratio || '16/9').split('/');
      modal.style.setProperty('--ratio', rt[0] + ' / ' + rt[1]);
      modal.style.setProperty('--ratio-n', String(rt[0] / rt[1]));
      body.innerHTML = '<div class="modal-frame"><iframe src="' + src + '" title="Video" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>';
      show();
    }
    function close() {
      if (!modal.classList.contains('open')) return;
      /* Wistia-Player erst anhalten, dann entfernen (sonst meldet sein Skript einen Fehler) */
      var p = $('wistia-player', body);
      try { if (p && p.pause) p.pause(); } catch (e) { /* Player noch nicht bereit */ }
      modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true');
      if (p) setTimeout(function () { if (!modal.classList.contains('open')) body.innerHTML = ''; }, 150); else body.innerHTML = '';
      if (from && from.focus) from.focus();
      from = null;
    }
    $$('[data-vsl]').forEach(function (b) { b.addEventListener('click', openVsl); });
    $$('[data-video]').forEach(function (b) { b.addEventListener('click', function () { openVideo(b.dataset.video, b.dataset.ratio); }); });
    $$('[data-close]', modal).forEach(function (b) { b.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  })();
})();
