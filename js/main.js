(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Theme toggle (light/dark) ---------- */
  const themeToggle = document.getElementById('themeToggle');
  const themeToggleMobile = document.getElementById('themeToggleMobile');
  const themeToggleLabel = document.getElementById('themeToggleLabel');
  const htmlEl = document.documentElement;

  const applyThemeUI = (theme) => {
    const isDark = theme === 'dark';
    const isEn = htmlEl.getAttribute('lang') === 'en';
    if (themeToggle) themeToggle.setAttribute('aria-pressed', String(isDark));
    if (themeToggleMobile) themeToggleMobile.setAttribute('aria-pressed', String(isDark));
    if (themeToggleLabel) {
      themeToggleLabel.textContent = isEn
        ? (isDark ? 'Light theme' : 'Dark theme')
        : (isDark ? 'Tema claro' : 'Tema escuro');
    }
  };
  document.addEventListener('pelslangchange', () => {
    applyThemeUI(htmlEl.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  });

  const setTheme = (theme) => {
    htmlEl.setAttribute('data-theme', theme);
    localStorage.setItem('pels-theme', theme);
    applyThemeUI(theme);
  };

  const toggleTheme = () => {
    const current = htmlEl.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
  };

  applyThemeUI(htmlEl.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
  if (themeToggleMobile) themeToggleMobile.addEventListener('click', toggleTheme);

  /* ---------- Header shrink on scroll + scroll progress ---------- */
  const header = document.getElementById('siteHeader');
  const progress = document.getElementById('scrollProgress');
  const backToTop = document.getElementById('backToTop');

  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 40);
    backToTop.classList.toggle('is-visible', y > 600);

    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (y / docHeight) * 100 : 0;
    progress.style.width = pct + '%';
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* Note: the 3D hero mark itself (extruded from the vector logo, auto-spin,
     drag-to-rotate, scroll acceleration) is handled by js/logo3d.js. */

  /* ---------- Mobile nav ---------- */
  const navToggle = document.getElementById('navToggle');
  const navMobile = document.getElementById('navMobile');

  const closeMobileNav = () => {
    navToggle.classList.remove('is-open');
    navMobile.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  navToggle.addEventListener('click', () => {
    const isOpen = navMobile.classList.toggle('is-open');
    navToggle.classList.toggle('is-open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  navMobile.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMobileNav));

  /* ---------- Scroll-reveal animations ---------- */
  const revealEls = document.querySelectorAll('.reveal');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(el => el.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    revealEls.forEach(el => revealObserver.observe(el));
  }

  /* ---------- Scrollspy: highlight active nav link ---------- */
  const sections = document.querySelectorAll('main section[id]');
  const navLinks = document.querySelectorAll('.nav-desktop a');

  const spyObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const id = entry.target.getAttribute('id');
      const link = document.querySelector(`.nav-desktop a[href="#${id}"]`);
      if (!link) return;
      if (entry.isIntersecting) {
        navLinks.forEach(l => l.classList.remove('is-active'));
        link.classList.add('is-active');
      }
    });
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });

  sections.forEach(s => spyObserver.observe(s));

  /* ---------- Animated stat counters ---------- */
  const counters = document.querySelectorAll('.stat-num');

  const animateCounter = (el) => {
    const target = parseInt(el.getAttribute('data-count'), 10) || 0;
    const suffix = el.getAttribute('data-suffix') || '';
    const duration = 1400;
    const start = performance.now();

    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(eased * target) + suffix;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  if (reduceMotion || !('IntersectionObserver' in window)) {
    counters.forEach(el => {
      el.textContent = (el.getAttribute('data-count') || '0') + (el.getAttribute('data-suffix') || '');
    });
  } else {
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

  /* ---------- Timeline filter (type + year, combined) ---------- */
  const typeFilterButtons = document.querySelectorAll('[data-filter]');
  const yearFilterButtons = document.querySelectorAll('[data-year-filter]');
  const timelineItems = document.querySelectorAll('.timeline-item');

  let activeType = 'all';
  let activeYear = 'all';

  const applyTimelineFilters = () => {
    timelineItems.forEach(item => {
      const typeMatch = activeType === 'all' || item.getAttribute('data-type') === activeType;
      const yearMatch = activeYear === 'all' || item.getAttribute('data-year') === activeYear;
      item.style.display = (typeMatch && yearMatch) ? '' : 'none';
    });
  };

  typeFilterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      typeFilterButtons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      activeType = btn.getAttribute('data-filter');
      applyTimelineFilters();
    });
  });

  yearFilterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      yearFilterButtons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      activeYear = btn.getAttribute('data-year-filter');
      applyTimelineFilters();
    });
  });

  /* ---------- Footer year ---------- */
  const year = new Date().getFullYear();
  document.querySelectorAll('#year, #yearEn').forEach((el) => { el.textContent = year; });

  /* ---------- Footer last-updated (from file's real mtime, no fake date) ---------- */
  const mtime = new Date(document.lastModified);
  if (!isNaN(mtime)) {
    const ptEl = document.getElementById('lastUpdated');
    const enEl = document.getElementById('lastUpdatedEn');
    if (ptEl) ptEl.textContent = mtime.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    if (enEl) enEl.textContent = mtime.toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
  } else {
    document.querySelectorAll('.footer-updated').forEach((el) => el.remove());
  }

  /* ---------- Ripple on every button click ---------- */
  const rippleTargets = document.querySelectorAll('.btn, .filter-btn, .nav-toggle, .back-to-top, .gallery-item');

  rippleTargets.forEach(el => {
    el.addEventListener('click', (e) => {
      if (reduceMotion) return;
      const rect = el.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.4;
      const x = (e.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2;
      const y = (e.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2;

      const span = document.createElement('span');
      span.className = 'ripple';
      span.style.width = span.style.height = size + 'px';
      span.style.left = x + 'px';
      span.style.top = y + 'px';
      el.appendChild(span);
      span.addEventListener('animationend', () => span.remove());
    });
  });

  /* ---------- 3D tilt on gallery cards ---------- */
  const tiltEls = document.querySelectorAll('.tilt');

  if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
    tiltEls.forEach(el => {
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        const rotateY = (px - 0.5) * 16;
        const rotateX = (0.5 - py) * 16;
        el.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px) scale(1.03)`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });
    });
  }

  /* ---------- Cursor spotlight on opportunity / board cards ---------- */
  const spotlightEls = document.querySelectorAll('.opp-card, .board-card');

  if (window.matchMedia('(hover: hover)').matches) {
    spotlightEls.forEach(el => {
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width) * 100 + '%');
        el.style.setProperty('--my', ((e.clientY - rect.top) / rect.height) * 100 + '%');
      });
    });
  }

  /* ---------- Hero depth-zoom parallax (scroll + mouse) ----------
     Inspired by the layered "push through the scene" scroll effect
     (a la The Goonies / Webflow showcases): as the hero scrolls out,
     the mascot scales up and fades like the camera is flying past it,
     while the glow ring dilates behind it and the copy drifts slower
     for depth separation. */
  const heroVisual = document.querySelector('.hero-visual');
  const glowRing = document.querySelector('.glow-ring');
  const heroSection = document.querySelector('.hero');
  const heroCopy = document.querySelector('.hero-copy');

  const cinematicHero = !reduceMotion && heroVisual && window.matchMedia('(min-width: 761px)').matches;

  if (cinematicHero) {
    let heroTiltX = 0;
    let heroTiltY = 0;
    const heroHeight = () => heroSection.offsetHeight || window.innerHeight;

    const applyHeroTransform = () => {
      const y = Math.min(window.scrollY, heroHeight());
      const progress = y / heroHeight(); // 0 → 1 across the hero's own height

      const zoomScale = 1 + progress * 0.6;
      const zoomOpacity = Math.max(1 - progress * 1.3, 0);
      heroVisual.style.transform =
        `translateY(${progress * -70}px) scale(${zoomScale}) rotateY(${heroTiltY}deg) rotateX(${heroTiltX}deg)`;
      heroVisual.style.opacity = zoomOpacity;

      if (glowRing) glowRing.style.transform = `scale(${1 + progress * 1.6})`;
      if (glowRing) glowRing.style.opacity = Math.max(1 - progress * 1.1, 0);

      if (heroCopy) {
        heroCopy.style.transform = `translateY(${progress * 40}px)`;
        heroCopy.style.opacity = Math.max(1 - progress * 1.6, 0);
      }
    };

    document.addEventListener('scroll', applyHeroTransform, { passive: true });
    applyHeroTransform();

    if (window.matchMedia('(hover: hover)').matches && heroSection) {
      heroSection.addEventListener('mousemove', (e) => {
        const rect = heroSection.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        heroTiltY = px * 10;
        heroTiltX = -py * 10;
        applyHeroTransform();
      });
      heroSection.addEventListener('mouseleave', () => {
        heroTiltX = 0; heroTiltY = 0;
        applyHeroTransform();
      });
    }
  } else if (heroVisual) {
    heroVisual.style.transform = '';
    heroVisual.style.opacity = '1';
    if (glowRing) { glowRing.style.transform = ''; glowRing.style.opacity = ''; }
    if (heroCopy) { heroCopy.style.transform = ''; heroCopy.style.opacity = '1'; }
  }

  /* ---------- Cinematic pinned stats (Star Atlas-style scroll scene) ---------- */
  const pinWrap = document.getElementById('pinWrap');
  const cineStats = document.querySelectorAll('.stat-cine');

  if (!reduceMotion && window.matchMedia('(min-width: 761px)').matches && pinWrap && cineStats.length) {
    const updatePin = () => {
      const rect = pinWrap.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const progress = total > 0 ? Math.min(Math.max(-rect.top / total, 0), 1) : 0;

      cineStats.forEach((el, i) => {
        const phaseStart = i / cineStats.length;
        el.classList.toggle('is-active', progress >= phaseStart);
      });
    };
    document.addEventListener('scroll', updatePin, { passive: true });
    updatePin();
  } else {
    cineStats.forEach(el => el.classList.add('is-active'));
  }

  /* ---------- Gallery: photos from every project, shuffled ---------- */
  const GALLERY_PHOTOS = [
    { src: 'assets/img/gallery/recepção_calouros.jpeg', pt: 'Recepção de calouros', en: 'Freshman welcome' },
    { src: 'assets/img/gallery/reunião_gestão.jpeg', pt: 'Reunião de gestão', en: 'Board meeting' },
    { src: 'assets/img/projetos/cobep/foto-1.jpg', pt: 'COBEP 2025', en: 'COBEP 2025' },
    { src: 'assets/img/projetos/cobep/foto-2.jpg', pt: 'COBEP 2025', en: 'COBEP 2025' },
    { src: 'assets/img/projetos/cobep/foto-3.jpg', pt: 'COBEP 2025', en: 'COBEP 2025' },
    { src: 'assets/img/projetos/cobep/foto-4.jpg', pt: 'COBEP 2025', en: 'COBEP 2025' },
    { src: 'assets/img/projetos/palestra-bem/02_04_2026-1.jpg', pt: 'Palestra BEM Inteligência de Dados', en: 'BEM Inteligência de Dados talk' },
    { src: 'assets/img/projetos/palestra-bem/02_04_2026-2.jpg', pt: 'Palestra BEM Inteligência de Dados', en: 'BEM Inteligência de Dados talk' },
    { src: 'assets/img/projetos/palestra-bem/02_04_2026-3.jpg', pt: 'Palestra BEM Inteligência de Dados', en: 'BEM Inteligência de Dados talk' },
    { src: "assets/img/projetos/pels-day/20_06_2024 - 1.jpg", pt: 'PELS Day 2024', en: 'PELS Day 2024' },
    { src: "assets/img/projetos/pels-day/19_06_2025 - 1.jpg", pt: 'PELS Day 2025', en: 'PELS Day 2025' },
    { src: "assets/img/projetos/pels-day/19_06_2025 - 2.jpg", pt: 'PELS Day 2025', en: 'PELS Day 2025' },
    { src: "assets/img/projetos/pels-day/20_06_2026 - 1.jpg", pt: 'Arraiá IEEE UFMS 2026', en: 'Arraiá IEEE UFMS 2026' },
    { src: "assets/img/projetos/pels-day/20_06_2026 - 2.jpg", pt: 'Arraiá IEEE UFMS 2026', en: 'Arraiá IEEE UFMS 2026' },
    { src: "assets/img/projetos/pels-day/20_06_2026 - 3.jpg", pt: 'Arraiá IEEE UFMS 2026', en: 'Arraiá IEEE UFMS 2026' },
    { src: "assets/img/projetos/pels-day/20_06_2026 - 4.jpg", pt: 'Arraiá IEEE UFMS 2026', en: 'Arraiá IEEE UFMS 2026' },
    { src: 'assets/img/projetos/power-english/12_05_2026.jpg', pt: 'Power English', en: 'Power English' },
    { src: 'assets/img/projetos/power-english/19_05_2026.jpg', pt: 'Power English', en: 'Power English' },
    { src: 'assets/img/projetos/power-english/03_06_2026.jpg', pt: 'Power English', en: 'Power English' },
    { src: 'assets/img/projetos/power-english/04_08_2026.jpg', pt: 'Power English', en: 'Power English' },
    { src: 'assets/img/projetos/wefor/06_04_2026.jpeg', pt: 'WEFor 2026', en: 'WEFor 2026' },
    { src: 'assets/img/projetos/wefor/07_04_2026.jpeg', pt: 'WEFor 2026', en: 'WEFor 2026' },
    { src: 'assets/img/projetos/wefor/08_04_2026.jpeg', pt: 'WEFor 2026', en: 'WEFor 2026' },
    { src: 'assets/img/projetos/wefor/09_04_2026.jpeg', pt: 'WEFor 2026', en: 'WEFor 2026' },
  ];

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const galleryGrid = document.getElementById('galleryGrid');
  if (galleryGrid) {
    galleryGrid.innerHTML = shuffle(GALLERY_PHOTOS).map((p) => `
      <div class="gallery-item" data-caption="${p.pt}" tabindex="0" role="button" aria-label="Ampliar foto: ${p.pt}">
        <img src="${p.src}" alt="${p.pt} — foto do capítulo IEEE PELS UFMS" loading="lazy">
        <div class="gallery-overlay"><span class="i18n-pt">${p.pt}</span><span class="i18n-en" lang="en">${p.en}</span></div>
        <span class="gallery-expand" aria-hidden="true">⤢</span>
      </div>
    `).join('');
  }

  /* ---------- Gallery carousel (auto-scroll + center highlight) ---------- */
  const galleryPrev = document.getElementById('galleryPrev');
  const galleryNext = document.getElementById('galleryNext');

  if (galleryGrid) {
    const galleryCards = Array.from(galleryGrid.querySelectorAll('.gallery-item'));
    let centerRAFPending = false;

    const updateCenteredCard = () => {
      centerRAFPending = false;
      const gridRect = galleryGrid.getBoundingClientRect();
      const centerX = gridRect.left + gridRect.width / 2;
      let closest = null;
      let closestDist = Infinity;
      galleryCards.forEach((card) => {
        const r = card.getBoundingClientRect();
        const dist = Math.abs((r.left + r.width / 2) - centerX);
        if (dist < closestDist) { closestDist = dist; closest = card; }
      });
      galleryCards.forEach((card) => card.classList.toggle('is-centered', card === closest));
    };

    const scheduleCenterUpdate = () => {
      if (!centerRAFPending) {
        centerRAFPending = true;
        requestAnimationFrame(updateCenteredCard);
      }
    };

    galleryGrid.addEventListener('scroll', scheduleCenterUpdate, { passive: true });
    updateCenteredCard();

    const scrollByCard = (dir) => {
      const card = galleryGrid.querySelector('.gallery-item');
      const step = card ? card.getBoundingClientRect().width + 20 : 280;
      galleryGrid.scrollBy({ left: dir * step, behavior: reduceMotion ? 'auto' : 'smooth' });
    };
    if (galleryPrev) galleryPrev.addEventListener('click', () => { pauseAutoScroll(4000); scrollByCard(-1); });
    if (galleryNext) galleryNext.addEventListener('click', () => { pauseAutoScroll(4000); scrollByCard(1); });

    /* Continuous auto-scroll, paused on hover/touch/focus/manual nav */
    let autoPaused = false;
    let autoPauseTimer = null;
    function pauseAutoScroll(resumeAfterMs) {
      autoPaused = true;
      if (autoPauseTimer) clearTimeout(autoPauseTimer);
      if (resumeAfterMs) autoPauseTimer = setTimeout(() => { autoPaused = false; }, resumeAfterMs);
    }

    if (!reduceMotion && galleryCards.length > 1) {
      const AUTO_SCROLL_SPEED = 0.55; // px per frame, ~33px/s at 60fps
      const step = () => {
        if (!autoPaused) {
          const maxScroll = galleryGrid.scrollWidth - galleryGrid.clientWidth;
          if (galleryGrid.scrollLeft >= maxScroll - 1) {
            galleryGrid.scrollLeft = 0;
          } else {
            galleryGrid.scrollLeft += AUTO_SCROLL_SPEED;
          }
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);

      ['mouseenter', 'touchstart', 'focusin'].forEach((evt) =>
        galleryGrid.addEventListener(evt, () => pauseAutoScroll(0), { passive: true }));
      ['mouseleave', 'touchend', 'focusout'].forEach((evt) =>
        galleryGrid.addEventListener(evt, () => { autoPaused = false; }, { passive: true }));
    }
  }

  /* ---------- Lightbox gallery ---------- */
  const galleryItems = Array.from(document.querySelectorAll('.gallery-item'));
  const lightbox = document.getElementById('lightbox');

  if (galleryItems.length && lightbox) {
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxCaption = document.getElementById('lightboxCaption');
    const lightboxClose = document.getElementById('lightboxClose');
    const lightboxFocusable = lightbox.querySelectorAll('button');
    let currentIndex = 0;
    let lastFocused = null;

    const openLightbox = (index) => {
      const isFirstOpen = !lightbox.classList.contains('is-open');
      if (isFirstOpen) lastFocused = document.activeElement;
      currentIndex = (index + galleryItems.length) % galleryItems.length;
      const item = galleryItems[currentIndex];
      const img = item.querySelector('img');
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightboxCaption.textContent = item.getAttribute('data-caption') || img.alt;
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      if (isFirstOpen) setTimeout(() => lightboxClose.focus(), 0);
    };

    const closeLightbox = () => {
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lastFocused) lastFocused.focus();
    };

    galleryItems.forEach((item, index) => {
      item.addEventListener('click', () => openLightbox(index));
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(index);
        }
      });
    });

    lightboxClose.addEventListener('click', closeLightbox);
    document.getElementById('lightboxPrev').addEventListener('click', () => openLightbox(currentIndex - 1));
    document.getElementById('lightboxNext').addEventListener('click', () => openLightbox(currentIndex + 1));

    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') openLightbox(currentIndex + 1);
      if (e.key === 'ArrowLeft') openLightbox(currentIndex - 1);
      if (e.key === 'Tab') {
        const focusables = Array.from(lightboxFocusable);
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  /* ---------- Retratos da diretoria ---------- */
  document.querySelectorAll('.member-photo img').forEach((image) => {
    const portrait = image.closest('.member-photo');
    const revealPortrait = () => portrait.classList.add('has-photo');
    if (image.complete && image.naturalWidth > 0) revealPortrait();
    else image.addEventListener('load', revealPortrait, { once: true });
  });

})();
