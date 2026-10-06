// Lembretes "Agora e em breve" (página inicial).
// - Busca os lembretes cadastrados pela diretoria (Apps Script, rota pública).
//   Se não houver nenhum, ou a busca falhar, mantém a lista padrão do HTML.
// - Coloca o pôster horizontal de cada cartão (data-poster) só se o arquivo
//   carregar, remove cartões vencidos (data-until) e duplica a lista para o
//   loop contínuo sem emenda.
(function () {
  var API_URL = 'https://script.google.com/macros/s/AKfycby_PFJdHZWq77_cmMUO34QOCciGgpZ65YxnuijNvtWz5YfxFhFg9BlmW-IPCZxWvDU7fQ/exec?action=lembretes';

  var ticker = document.getElementById('ticker');
  var track = document.getElementById('tickerTrack');
  if (!ticker || !track) return;

  // Esconde o letreiro até saber qual lista mostrar (evita a lista padrão
  // piscar e ser trocada logo depois).
  ticker.classList.add('is-loading');

  function span(className, text, lang) {
    var el = document.createElement('span');
    el.className = className;
    el.textContent = text;
    if (lang) el.lang = lang;
    return el;
  }

  function buildItem(l) {
    var li = document.createElement('li');
    li.className = 'ticker-item';
    if (/^https:\/\//i.test(l.posterUrl || '')) li.setAttribute('data-poster', l.posterUrl);
    if (l.validade) li.setAttribute('data-until', l.validade);

    var card = document.createElement(l.link ? 'a' : 'div');
    card.className = 'ticker-card';
    if (l.link) {
      card.href = l.link;
      if (/^https?:/i.test(l.link)) { card.target = '_blank'; card.rel = 'noopener'; }
    }

    var poster = span('ticker-poster', '');
    var empty = span('ticker-poster-empty', '📣');
    empty.setAttribute('aria-hidden', 'true');
    var small = document.createElement('small');
    small.className = 'i18n-pt';
    small.textContent = 'Arte em breve · 1600×512';
    var smallEn = document.createElement('small');
    smallEn.className = 'i18n-en';
    smallEn.lang = 'en';
    smallEn.textContent = 'Poster coming soon · 1600×512';
    empty.appendChild(small);
    empty.appendChild(smallEn);
    poster.appendChild(empty);
    card.appendChild(poster);

    if (l.selo) {
      var hot = l.destaque ? ' ticker-tag-hot' : '';
      card.appendChild(span('ticker-tag' + hot + ' i18n-pt', l.selo));
      card.appendChild(span('ticker-tag' + hot + ' i18n-en', l.seloEn || l.selo, 'en'));
    }
    card.appendChild(span('ticker-text i18n-pt', l.titulo));
    card.appendChild(span('ticker-text i18n-en', l.tituloEn || l.titulo, 'en'));
    if (/^\d{4}-\d{2}-\d{2}$/.test(l.validade || '')) {
      var p = l.validade.split('-');
      card.appendChild(span('ticker-deadline i18n-pt', 'Até ' + p[2] + '/' + p[1] + '/' + p[0]));
      card.appendChild(span('ticker-deadline i18n-en', 'Until ' + p[1] + '/' + p[2] + '/' + p[0], 'en'));
    }

    li.appendChild(card);
    return li;
  }

  function fetchLembretes() {
    var controller = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, 3500);
    return fetch(API_URL, controller ? { signal: controller.signal } : undefined)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        clearTimeout(timer);
        return { configurado: !!(d && d.configurado), lista: d && d.lembretes ? d.lembretes : [] };
      })
      .catch(function () { clearTimeout(timer); return { configurado: false, lista: [] }; });
  }

  // Só insere o <img> se o arquivo realmente carregar; senão o espaço
  // reservado "Arte em breve" continua aparecendo (sem ícone de imagem quebrada).
  function loadPoster(li) {
    return new Promise(function (resolve) {
      var src = li.getAttribute('data-poster');
      var poster = li.querySelector('.ticker-poster');
      if (!src || !poster) return resolve();
      var probe = new Image();
      probe.onload = function () {
        var img = document.createElement('img');
        img.alt = '';
        img.decoding = 'async';
        img.src = src;
        poster.appendChild(img);
        poster.classList.add('has-img');
        resolve();
      };
      probe.onerror = resolve;
      probe.src = src;
    });
  }

  function startLoop() {
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    // Repete o conjunto até cobrir pelo menos 1,2x a largura visível, sempre
    // em número par de cópias (a animação anda -50% e volta ao início sem pulo).
    var originals = Array.prototype.slice.call(track.children);
    var viewport = track.parentElement;

    function addCopy() {
      originals.forEach(function (li) {
        var clone = li.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        Array.prototype.forEach.call(clone.querySelectorAll('a'), function (a) { a.tabIndex = -1; });
        track.appendChild(clone);
      });
    }

    addCopy();
    var guard = 0;
    while (track.scrollWidth / 2 < viewport.clientWidth * 1.2 && guard < 6) {
      addCopy();
      addCopy();
      guard++;
    }

    // ~45px por segundo, independente da quantidade de cartões.
    var seconds = Math.max(25, Math.round(track.scrollWidth / 2 / 45));
    track.style.setProperty('--ticker-duration', seconds + 's');
  }

  function init() {
    var today = new Date().toISOString().slice(0, 10);
    Array.prototype.slice.call(track.querySelectorAll('li[data-until]')).forEach(function (li) {
      if (li.getAttribute('data-until') < today) li.remove();
    });

    if (!track.children.length) {
      ticker.classList.add('is-empty');
      return;
    }

    // Espera os pôsteres (no máx. 3 s) para que as cópias do loop já os incluam.
    var timeout = new Promise(function (resolve) { setTimeout(resolve, 3000); });
    return Promise.race([
      Promise.all(Array.prototype.map.call(track.children, loadPoster)),
      timeout
    ]).then(startLoop);
  }

  fetchLembretes().then(function (res) {
    // Há lembretes cadastrados: vale a seleção do webmaster (mesmo que não
    // tenha liberado nenhum — aí o letreiro fica escondido). Sem nenhum
    // cadastrado (ou planilha fora do ar), fica a lista padrão do HTML.
    if (res.configurado) {
      track.textContent = '';
      res.lista.forEach(function (l) { track.appendChild(buildItem(l)); });
    }
    return init();
  }).then(function () {
    ticker.classList.remove('is-loading');
  });
})();
