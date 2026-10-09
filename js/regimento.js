// Regimento Interno: busca, abrir/fechar tudo e abertura automática do capítulo
// quando a página é aberta num link para um artigo (ex.: regimento.html#art-27).
(function () {
  var chapters = Array.prototype.slice.call(document.querySelectorAll('.rg-chapter'));
  var search = document.getElementById('rgSearch');
  var count = document.getElementById('rgCount');
  if (!chapters.length || !search) return;

  function t(pt, en) {
    return document.documentElement.getAttribute('lang') === 'en' ? en : pt;
  }

  function normalize(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // Agrupa cada artigo (ou cargo/subtítulo) com os itens que vêm depois dele,
  // para a busca esconder/mostrar o artigo inteiro e não só a primeira linha.
  chapters.forEach(function (chapter) {
    var body = chapter.querySelector('.rg-body');
    var kids = Array.prototype.slice.call(body.children);
    var group = null;
    kids.forEach(function (el) {
      var starts = el.classList.contains('rg-art') || el.classList.contains('rg-sub') || el.classList.contains('rg-role');
      if (!group || starts) {
        group = document.createElement('div');
        group.className = 'rg-group';
        body.insertBefore(group, el);
      }
      group.appendChild(el);
    });
    Array.prototype.forEach.call(body.querySelectorAll('.rg-group'), function (g) {
      g.setAttribute('data-text', normalize(g.textContent));
    });
  });

  function setPlaceholder() {
    search.placeholder = t(search.dataset.placeholderPt, search.dataset.placeholderEn);
  }
  setPlaceholder();
  window.addEventListener('pelslangchange', setPlaceholder);

  function runSearch() {
    var q = normalize(search.value.trim());
    var total = 0;
    chapters.forEach(function (chapter) {
      var groups = chapter.querySelectorAll('.rg-group');
      var hits = 0;
      // Se o termo está no título do capítulo, mostra o capítulo inteiro.
      var titleMatch = q && normalize(chapter.querySelector('summary').textContent).indexOf(q) !== -1;
      Array.prototype.forEach.call(groups, function (g) {
        var match = !q || titleMatch || g.getAttribute('data-text').indexOf(q) !== -1;
        g.style.display = match ? '' : 'none';
        if (match && q) hits++;
      });
      chapter.style.display = (!q || hits) ? '' : 'none';
      chapter.open = !!q && hits > 0;
      total += hits;
    });
    count.textContent = q
      ? (total ? total + ' ' + t('trecho(s) encontrado(s)', 'match(es) found') : t('Nada encontrado.', 'Nothing found.'))
      : '';
  }
  search.addEventListener('input', runSearch);

  document.getElementById('rgExpand').addEventListener('click', function () {
    chapters.forEach(function (c) { if (c.style.display !== 'none') c.open = true; });
  });
  document.getElementById('rgCollapse').addEventListener('click', function () {
    chapters.forEach(function (c) { c.open = false; });
  });

  // Links diretos para um artigo ou capítulo.
  function openHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    var details = el.closest ? el.closest('details') : null;
    if (details) details.open = true;
    setTimeout(function () { el.scrollIntoView({ block: 'start' }); }, 50);
  }
  window.addEventListener('hashchange', openHash);
  openHash();
})();
