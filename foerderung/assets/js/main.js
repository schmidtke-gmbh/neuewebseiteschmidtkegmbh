/* ═══════════════════════════════════════════════════════════
   Fördercheck · Schmidtke GmbH
   Rechenlogik nach Förderrichtlinie vom 14.12.2022, geändert 12.12.2024.
   Programm läuft bis 31.12.2026.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── Konfiguration: hier austauschen, sonst nirgends ─── */
  var CONFIG = {
    calNamespace: '20-minuten-gesprach-am-telefon',
    calLink: 'schmidtke-gmbh/20-minuten-gesprach-am-telefon',
    calOrigin: 'https://app.cal.com',
    calPhoneField: 'attendeePhoneNumber',   // Slug des Telefon-Felds im Cal.com-Event (erste Zusatzfrage)
    dankeUrl: 'https://schmidtke-gmbh.de/danke?von=foerdercheck',
    dankeDelayMs: 2500,
    phoneDisplay: '0741 94213040',
    funnelName: 'foerdercheck'
  };

  /* ─── Förderwerte ─── */
  var MAX_KOSTEN_NETTO = 3500;   // je Beratung, förderfähige Obergrenze (nur intern für die Rechnung, steht nirgends auf der Seite)
  var HANDEL2030_LAND = 'Baden-Württemberg', HANDEL2030_BRANCHE = 'Einzelhandel (Ladengeschäft)';
  var QUOTE_OST = 0.80;          // max. 2.800 €
  var QUOTE_WEST = 0.50;         // max. 1.750 €

  // 80 % ohne Rückfrage. Sachsen, Niedersachsen und Rheinland-Pfalz laufen über Schritt 1b.
  var LAENDER_80 = ['Brandenburg', 'Mecklenburg-Vorpommern', 'Sachsen-Anhalt', 'Thüringen'];
  var RUECKFRAGEN = {
    'Sachsen':        { frage: 'Liegt der Sitz in der Region Leipzig?',      jaIst80: false },
    'Niedersachsen':  { frage: 'Liegt der Sitz im Landkreis Lüneburg?',      jaIst80: true  },
    'Rheinland-Pfalz':{ frage: 'Liegt der Sitz in der Region Trier?',        jaIst80: true  }
  };
  var BRANCHE_AUSSCHLUSS = {
    'Coach / Trainer': 'Coaches und Trainer sind von dieser Förderung ausgenommen. Die Förderstelle schließt Unternehmen aus, deren eigene Leistung in Beratung, Coaching oder Wissensvermittlung besteht.',
    'Berater / Consultant': 'Unternehmensberatungen und Consultants sind laut Förderrichtlinie nicht antragsberechtigt, weil ihre eigene Leistung Beratung ist.',
    'Anwalt / Steuerberater': 'Rechts- und Steuerberatung sowie Wirtschaftsprüfung sind von der Förderung ausgenommen.'
  };
  var BRANCHE_HINWEIS = { 'Coach / Trainer': true, 'Berater / Consultant': true };

  var CASES = {
    barwig:   { branche: 'Handwerk · Barwig Group', title: 'Vom Handwerksbetrieb zum regionalen Experten',
                stats: [['300.000+', 'Aufrufe auf YouTube'], ['60 Min.', 'Eigenaufwand pro Woche'], ['#1', 'KI-Empfehlung in seiner Nische']] },
    zotzmann: { branche: 'Zahnmedizin · Zotzmann', title: '500+ Anfragen von Privatzahler-Patienten',
                stats: [['880.000+', 'Aufrufe auf YouTube'], ['40.000', 'Abonnenten'], ['500+', 'Anfragen von Privatzahlern']] },
    boerner:  { branche: 'Integrative Medizin · Börner Lebenswerk', title: 'Aus Videos wird planbarer Umsatz',
                stats: [['1 Mio+ €', 'Umsatz über YouTube'], ['4 Mio+', 'Video-Aufrufe'], ['48.000', 'Abonnenten']] }
  };
  var CASE_BY_ANLIEGEN = {
    'Mehr Anfragen gewinnen': 'zotzmann',
    'Sichtbarkeit und Positionierung': 'boerner',
    'Prozesse und KI im Betrieb': 'barwig',
    'Etwas anderes': 'barwig'
  };

  /* ─── Helfer ─── */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var euro = function (n) { return n.toLocaleString('de-DE') + ' €'; };
  var track = function (event, data) {
    var payload = { event: event, funnel: CONFIG.funnelName };
    for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) payload[k] = data[k];
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
  };

  /* ═══ Seite: Jahr, Nav, Animationen, Countup, FAQ, Sticky-CTA ═══ */
  var yearEl = $('#year'); if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  // Hero-Video: Autoplay anstoßen (mobil nur stumm + inline), bei Ablehnung bleibt das Poster
  var heroVideo = $('#heroVideo');
  function heroPlay() { if (!heroVideo || reduce) return; var pr = heroVideo.play(); if (pr && pr.catch) pr.catch(function () {}); }
  if (heroVideo && !reduce) {
    // Kleine Datei fürs Handy, große ab Tablet; ohne JS bleibt das Poster stehen
    var small = window.innerWidth <= 640;
    heroVideo.src = heroVideo.getAttribute(small ? 'data-src-small' : 'data-src');
    heroVideo.addEventListener('canplay', function () { heroVideo.classList.add('is-ready'); }, { once: true });
    heroPlay();
  }
  document.addEventListener('visibilitychange', function () { if (!heroVideo) return; if (document.hidden) heroVideo.pause(); else if (!document.body.classList.contains('funnel-open')) heroPlay(); });

  // Weitere stumme Loop-Videos: laden, sobald sie in Sicht kommen; kleine Datei fürs Handy
  $$('.lazy-video').forEach(function (v) {
    if (reduce) return;
    v.muted = true; v.defaultMuted = true;
    var srcAttr = window.innerWidth <= 640 ? 'data-src-small' : 'data-src';
    function load() {
      if (v.src) return;
      v.src = v.getAttribute(srcAttr) || v.getAttribute('data-src');
      v.addEventListener('canplay', function () { v.classList.add('is-ready'); }, { once: true });
      var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
    }
    if (hasIO) {
      var vio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { load(); var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); } else if (v.src) v.pause(); });
      }, { rootMargin: '200px 0px' });
      vio.observe(v);
    } else load();
  });

  // Frist: Tage bis 31.12.2026 zählen sichtbar herunter
  var daysEl = $('#deadlineDays');
  if (daysEl) {
    var end = new Date(2026, 11, 31, 23, 59, 59);
    var days = Math.ceil((end - new Date()) / 86400000);
    var b = $('[data-days]', daysEl);
    if (days <= 0) { daysEl.textContent = 'Programm beendet'; }
    else if (reduce) { b.textContent = String(days); }
    else {
      var from = days + 90, t0 = null;
      var frame = function (ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min(1, (ts - t0 - 500) / 1400);
        if (p < 0) { requestAnimationFrame(frame); return; }
        var eased = 1 - Math.pow(1 - p, 3);
        b.textContent = String(Math.round(from - (from - days) * eased));
        if (p < 1) requestAnimationFrame(frame);
      };
      b.textContent = String(from);
      requestAnimationFrame(frame);
    }
    if (days === 1) daysEl.lastChild.textContent = ' Tag';
  }

  // Nav-Pille: nach dem ersten Scroll dunkler + Schatten
  var nav = $('#nav');
  function updateNav() { if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 24); }

  // Wörter aufteilen: jedes Wort ein <span class="w"> mit eigenem Versatz (60 ms)
  var WORD_STAGGER = 60, BASE_DELAY = 300;
  $$('[data-anim="words"]').forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (w, i) {
      var s = document.createElement('span');
      s.className = 'w'; s.textContent = w;
      s.style.setProperty('--d', (BASE_DELAY + i * WORD_STAGGER) + 'ms');
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  });
  // Blöcke: Grundverzögerung 300 ms, optional data-delay
  $$('[data-anim="up"], [data-anim="card"]').forEach(function (el) {
    var d = parseInt(el.getAttribute('data-delay') || '0', 10);
    el.style.setProperty('--d', (BASE_DELAY + d) + 'ms');
  });
  // Kartengruppen: 90 ms Versatz je Karte
  $$('[data-anim-group="card"]').forEach(function (g) {
    Array.prototype.forEach.call(g.children, function (c, i) { c.style.setProperty('--d', (BASE_DELAY + i * 90) + 'ms'); });
  });

  var animTargets = $$('[data-anim], [data-anim-group], .bento-gauge');
  if (hasIO && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    animTargets.forEach(function (el) { io.observe(el); });
  } else {
    animTargets.forEach(function (el) { el.classList.add('in'); });
  }

  // Countup
  function countUp(el) {
    var target = parseInt(el.getAttribute('data-target'), 10);
    var suffix = el.getAttribute('data-suffix') || '';
    var dur = 1100, start = null;
    function frame(ts) {
      if (!start) start = ts;
      var p = Math.min(1, (ts - start) / dur), eased = 1 - Math.pow(1 - p, 3);
      el.innerHTML = Math.round(target * eased).toLocaleString('de-DE') + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  if (hasIO && !reduce) {
    var ioC = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { setTimeout(function () { countUp(e.target); }, 500); ioC.unobserve(e.target); } });
    }, { threshold: 0.4 });
    $$('.countup').forEach(function (el) { ioC.observe(el); });
  }

  // Parallax (sanft, nur Transform) + Ablauf-Linie
  var parallaxEls = $$('[data-parallax]');
  var stepsEl = $('#steps'), stepsFill = $('#stepsFill');
  var ticking = false;
  function onScrollFrame() {
    ticking = false;
    var vh = window.innerHeight;
    if (!reduce) {
      parallaxEls.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        var amount = parseFloat(el.getAttribute('data-parallax')) || 0;
        var progress = (r.top + r.height / 2 - vh / 2) / vh;   // -0.5 … 0.5
        el.style.transform = 'translate3d(0,' + (progress * amount).toFixed(1) + 'px,0)';
      });
    }
    if (stepsEl && stepsFill) {
      var sr = stepsEl.getBoundingClientRect();
      var p = (vh * 0.6 - sr.top) / sr.height;
      stepsFill.style.height = (Math.max(0, Math.min(1, p)) * 100) + '%';
    }
    updateNav();
    updateSticky();
  }
  function requestFrame() { if (!ticking) { ticking = true; requestAnimationFrame(onScrollFrame); } }
  window.addEventListener('scroll', requestFrame, { passive: true });
  window.addEventListener('resize', requestFrame);

  // FAQ
  $$('.faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      if (panel) panel.hidden = open;
    });
  });

  // Sticky-CTA ab dem ersten Scroll
  var sticky = $('#stickyCta');
  function updateSticky() {
    if (!sticky) return;
    var show = window.scrollY > 120 && !document.body.classList.contains('funnel-open');
    sticky.classList.toggle('is-visible', show);
    sticky.setAttribute('aria-hidden', show ? 'false' : 'true');
  }
  onScrollFrame();

  /* ═══ Landingpage: Links zum Fördercheck (eigene Seite anfragen.html) ═══ */
  var funnel = $('#funnel');
  if (!funnel) {
    // UTM-Parameter, fbclid usw. auf die Formularseite mitnehmen
    var qs = window.location.search;
    if (qs && qs.length > 1) {
      $$('a.js-open-funnel').forEach(function (a) {
        var href = a.getAttribute('href') || 'anfragen.html';
        if (href.indexOf('?') === -1) a.setAttribute('href', href + qs);
      });
    }
    // Alte Verlinkung ?check=1 / #check auf die Formularseite umleiten
    if (/[?&]check=1/.test(qs) || window.location.hash === '#check') window.location.replace('anfragen.html' + qs);
    return;
  }

  /* ═══ Fördercheck (eigene Seite) ═══ */
  var standalone = funnel.hasAttribute('data-standalone');

  var steps = $$('.fstep', funnel);
  var stepById = {};
  steps.forEach(function (s) { stepById[s.getAttribute('data-step')] = s; });
  var ORDER = ['1', '1b', '2', '3', '4', '5', '6'];
  var COUNTED = ['1', '2', '3', '4', '5', '6'];

  var answers = {};
  var history = [];
  var current = null;
  var lastFocus = null;
  var result = null;
  var timers = [];
  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  var counter = $('#funnelCounter');
  var bar = $('#progressBar');
  var backBtn = $('#funnelBack');
  var body = $('.funnel-body', funnel);

  function showStep(id, opts) {
    opts = opts || {};
    if (current && current !== id && !opts.noHistory) history.push(current);
    if (current && stepById[current]) stepById[current].classList.remove('in');
    current = id;
    steps.forEach(function (s) { s.classList.toggle('is-active', s.getAttribute('data-step') === id); });
    if (body) body.scrollTop = 0;

    // Kacheln mit Versatz einblenden
    var el = stepById[id];
    $$('.tile', el).forEach(function (t, i) { t.style.setProperty('--d', (120 + i * 40) + 'ms'); });
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('in'); }); });

    var idx = COUNTED.indexOf(id === '1b' ? '1' : id);
    var isQuestion = idx > -1;
    if (isQuestion) {
      counter.textContent = 'Frage ' + (idx + 1) + ' von ' + COUNTED.length;
      bar.style.width = ((idx) / COUNTED.length * 100) + '%';
      if (id !== '1b') track('funnel_step', { step: idx + 1 });
    } else if (id === 'calc') {
      counter.textContent = 'Berechnung';
      bar.style.width = '92%';
    } else {
      counter.textContent = 'Ergebnis';
      bar.style.width = '100%';
    }
    backBtn.hidden = !(isQuestion && history.length > 0);

    var focusTarget = $('.tile, .fstep-q, .result-headline', el);
    if (focusTarget) { if (!focusTarget.hasAttribute('tabindex') && !/BUTTON|INPUT/.test(focusTarget.tagName)) focusTarget.setAttribute('tabindex', '-1'); focusTarget.focus({ preventScroll: true }); }
  }

  function openFunnel() {
    lastFocus = document.activeElement;
    funnel.hidden = false;
    document.body.classList.add('funnel-open');
    if (heroVideo) heroVideo.pause();
    updateSticky();
    if (!current) showStep('1', { noHistory: true });
  }
  function closeFunnel() {
    if (standalone) { window.location.href = './'; return; }
    funnel.hidden = true;
    document.body.classList.remove('funnel-open');
    heroPlay();
    updateSticky();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $$('.js-open-funnel').forEach(function (b) { b.addEventListener('click', openFunnel); });
  var closeEl = $('#funnelClose');
  if (closeEl && closeEl.tagName !== 'A') closeEl.addEventListener('click', closeFunnel);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !funnel.hidden && !standalone) closeFunnel(); });

  backBtn.addEventListener('click', function () {
    var prev = history.pop();
    if (!prev) return;
    var key = stepById[current] && stepById[current].getAttribute('data-key');
    if (key) delete answers[key];
    $$('.tile', stepById[current]).forEach(function (t) { t.classList.remove('is-selected'); });
    showStep(prev, { noHistory: true });
  });

  // Kacheln: Buchstaben-Badge, Klick schaltet sofort weiter (nur innerhalb des jeweiligen Schritts suchen)
  var LETTERS = 'ABCDEFGHIJKLMNOP';
  steps.forEach(function (stepEl) {
    var key = stepEl.getAttribute('data-key');
    if (!key) return;
    $$('.tile', stepEl).forEach(function (tile, i) {
      var letter = LETTERS.charAt(i);
      if (letter) {
        tile.setAttribute('data-letter', letter);
        var badge = document.createElement('span'); badge.className = 'tile-key'; badge.setAttribute('aria-hidden', 'true'); badge.textContent = letter;
        tile.insertBefore(badge, tile.firstChild);
      }
      tile.addEventListener('click', function () {
        $$('.tile', stepEl).forEach(function (t) { t.classList.remove('is-selected'); });
        tile.classList.add('is-selected');
        answers[key] = tile.getAttribute('data-value');
        later(function () { advance(stepEl.getAttribute('data-step')); }, 180);
      });
    });
  });

  // Tastatur: Buchstabe wählt die Kachel
  document.addEventListener('keydown', function (e) {
    if (funnel.hidden || !current || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
    var stepEl = stepById[current]; if (!stepEl || !stepEl.getAttribute('data-key')) return;
    var letter = (e.key || '').toUpperCase(); if (letter.length !== 1 || LETTERS.indexOf(letter) < 0) return;
    var tile = $('.tile[data-letter="' + letter + '"]', stepEl);
    if (tile) { e.preventDefault(); tile.click(); }
  });

  function advance(fromId) {
    if (fromId === '1') {
      var rf = RUECKFRAGEN[answers.bundesland];
      if (rf) { $('#regionQ').textContent = rf.frage; showStep('1b'); return; }
      delete answers.region;
      showStep('2'); return;
    }
    if (fromId === '1b') { showStep('2'); return; }

    // Ausschlüsse sofort, ohne Formular
    if (fromId === '2' && answers.mitarbeiter === '250 oder mehr') {
      excluded('Das Programm richtet sich an kleine und mittlere Unternehmen mit unter 250 Mitarbeitern.'); return;
    }
    if (fromId === '3' && answers.umsatz === 'über 50 Mio. €') {
      excluded('Das Programm richtet sich an kleine und mittlere Unternehmen mit höchstens 50 Mio. € Jahresumsatz.'); return;
    }
    if (fromId === '4' && BRANCHE_AUSSCHLUSS[answers.branche]) {
      excluded(BRANCHE_AUSSCHLUSS[answers.branche], !!BRANCHE_HINWEIS[answers.branche]); return;
    }

    var next = ORDER[ORDER.indexOf(fromId) + 1];
    if (next) { showStep(next); return; }
    runCalc();
  }

  function excluded(reason, note) {
    $('#excludedReason').textContent = reason;
    var noteEl = $('#excludedNote'); if (noteEl) noteEl.hidden = !note;
    track('check_completed', { quote: 0, foerderfaehig: false });
    showStep('excluded');
  }

  /* ─── Rechenlogik ─── */
  function compute(a) {
    var quote, standortText;
    var land = a.bundesland;
    var rf = RUECKFRAGEN[land];
    if (rf) {
      var ja = a.region === 'ja';
      var ist80 = rf.jaIst80 ? ja : !ja;
      quote = ist80 ? QUOTE_OST : QUOTE_WEST;
      var regionName = rf.frage.replace('Liegt der Sitz ', '').replace('?', '').replace(/^in der |^im /, '');
      standortText = land + ' · ' + (ja ? regionName : 'außerhalb ' + regionName);
    } else if (LAENDER_80.indexOf(land) > -1) {
      quote = QUOTE_OST; standortText = land + ' · erhöhter Fördersatz';
    } else {
      quote = QUOTE_WEST; standortText = land + ' · Regelsatz';
    }
    var kmu = a.mitarbeiter !== '250 oder mehr' && a.umsatz !== 'über 50 Mio. €';
    var zuschuss = Math.round(MAX_KOSTEN_NETTO * quote);
    return {
      quote: quote,
      quotePct: Math.round(quote * 100),
      standortText: standortText,
      kmu: kmu,
      zuschussJeBeratung: zuschuss,
      eigenanteilJeBeratung: MAX_KOSTEN_NETTO - zuschuss,
      moeglichJahr: zuschuss * 2,
      handel2030: a.bundesland === HANDEL2030_LAND && a.branche === HANDEL2030_BRANCHE
    };
  }

  // Zahl hochzählen (für Zwischenergebnisse)
  function tween(el, to, fmt, dur) {
    var start = null;
    function frame(ts) {
      if (!start) start = ts;
      var p = Math.min(1, (ts - start) / dur), eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(to * eased));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ─── Rechenschritt: sechs Zeilen, Fortschritt, Rechenweg (ca. 4 s) ─── */
  function runCalc() {
    result = compute(answers);
    showStep('calc');
    var calcEl = stepById.calc;
    var lines = $$('.calc-line', calcEl);
    lines.forEach(function (l) { l.classList.remove('is-running', 'is-done'); $('.calc-result', l).textContent = ''; });
    var pct = $('#calcPct'), barEl = $('#calcBar'), formula = $('#calcFormula');
    formula.classList.remove('in'); pct.innerHTML = '0&nbsp;%'; barEl.style.width = '0%';

    var kontingentText = answers.vorfoerderung === 'Noch nie' ? 'Noch nicht genutzt · bis zu 2 Beratungen dieses Jahr'
      : answers.vorfoerderung === 'Drei- oder öfter' ? 'Teilweise genutzt · höchstens 5 bis 31.12.2026'
      : answers.vorfoerderung + ' genutzt · weitere Beratungen möglich';
    // Die Zahlen bleiben hier verdeckt, sie werden erst nach dem Formular freigeschaltet.
    var plan = [
      { line: 'standort',   text: answers.bundesland + ' · geprüft' },
      { line: 'quote',      masked: '•• %' },
      { line: 'kmu',        text: 'KMU bestätigt · ' + answers.mitarbeiter + ' Mitarbeiter' },
      { line: 'branche',    text: answers.branche + ' · förderfähig' },
      { line: 'kontingent', text: kontingentText }
    ];
    var lpLine = $('.calc-line[data-line="landesprogramm"]', calcEl);
    if (lpLine) lpLine.hidden = !result.handel2030;
    if (result.handel2030) plan.push({ line: 'landesprogramm', text: 'Zukunft Handel 2030 · zusätzliches Programm gefunden' });
    plan.push({ line: 'zuschuss', masked: '•.••• €' });
    var perLine = reduce ? 180 : 560, t = 250;
    plan.forEach(function (p, i) {
      var li = $('.calc-line[data-line="' + p.line + '"]', calcEl);
      var out = $('.calc-result', li);
      later(function () {
        li.classList.add('is-running');
        var target = Math.round(((i + 0.5) / plan.length) * 100);
        barEl.style.width = target + '%';
        tween(pct, target, function (n) { return n + ' %'; }, 400);
      }, t);
      t += perLine;
      later(function () {
        li.classList.remove('is-running'); li.classList.add('is-done');
        if (p.masked) { var b = document.createElement('b'); b.className = 'calc-masked'; b.textContent = p.masked; out.appendChild(b); out.appendChild(document.createTextNode(' ermittelt')); }
        else out.textContent = p.text;
        var target = Math.round(((i + 1) / plan.length) * 100);
        barEl.style.width = target + '%';
        tween(pct, target, function (n) { return n + ' %'; }, 400);
      }, t);
    });
    // Rechenweg als Formel, Ergebnis bleibt verdeckt bis zum Freischalten
    later(function () {
      $('#calcFormulaText').textContent = 'Fördersatz × Beratungskosten =';
      $('#calcFormulaSum').textContent = '•.••• €';
      formula.classList.add('in');
    }, t + 100);
    later(showResult, t + 1500);
  }

  /* ─── Ergebnis (unscharf) ─── */
  function fillHidden() {
    var map = {
      bundesland: answers.bundesland || '', region: answers.region || '', mitarbeiter: answers.mitarbeiter || '',
      umsatz: answers.umsatz || '', branche: answers.branche || '', vorfoerderung: answers.vorfoerderung || '',
      anliegen: answers.anliegen || '', quote: result ? result.quotePct + ' %' : '', zuschuss: result ? result.zuschussJeBeratung : '',
      handel2030: result && result.handel2030 ? 'ja' : 'nein'
    };
    for (var k in map) { var el = document.getElementById('h-' + k); if (el) el.value = map[k]; }
    var sub = $('#h-submitted_at'); if (sub) sub.value = new Date().toISOString();
  }

  function setOut(name, val) { $$('[data-out="' + name + '"]', stepById.result).forEach(function (e) { e.textContent = val; }); }

  function showResult() {
    // Die Zahlen stehen VOR dem Freischalten im DOM und ändern sich danach nicht.
    setOut('quote', result.quotePct + ' %');
    setOut('quote2', result.quotePct + ' %');
    setOut('zuschuss', euro(result.zuschussJeBeratung));
    setOut('zuschuss2', 'bis zu ' + euro(result.zuschussJeBeratung));
    setOut('jahr', euro(result.moeglichJahr));
    setOut('jahr2', 'bis zu ' + euro(result.moeglichJahr));
    var bonus = $('#resultBonus'); if (bonus) bonus.hidden = !result.handel2030;
    $('#resultKontingent').hidden = answers.vorfoerderung !== 'Drei- oder öfter';
    fillHidden();
    track('check_completed', { quote: result.quotePct, foerderfaehig: true });
    showStep('result');
  }

  /* ─── Formular ─── */
  var form = $('#leadForm');
  var submitBtn = $('#leadSubmit');
  var sendWarn = $('#sendWarn');
  var isLocal = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) || window.location.protocol === 'file:';

  // UTM, fbclid, gclid, Herkunft in die versteckten Felder
  (function () {
    var q = new URLSearchParams(window.location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'].forEach(function (k) {
      var el = document.getElementById('h-' + k); if (el && q.get(k)) el.value = q.get(k);
    });
    var lp = $('#h-landing_page'); if (lp) lp.value = window.location.href;
    var ref = $('#h-referrer'); if (ref) ref.value = document.referrer || '';
  })();

  function fieldOf(input) { return input.closest('.field'); }
  function validate() {
    var ok = true;
    $$('.field', form).forEach(function (f) {
      var input = $('input', f);
      var valid;
      if (input.type === 'checkbox') valid = input.checked;
      else if (input.type === 'email') valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim());
      else if (input.name === 'name') valid = input.value.trim().split(/\s+/).length >= 2;
      else if (input.name === 'telefon') valid = input.value.replace(/\D/g, '').length >= 6;
      else valid = input.value.trim().length > 1;
      f.classList.toggle('has-error', !valid);
      if (!valid && ok) { ok = false; input.focus(); }
    });
    return ok;
  }
  // Fehlermarkierung live zurücknehmen
  $$('input', form).forEach(function (input) {
    ['input', 'change'].forEach(function (ev) {
      input.addEventListener(ev, function () { var f = fieldOf(input); if (f && f.classList.contains('has-error')) f.classList.remove('has-error'); });
    });
  });

  // Netlify Forms: POST als x-www-form-urlencoded. Erst an "/", dann an die eigene Adresse.
  function postForm(bodyStr) {
    if (isLocal) return Promise.resolve({ ok: true, local: true });
    var opts = { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: bodyStr };
    return fetch('/', opts).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r; })
      .catch(function () { return fetch(window.location.pathname, opts).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r; }); });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;
    fillHidden();
    submitBtn.disabled = true;
    var encoded = new URLSearchParams(new FormData(form)).toString();
    var done = false;
    var finish = function (failed) {
      if (done) return; done = true;
      submitBtn.disabled = false;
      sendWarn.hidden = !failed;
      unlock();
    };
    postForm(encoded).then(function () { finish(false); }).catch(function (err) {
      if (window.console) console.warn('Lead konnte nicht übertragen werden', err);
      finish(true);   // Ergebnis trotzdem zeigen: Termin und Rückruf fangen den Kontakt auf
    });
    later(function () { finish(false); }, 6000);   // Netz hängt: nicht warten lassen
  });

  function firstName() {
    var n = ($('#f-name').value || '').trim().split(/\s+/)[0] || '';
    return n.charAt(0).toUpperCase() + n.slice(1);
  }

  function unlock() {
    track('lead_submitted', { quote: result.quotePct });
    $('#resultLock').classList.add('is-hidden');
    $('#resultBlur').classList.remove('is-blurred');
    $('#resultLayout').classList.add('is-unlocked');

    // Fallstudie
    var c = CASES[CASE_BY_ANLIEGEN[answers.anliegen] || 'barwig'];
    $('#afterCaseBranche').textContent = c.branche;
    $('#afterCaseTitle').textContent = c.title;
    var ul = $('#afterCaseStats'); ul.innerHTML = '';
    c.stats.forEach(function (s) {
      var li = document.createElement('li'); var b = document.createElement('strong');
      b.textContent = s[0]; li.appendChild(b); li.appendChild(document.createTextNode(' ' + s[1])); ul.appendChild(li);
    });

    var fn = firstName();
    $('#nextTitle').textContent = (fn ? fn + ', wählen' : 'Wählen') + ' Sie jetzt einen Telefontermin, oder wir melden uns in den nächsten Tagen bei Ihnen.';
    $('#bookAlertText').textContent = 'Wählen Sie jetzt Ihren Termin, dann ist Ihr Platz fest eingetragen.';
    $('#callbackPhone').textContent = $('#f-tel').value.trim();
    $('#after').hidden = false;
    later(function () { var a = $('#after'); if (a && a.scrollIntoView) a.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }, 650);
    mountCalendar();
  }

  /* ─── Nächste Schritte: Termin oder Rückruf ─── */
  $$('.next-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      var which = tab.getAttribute('data-tab');
      $$('.next-tab').forEach(function (t) { var on = t === tab; t.classList.toggle('is-active', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); });
      $('#panelCal').hidden = which !== 'cal';
      $('#panelCall').hidden = which !== 'call';
      track('next_step_tab', { tab: which });
    });
  });

  var callbackSent = false;
  $('#callbackBtn').addEventListener('click', function () {
    if (callbackSent) return;
    callbackSent = true;
    var btn = $('#callbackBtn'); btn.disabled = true;
    var data = new URLSearchParams({
      'form-name': 'foerdercheck-rueckruf', name: $('#f-name').value.trim(), firma: $('#f-firma').value.trim(),
      email: $('#f-email').value.trim(), telefon: $('#f-tel').value.trim(), quote: result ? result.quotePct + ' %' : '',
      bundesland: answers.bundesland || '', kontaktwunsch: 'Rückruf in den nächsten Tagen', submitted_at: new Date().toISOString()
    }).toString();
    var show = function () {
      $('#callback').hidden = true;
      $('#callbackDoneText').textContent = 'Wir rufen Sie in den nächsten Tagen unter ' + $('#f-tel').value.trim() + ' an. Wenn es schneller gehen soll: ' + CONFIG.phoneDisplay + '.';
      $('#callbackDone').hidden = false;
      track('callback_requested', {});
    };
    postForm(data).then(show).catch(function (err) { if (window.console) console.warn('Rückrufwunsch konnte nicht übertragen werden', err); show(); });
  });

  /* ─── Kalender (Cal.com, außerhalb des <form>) ─── */
  var calMounted = false, booked = false;
  function mountCalendar() {
    if (calMounted) return;
    calMounted = true;
    var name = $('#f-name').value.trim();
    var email = $('#f-email').value.trim();
    var phone = $('#f-tel').value.trim();
    var fallback = $('#calFallback');
    var showFallback = function () { fallback.hidden = false; $('#calWrap').classList.add('is-fallback'); };
    var link = $('#calFallbackLink');
    link.href = 'https://cal.com/' + CONFIG.calLink + '?name=' + encodeURIComponent(name) + '&email=' + encodeURIComponent(email);

    if (typeof window.Cal !== 'function') { showFallback(); return; }

    try {
      var cfg = { layout: 'month_view', useSlotsViewOnSmallScreen: 'true', name: name, email: email };
      if (CONFIG.calPhoneField) cfg[CONFIG.calPhoneField] = phone;   // verfällt stillschweigend, wenn das Feld im Event fehlt
      window.Cal('init', CONFIG.calNamespace, { origin: CONFIG.calOrigin });
      var ns = window.Cal.ns[CONFIG.calNamespace];
      ns('inline', { elementOrSelector: '#calInline', calLink: CONFIG.calLink, config: cfg });
      ns('ui', { hideEventTypeDetails: false, layout: 'month_view' });
      ns('on', { action: 'bookingSuccessful', callback: onBooked });
      ns('on', { action: 'bookingSuccessfulV2', callback: onBooked });
    } catch (err) {
      if (window.console) console.warn('Kalender konnte nicht geladen werden', err);
      showFallback();
      return;
    }
    later(function () { if (!$('#calInline iframe')) showFallback(); }, 8000);
  }

  // Zusätzlich: message-Ereignis mit Origin-Prüfung
  window.addEventListener('message', function (e) {
    if (e.origin !== CONFIG.calOrigin) return;
    var d = e.data;
    if (!d || d.originator !== 'CAL') return;
    if (d.type === 'bookingSuccessful' || d.type === 'bookingSuccessfulV2') onBooked();
  });

  function onBooked() {
    if (booked) return;
    booked = true;
    track('call_booked', {});
    $('#book').classList.add('is-booked');
    $('#booked').hidden = false;
    var b = $('#booked'); if (b.scrollIntoView) b.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    if (CONFIG.dankeUrl) later(function () { window.location.href = CONFIG.dankeUrl; }, CONFIG.dankeDelayMs);
  }

  /* Deep-Link: ?check=1 öffnet den Fragebogen sofort */
  if (standalone) openFunnel();
  else if (/[?&]check=1/.test(window.location.search) || window.location.hash === '#check') openFunnel();
})();
