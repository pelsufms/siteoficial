(() => {
  'use strict';

  const STORAGE_KEY = 'pels-lang';

  const applyLangUI = (lang) => {
    document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
      const active = btn.getAttribute('data-lang-btn') === lang;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  };

  const setLang = (lang) => {
    document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'pt-BR');
    localStorage.setItem(STORAGE_KEY, lang);
    applyLangUI(lang);
    document.dispatchEvent(new CustomEvent('pelslangchange', { detail: { lang } }));
  };

  const current = document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'pt';
  applyLangUI(current);

  document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
    btn.addEventListener('click', () => setLang(btn.getAttribute('data-lang-btn')));
  });
})();
