/* ════════ IMPACT-SCRIPT (defensive + IIFE) ════════ */
(function() {
  "use strict";

  function initImpact() {
    var lerp = function(a, b, t) { return a + (b - a) * t; };
    var clamp = function(v, mi, ma) { return Math.max(mi, Math.min(ma, v)); };
    var easeOut2 = function(t) { return 1 - Math.pow(1 - t, 3); };
    var easeInOut2 = function(t) { return t < .5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2; };

    var impactSection = document.getElementById('impact');
    if (!impactSection) {
      console.warn('[Impact] Section nicht gefunden');
      return;
    }

    var impactIntro = document.querySelector('[data-intro]');
    var impactHint = document.querySelector('[data-hint]');
    var impactLogo = document.querySelector('[data-logo]');
    var impactSideIG = document.querySelector('.stage-logo-ig');
    var impactSideAI = document.querySelector('.stage-logo-ai');
    var impactWave = document.querySelector('[data-wave]');
    var impactShine = document.querySelector('[data-shine]');
    var impactText = document.querySelector('[data-text]');

    // Pairs Observer
    var impactPairs = document.querySelectorAll('[data-pair]');
    if (impactPairs.length && 'IntersectionObserver' in window) {
      var impactObs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) entry.target.classList.add('show');
        });
      }, { threshold: 0.25 });
      impactPairs.forEach(function(p) { impactObs.observe(p); });
    }

    function impactProgress() {
      var rect = impactSection.getBoundingClientRect();
      var vh = window.innerHeight;
      var total = rect.height - vh;
      if (total <= 0) return 0;
      var scrolled = Math.max(0, -rect.top);
      return clamp(scrolled / total, 0, 1);
    }

    // Mobile-Setup: impact-text element NACH impact-pairs verschieben (für Sticky-Stack-Crescendo)
    function setupImpactMobile() {
      if (window.innerWidth >= 901) return;
      if (!impactText || !impactSection) return;
      var pairsContainer = impactSection.querySelector('.impact-pairs');
      if (!pairsContainer) return;
      // Nur verschieben, wenn noch nicht erledigt
      if (impactText.parentElement === impactSection) return;
      impactSection.appendChild(impactText);
    }
    setupImpactMobile();
    window.addEventListener('resize', function() {
      // Reset wenn von mobile zu desktop oder umgekehrt
      if (window.innerWidth >= 901 && impactText && impactText.parentElement === impactSection) {
        var stage = impactSection.querySelector('.impact-stage');
        if (stage) stage.appendChild(impactText);
      } else {
        setupImpactMobile();
      }
    });

    // Logo-Verschiebung des letzten Frames (für geometrische Selbstkorrektur)
    var lastLogoShift = 0;

    function impactUpdate() {
      // Mobile: keine Desktop-Choreografie — CSS sticky-stack regelt
      if (window.innerWidth < 901) {
        if (impactLogo)  impactLogo.style.transform = '';
        if (impactSideIG) impactSideIG.style.transform = '';
        if (impactSideAI) impactSideAI.style.transform = '';
        if (impactWave)  impactWave.style.transform = '';
        if (impactShine) impactShine.style.transform = '';
        if (impactText)  impactText.style.opacity = '';
        if (impactIntro) { impactIntro.style.opacity = ''; impactIntro.style.transform = ''; }
        if (impactHint)  { impactHint.style.opacity = ''; impactHint.style.transform = ''; }
        var mobileCenter = window.innerHeight * 0.54;
        var mobileRange = window.innerHeight * 0.34;
        impactPairs.forEach(function(pair) {
          var mobileLeft = pair.querySelector('.pair-card-left');
          var mobileRight = pair.querySelector('.pair-card-right');
          if (mobileLeft) mobileLeft.classList.remove('is-passed');
          if (mobileRight) {
            var mobileRect = mobileRight.getBoundingClientRect();
            var mobileCardCenter = mobileRect.top + mobileRect.height / 2;
            mobileRight.classList.toggle('is-active', Math.abs(mobileCardCenter - mobileCenter) < mobileRange);
          }
        });
        return;
      }
      var p = impactProgress();

      // Hint fadet schnell aus
      var hintP = easeOut2(clamp(p / 0.05, 0, 1));
      if (impactHint) {
        impactHint.style.opacity = 1 - hintP;
        impactHint.style.transform = 'translateY(' + (hintP * 20) + 'px)';
      }
      // Headline fadet aus
      var introP = easeOut2(clamp(p / 0.12, 0, 1));
      if (impactIntro) {
        impactIntro.style.opacity = 1 - introP;
        impactIntro.style.transform = 'translateY(' + (-introP * 30) + 'px)';
      }
      // Logo wandert nach Mitte, gleitet am Ende nach unten bis knapp über den Crescendo-Text
      if (impactLogo) {
        var logoP = easeOut2(clamp((p - 0.05) / 0.15, 0, 1));
        var logoY = lerp(60, 0, logoP);
        var wavePhaseP = easeInOut2(clamp((p - 0.72) / 0.18, 0, 1));
        var finalShift = 0;
        if (impactText) {
          var lrLogo = impactLogo.getBoundingClientRect();
          var baseBottom = lrLogo.bottom - lastLogoShift;
          var tpNow = easeOut2(clamp((p - 0.82) / 0.16, 0, 1));
          var trText = impactText.getBoundingClientRect();
          var textFinalTop = trText.top - (1 - tpNow) * 30;
          var travel = (textFinalTop - 44) - baseBottom;
          finalShift = lerp(0, travel, wavePhaseP);
        }
        var yNow = logoY + finalShift;
        impactLogo.style.transform = 'translateY(' + yNow + 'px)';
        lastLogoShift = yNow;
      }
      // Side-Logos (Instagram + ChatGPT) gleiten zur Mitte und treffen sich
      if (impactSideIG && impactSideAI) {
        var sideP = easeOut2(clamp((p - 0.08) / 0.50, 0, 1));
        // 32px Richtung Mitte pro Seite — bei p=1 überlappen sie sich hinter dem YT-Logo
        var sideShift = sideP * 32;
        // Rotation: ±16° → 0° beim Auftreffen
        var sideRot = lerp(16, 0, sideP);
        // CSS-Basis: top:0; translateY(-70%) rotate(±16deg)
        impactSideIG.style.transform =
          'translate(' + sideShift + 'px, -70%) rotate(' + (-sideRot) + 'deg)';
        impactSideAI.style.transform =
          'translate(' + (-sideShift) + 'px, -70%) rotate(' + sideRot + 'deg)';
      }
      // Wave kommt von unten
      var waveP = easeInOut2(clamp((p - 0.55) / 0.3, 0, 1));
      var waveTransY = (1 - waveP) * 100;
      if (impactWave) impactWave.style.transform = 'translateY(' + waveTransY + '%)';
      if (impactShine) impactShine.style.transform = 'translateY(' + waveTransY + '%)';
      if (impactLogo) {
        if (waveP > 0.55) impactLogo.classList.add('on-red');
        else impactLogo.classList.remove('on-red');
      }
      // Crescendo Text
      if (impactText) {
        var textP = easeOut2(clamp((p - 0.82) / 0.16, 0, 1));
        impactText.style.opacity = textP;
        impactText.style.transform = 'translateX(-50%) translateY(' + ((1 - textP) * 30) + 'px)';
      }

      // Right-Card "is-active" wenn YT-Logo (Viewport-Mitte) an der Karte vorbeizieht.
      // Left-Card "is-passed" sobald das Logo darüber hinaus ist — sie zerfällt.
      var viewportCenter = window.innerHeight / 2;
      var activeThreshold = window.innerHeight * 0.18; // ±18 % vh um die Mitte
      impactPairs.forEach(function(pair) {
        var rightCard = pair.querySelector('.pair-card-right');
        var leftCard  = pair.querySelector('.pair-card-left');

        if (rightCard) {
          var rRect = rightCard.getBoundingClientRect();
          var rCenter = rRect.top + rRect.height / 2;
          if (Math.abs(rCenter - viewportCenter) < activeThreshold) {
            rightCard.classList.add('is-active');
          } else {
            rightCard.classList.remove('is-active');
          }
        }

        if (leftCard) {
          var lRect = leftCard.getBoundingClientRect();
          var lCenter = lRect.top + lRect.height / 2;
          // is-passed: Logo ist VORBEI = Karte liegt über der active-Zone
          if (lCenter < viewportCenter - activeThreshold * 0.4) {
            leftCard.classList.add('is-passed');
          } else {
            leftCard.classList.remove('is-passed');
          }
        }
      });
    }

    var impactRaf = null;
    window.addEventListener('scroll', function() {
      if (impactRaf) return;
      impactRaf = requestAnimationFrame(function() {
        impactUpdate();
        impactRaf = null;
      });
    }, { passive: true });
    window.addEventListener('resize', impactUpdate);
    impactUpdate();
  }

  // Init nach DOM-Ready oder sofort
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initImpact);
  } else {
    initImpact();
  }
})();

/* Impact mobil: Hintergrund wird beim Scrollen rot (aus der Live-Seite) */
(function () {
    var red = document.getElementById('impRedM');
    var sec = document.getElementById('impact');
    if (!red || !sec) return;
    var tick = false;
    function updRed() {
        tick = false;
        if (window.innerWidth > 900) { red.style.opacity = '0'; return; }
        var r = sec.getBoundingClientRect();
        var total = r.height - window.innerHeight;
        if (total <= 0) { red.style.opacity = '0'; return; }
        var p = Math.max(0, Math.min(1, -r.top / total));
        var e = Math.max(0, Math.min(1, (p - 0.46) / 0.38));
        red.style.opacity = String((e * e * (3 - 2 * e)) * 0.96);
    }
    window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(updRed); } }, { passive: true });
    updRed();
})();
