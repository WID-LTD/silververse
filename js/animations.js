/* ═══════════════════════════════════════
   SilverVerse — Animations & Interactions
   ═══════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function () {

  /* ── Scroll Reveal ── */
  const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
  if (revealElements.length) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealElements.forEach(el => revealObserver.observe(el));
  }

  /* ── Animated Counters ── */
  const counters = document.querySelectorAll('[data-count-to]');
  if (counters.length) {
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(el => counterObserver.observe(el));
  }

  function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-count-to'), 10);
    const suffix = el.getAttribute('data-count-suffix') || '';
    const prefix = el.getAttribute('data-count-prefix') || '';
    const duration = 2000;
    const start = performance.now();
    const step = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(eased * target);
      el.textContent = prefix + current.toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ── Countdown Timer ── */
  const countdownEl = document.getElementById('countdown');
  if (countdownEl) {
    const targetDate = new Date('2026-08-15T10:00:00+01:00').getTime();
    function updateCountdown() {
      const now = Date.now();
      const diff = targetDate - now;
      if (diff <= 0) {
        countdownEl.innerHTML = '<span class="countdown-expired">Event is Live!</span>';
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      const units = [
        { val: days, label: 'Days' },
        { val: hours, label: 'Hours' },
        { val: minutes, label: 'Minutes' },
        { val: seconds, label: 'Seconds' }
      ];
      countdownEl.innerHTML = units.map(u =>
        '<div class="countdown-unit">' +
          '<span class="countdown-value">' + String(u.val).padStart(2, '0') + '</span>' +
          '<span class="countdown-label">' + u.label + '</span>' +
        '</div>'
      ).join('<div class="countdown-sep">:</div>');
    }
    updateCountdown();
    setInterval(updateCountdown, 1000);
  }

  /* ── Navbar Scroll ── */
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    function checkScroll() {
      if (window.scrollY > 80) {
        navbar.classList.add('navbar-scrolled');
      } else {
        navbar.classList.remove('navbar-scrolled');
      }
    }
    checkScroll();
    window.addEventListener('scroll', checkScroll, { passive: true });
  }

  /* ── Smooth Scroll for Anchor Links ── */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        const headerOffset = 80;
        const elementPosition = targetEl.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        // Close mobile nav if open
        document.querySelectorAll('.navbar-links.show').forEach(el => el.classList.remove('show'));
      }
    });
  });

  /* ── FAQ Accordion ── */
  document.querySelectorAll('.faq-item').forEach(item => {
    const question = item.querySelector('.faq-question');
    if (question) {
      question.addEventListener('click', () => {
        const wasOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item.open').forEach(openItem => {
          openItem.classList.remove('open');
          const answer = openItem.querySelector('.faq-answer');
          if (answer) answer.style.maxHeight = '0';
        });
        if (!wasOpen) {
          item.classList.add('open');
          const answer = item.querySelector('.faq-answer');
          if (answer) answer.style.maxHeight = answer.scrollHeight + 'px';
        }
      });
    }
  });

  /* ── Partner Logo Infinite Scroll ── */
  const marqueeTrack = document.querySelector('.marquee-track');
  if (marqueeTrack) {
    marqueeTrack.addEventListener('mouseenter', () => {
      marqueeTrack.style.animationPlayState = 'paused';
    });
    marqueeTrack.addEventListener('mouseleave', () => {
      marqueeTrack.style.animationPlayState = 'running';
    });
  }

  /* ── Back to Top ── */
  const backToTop = document.getElementById('backToTop');
  if (backToTop) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 600) {
        backToTop.classList.add('visible');
      } else {
        backToTop.classList.remove('visible');
      }
    }, { passive: true });
    backToTop.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ── Live Clock (for check-in page) ── */
  const liveClock = document.getElementById('liveClock');
  if (liveClock) {
    function updateClock() {
      const now = new Date();
      liveClock.textContent = now.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    updateClock();
    setInterval(updateClock, 1000);
  }
});
