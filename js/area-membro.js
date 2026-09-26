// Área do Membro — login com Google + consulta de cargo via Apps Script.
//
// Preencha estes dois valores depois de completar a configuração manual:
// 1. GOOGLE_CLIENT_ID: criado em Google Cloud Console > Credenciais > OAuth Client ID.
// 2. APPS_SCRIPT_URL: URL do "App da Web" gerada ao implantar backend/Code.gs.
var GOOGLE_CLIENT_ID = '1061281219061-hdhk000q0j4mjfegohcc3rpep5jec4e4.apps.googleusercontent.com';
var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby_PFJdHZWq77_cmMUO34QOCciGgpZ65YxnuijNvtWz5YfxFhFg9BlmW-IPCZxWvDU7fQ/exec';

(function () {
  var elLoggedOut = document.getElementById('memberLoggedOut');
  var elLoading = document.getElementById('memberLoading');
  var elFound = document.getElementById('memberFound');
  var elNotFound = document.getElementById('memberNotFound');
  var elError = document.getElementById('memberLoginError');

  function showOnly(el) {
    [elLoggedOut, elLoading, elFound, elNotFound].forEach(function (e) {
      e.style.display = e === el ? '' : 'none';
    });
  }

  function showError(msg) {
    showOnly(elLoggedOut);
    elError.textContent = msg;
    elError.style.display = 'block';
  }

  function handleCredentialResponse(response) {
    showOnly(elLoading);

    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf('URL_DO_APP_DA_WEB_AQUI') !== -1) {
      showError('Configuração pendente: a Área do Membro ainda não foi finalizada. Fale com a Diretoria.');
      return;
    }

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      // Content-Type text/plain evita o preflight OPTIONS, que o Apps Script não trata.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ credential: response.credential })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          showError('Não foi possível verificar seu login agora. Tente novamente em instantes.');
          return;
        }

        if (data.found) {
          sessionStorage.setItem('pels-member', JSON.stringify(data));
          renderFound(data);
        } else {
          showOnly(elNotFound);
        }
      })
      .catch(function () {
        showError('Não foi possível conectar ao servidor de verificação. Tente novamente em instantes.');
      });
  }

  function renderFound(data) {
    document.getElementById('memberName').textContent = data.nome;
    document.getElementById('memberRole').textContent = data.cargo;
    var photo = document.getElementById('memberPhoto');
    if (data.fotoGoogle) {
      photo.src = data.fotoGoogle;
      photo.style.display = 'block';
    } else {
      photo.style.display = 'none';
    }
    renderAvisos(data.avisos || []);
    showOnly(elFound);
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderAvisos(avisos) {
    var container = document.getElementById('memberAvisos');
    if (!avisos.length) return; // mantém a mensagem padrão "nenhum aviso"

    container.innerHTML = avisos.map(function (aviso) {
      return (
        '<div class="aviso-item">' +
          '<p class="aviso-item-date">' + escapeHtml(aviso.data) + '</p>' +
          '<p class="aviso-item-title">' + escapeHtml(aviso.titulo) + '</p>' +
          '<p class="aviso-item-text">' + escapeHtml(aviso.texto) + '</p>' +
        '</div>'
      );
    }).join('');
  }

  function setupXploreSearch() {
    var form = document.getElementById('xploreSearchForm');
    var input = document.getElementById('xploreSearchInput');
    if (!form || !input) return;

    function updatePlaceholder() {
      var isEn = document.documentElement.getAttribute('lang') === 'en';
      input.placeholder = isEn ? input.dataset.placeholderEn : input.dataset.placeholderPt;
    }
    updatePlaceholder();
    window.addEventListener('pelslangchange', updatePlaceholder);

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var query = input.value.trim();
      if (!query) return;
      window.open('https://ieeexplore.ieee.org/search/searchresult.jsp?queryText=' + encodeURIComponent(query), '_blank', 'noopener');
    });
  }

  function signOut() {
    sessionStorage.removeItem('pels-member');
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
    showOnly(elLoggedOut);
  }

  document.getElementById('memberSignOut').addEventListener('click', signOut);
  document.getElementById('memberSignOutNotFound').addEventListener('click', signOut);
  setupXploreSearch();

  window.addEventListener('load', function () {
    // Se já verificamos essa pessoa nesta aba, evita pedir login de novo.
    var cached = sessionStorage.getItem('pels-member');
    if (cached) {
      try {
        renderFound(JSON.parse(cached));
        return;
      } catch (e) {
        sessionStorage.removeItem('pels-member');
      }
    }

    if (!window.google || !google.accounts || !google.accounts.id) {
      showError('Não foi possível carregar o login do Google. Verifique sua conexão e recarregue a página.');
      return;
    }

    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.indexOf('CLIENT_ID_AQUI') !== -1) {
      showError('Configuração pendente: a Área do Membro ainda não foi finalizada. Fale com a Diretoria.');
      return;
    }

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse
    });

    google.accounts.id.renderButton(
      document.getElementById('googleSignInButton'),
      { theme: 'outline', size: 'large', text: 'signin_with', locale: 'pt-BR' }
    );
  });
})();
