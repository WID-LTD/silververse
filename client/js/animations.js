/* ═══════════════════════════════════════
   SilverVerse — Landing Page Animations
   ═══════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function () {

  /* ── Scroll Reveal ── */
  var revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
  if (revealElements.length) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealElements.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ── Animated Counters ── */
  var counters = document.querySelectorAll('[data-count-to]');
  if (counters.length) {
    var counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { counterObserver.observe(el); });
  }

  function animateCounter(el) {
    var target = parseInt(el.getAttribute('data-count-to'), 10);
    var suffix = el.getAttribute('data-count-suffix') || '';
    var prefix = el.getAttribute('data-count-prefix') || '';
    var duration = 2000;
    var start = performance.now();
    function step(now) {
      var elapsed = now - start;
      var progress = Math.min(elapsed / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 4);
      var current = Math.round(eased * target);
      el.textContent = prefix + current.toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ── Countdown Timer ── */
  var TARGET_DATE = new Date('2026-08-01T09:00:00+01:00').getTime();

  function renderCountdown(el) {
    var diff = TARGET_DATE - Date.now();
    if (diff <= 0) {
      el.innerHTML = '<span class="countdown-expired">Event is Live!</span>';
      return;
    }
    var days = Math.floor(diff / 864e5);
    var hours = Math.floor((diff % 864e5) / 36e5);
    var minutes = Math.floor((diff % 36e5) / 6e4);
    var seconds = Math.floor((diff % 6e4) / 1e3);
    var units = [
      { val: days, label: 'Days' },
      { val: hours, label: 'Hours' },
      { val: minutes, label: 'Minutes' },
      { val: seconds, label: 'Seconds' }
    ];
    el.innerHTML = units.map(function (u) {
      return '<div class="countdown-unit">' +
        '<span class="countdown-value">' + String(u.val).padStart(2, '0') + '</span>' +
        '<span class="countdown-label">' + u.label + '</span>' +
        '</div>';
    }).join('');
  }

  var countdownEls = document.querySelectorAll('#countdown, #countdownCta');
  if (countdownEls.length) {
    function updateAll() {
      countdownEls.forEach(function (el) { renderCountdown(el); });
    }
    updateAll();
    setInterval(updateAll, 1000);
  }

  /* ── FAQ Accordion ── */
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var question = item.querySelector('.faq-question');
    if (!question) return;
    question.addEventListener('click', function () {
      var wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function (openItem) {
        openItem.classList.remove('open');
        var answer = openItem.querySelector('.faq-answer');
        if (answer) answer.style.maxHeight = '0';
      });
      if (!wasOpen) {
        item.classList.add('open');
        var answer = item.querySelector('.faq-answer');
        if (answer) answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  /* ── Partner Logo Infinite Scroll (pause on hover) ── */
  var partnersTrack = document.querySelector('.partners-track');
  if (partnersTrack) {
    partnersTrack.addEventListener('mouseenter', function () {
      partnersTrack.style.animationPlayState = 'paused';
    });
    partnersTrack.addEventListener('mouseleave', function () {
      partnersTrack.style.animationPlayState = 'running';
    });
  }

  /* ── Live Clock (check-in page) ── */
  var liveClock = document.getElementById('liveClock');
  if (liveClock) {
    function updateClock() {
      var now = new Date();
      liveClock.textContent = now.toLocaleTimeString('en-NG', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    }
    updateClock();
    setInterval(updateClock, 1000);
  }
});
