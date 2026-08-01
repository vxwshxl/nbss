/* ==========================================================================
   NBSS — progressive enhancement only.
   HTMX does the data work; this file handles the things HTMX has no opinion
   about: the mobile menu, the search overlay, sticky-header state, the stat
   counters and scroll-to after a fragment swap. Everything degrades to a
   perfectly usable page if this file never loads.
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------- mobile nav */
  var navToggle = document.querySelector('[data-nav-toggle]');
  var nav = document.getElementById('nav');

  function setNav(open) {
    if (!nav || !navToggle) return;
    nav.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }

  if (navToggle) {
    navToggle.addEventListener('click', function () {
      setNav(nav.classList.contains('is-open') === false);
    });
    // A tap on any link inside the sheet should close it.
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setNav(false);
    });
  }

  /* ------------------------------------------------------ search overlay */
  var searchbar = document.getElementById('searchbar');
  var searchInput = document.getElementById('site-search');
  var openBtn = document.querySelector('[data-search-open]');
  var closeBtn = document.querySelector('[data-search-close]');

  function setSearch(open) {
    if (!searchbar) return;
    searchbar.hidden = !open;
    if (openBtn) openBtn.setAttribute('aria-expanded', String(open));
    if (open && searchInput) searchInput.focus();
    if (!open && searchInput) {
      searchInput.value = '';
      var results = document.getElementById('search-results');
      if (results) results.innerHTML = '';
    }
  }

  if (openBtn) openBtn.addEventListener('click', function () { setSearch(searchbar.hidden); });
  if (closeBtn) closeBtn.addEventListener('click', function () { setSearch(false); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { setSearch(false); setNav(false); }
    // "/" focuses search, the way a documentation site would.
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      e.preventDefault();
      setSearch(true);
    }
  });

  /* ------------------------------------------------------- sticky header */
  var masthead = document.getElementById('masthead');
  if (masthead) {
    var stuck = false;
    window.addEventListener('scroll', function () {
      var now = window.scrollY > 12;
      if (now !== stuck) {
        stuck = now;
        masthead.classList.toggle('is-stuck', stuck);
      }
    }, { passive: true });
  }

  /* -------------------------------------------------------- stat counters
     Counts up once, when the strip first scrolls into view. Values may carry
     a suffix in the markup, so only the numeric span is animated. */
  var counters = document.querySelectorAll('[data-count]');
  if (counters.length && !reduceMotion && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        countUp(entry.target);
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { io.observe(el); });
  }

  function countUp(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (isNaN(target)) return;
    var duration = 1100;
    var start = null;

    function tick(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      // easeOutExpo — fast, then a long settle, which reads as "counting".
      var eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* --------------------------------------------------- htmx interactions */

  // Scroll a freshly-swapped fragment into view when the trigger asked for it.
  document.body.addEventListener('htmx:afterSwap', function (e) {
    var trigger = e.detail && e.detail.requestConfig && e.detail.requestConfig.elt;
    var selector = trigger && trigger.getAttribute && trigger.getAttribute('data-scroll-to');
    var target = selector ? document.querySelector(selector) : null;
    if (target) {
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  });

  // After a form is replaced by its success panel, move focus there so screen
  // readers and keyboard users land on the confirmation rather than the top.
  document.body.addEventListener('htmx:afterSettle', function (e) {
    var success = e.target && e.target.querySelector && e.target.querySelector('.success');
    if (e.target && e.target.classList && e.target.classList.contains('success')) success = e.target;
    if (success) {
      success.focus({ preventScroll: true });
      success.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }
  });

  // A validation failure comes back as 422 with the re-rendered form. HTMX
  // ignores non-2xx bodies by default, so opt this one case back in.
  document.body.addEventListener('htmx:beforeSwap', function (e) {
    if (e.detail.xhr && e.detail.xhr.status === 422) {
      e.detail.shouldSwap = true;
      e.detail.isError = false;
    }
  });

  // Close the search overlay once a result is followed.
  document.body.addEventListener('click', function (e) {
    if (e.target.closest('#search-results a')) setSearch(false);
  });
})();
