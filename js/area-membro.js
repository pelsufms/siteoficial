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

  // Guardado em memória (nunca em localStorage) só durante esta aba, para
  // poder reenviar junto de "salvar dados" / "publicar aviso" sem pedir
  // login de novo a cada ação, dentro da validade do próprio token do Google.
  var lastCredential = null;

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

  function callBackend(payload) {
    if (!lastCredential) {
      return Promise.resolve({ error: 'session_expired' });
    }
    payload.credential = lastCredential;
    return fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      // Content-Type text/plain evita o preflight OPTIONS, que o Apps Script não trata.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }

  function handleCredentialResponse(response) {
    lastCredential = response.credential;

    // Se o painel do membro já está na tela (veio do cache desta aba, ou a
    // pessoa já tinha acabado de logar), isso é só uma renovação silenciosa
    // do token em segundo plano — não refaz a busca nem re-renderiza nada,
    // pra não apagar o que a pessoa esteja digitando nos formulários.
    if (elFound.style.display !== 'none') return;

    showOnly(elLoading);

    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf('URL_DO_APP_DA_WEB_AQUI') !== -1) {
      showError('Configuração pendente: a Área do Membro ainda não foi finalizada. Fale com a Diretoria.');
      return;
    }

    callBackend({ action: 'login' })
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
    document.getElementById('memberCurso').textContent = data.curso || '—';
    document.getElementById('memberDesde').textContent = data.dataIngresso || '—';

    var photo = document.getElementById('memberPhoto');
    if (data.fotoGoogle) {
      photo.src = data.fotoGoogle;
      photo.style.display = 'block';
    } else {
      photo.style.display = 'none';
    }

    fillProfileForm(data);
    document.getElementById('avisoForm').style.display = data.isDiretoria ? 'flex' : 'none';
    renderAvisos(data.avisos || []);
    showOnly(elFound);
  }

  function fillProfileForm(data) {
    document.getElementById('profileNome').value = data.nome || '';
    document.getElementById('profileCurso').value = data.curso || '';
    document.getElementById('profileRa').value = data.ra || '';
    document.getElementById('profileTelefone').value = data.telefone || '';
  }

  function t(pt, en) {
    return document.documentElement.getAttribute('lang') === 'en' ? en : pt;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  var currentAvisos = [];

  function renderAvisos(avisos) {
    currentAvisos = avisos;
    var container = document.getElementById('memberAvisos');
    if (!avisos.length) {
      container.innerHTML =
        '<p class="i18n-pt" style="color:var(--ink-soft);">Nenhum aviso no momento.</p>' +
        '<p class="i18n-en" lang="en" style="color:var(--ink-soft);">No announcements right now.</p>';
      return;
    }

    container.innerHTML = avisos.map(function (aviso) {
      var id = escapeHtml(aviso.id);
      var actions = aviso.podeEditar
        ? '<span class="aviso-item-actions">' +
            '<button type="button" class="aviso-edit-btn" data-id="' + id + '">' + t('Editar', 'Edit') + '</button>' +
            '<button type="button" class="aviso-delete-btn" data-id="' + id + '">' + t('Excluir', 'Delete') + '</button>' +
          '</span>'
        : '';
      return (
        '<div class="aviso-item" data-id="' + id + '">' +
          '<p class="aviso-item-date">' + escapeHtml(aviso.data) + actions + '</p>' +
          '<p class="aviso-item-title">' + escapeHtml(aviso.titulo) + '</p>' +
          '<p class="aviso-item-text">' + escapeHtml(aviso.texto) + '</p>' +
        '</div>'
      );
    }).join('');
  }

  function findAviso(id) {
    for (var i = 0; i < currentAvisos.length; i++) {
      if (currentAvisos[i].id === id) return currentAvisos[i];
    }
    return null;
  }

  function setupAvisoActions() {
    document.getElementById('memberAvisos').addEventListener('click', function (ev) {
      var editBtn = ev.target.closest('.aviso-edit-btn');
      var deleteBtn = ev.target.closest('.aviso-delete-btn');
      var saveBtn = ev.target.closest('.aviso-save-btn');
      var cancelBtn = ev.target.closest('.aviso-cancel-btn');

      if (editBtn) {
        var aviso = findAviso(editBtn.dataset.id);
        if (!aviso) return;
        var item = editBtn.closest('.aviso-item');
        item.innerHTML =
          '<input type="text" class="aviso-edit-titulo" value="' + escapeHtml(aviso.titulo) + '">' +
          '<textarea class="aviso-edit-texto" rows="2">' + escapeHtml(aviso.texto) + '</textarea>' +
          '<span class="aviso-item-actions">' +
            '<button type="button" class="aviso-save-btn" data-id="' + editBtn.dataset.id + '">' + t('Salvar', 'Save') + '</button>' +
            '<button type="button" class="aviso-cancel-btn" data-id="' + editBtn.dataset.id + '">' + t('Cancelar', 'Cancel') + '</button>' +
          '</span>';
        return;
      }

      if (cancelBtn) {
        renderAvisos(currentAvisos);
        return;
      }

      if (saveBtn) {
        var item2 = saveBtn.closest('.aviso-item');
        var novoTitulo = item2.querySelector('.aviso-edit-titulo').value.trim();
        var novoTexto = item2.querySelector('.aviso-edit-texto').value.trim();
        if (!novoTitulo) return;
        callBackend({ action: 'updateAviso', id: saveBtn.dataset.id, titulo: novoTitulo, texto: novoTexto })
          .then(handleAvisoActionResult);
        return;
      }

      if (deleteBtn) {
        if (!window.confirm(t('Excluir este aviso?', 'Delete this announcement?'))) return;
        callBackend({ action: 'deleteAviso', id: deleteBtn.dataset.id })
          .then(handleAvisoActionResult);
        return;
      }
    });
  }

  function handleAvisoActionResult(data) {
    if (data && data.found) {
      sessionStorage.setItem('pels-member', JSON.stringify(data));
      renderAvisos(data.avisos || []);
      return;
    }
    var msg = data && data.error === 'session_expired'
      ? t('Sessão expirada — saia e entre novamente.', 'Session expired — sign out and sign in again.')
      : t('Não foi possível concluir. Tente novamente.', 'Could not complete this. Please try again.');
    window.alert(msg);
    renderAvisos(currentAvisos);
  }

  function setupPlaceholders() {
    var fields = document.querySelectorAll('[data-placeholder-pt]');
    function update() {
      var isEn = document.documentElement.getAttribute('lang') === 'en';
      fields.forEach(function (el) {
        el.placeholder = isEn ? el.dataset.placeholderEn : el.dataset.placeholderPt;
      });
    }
    update();
    window.addEventListener('pelslangchange', update);
  }

  function setupXploreSearch() {
    var form = document.getElementById('xploreSearchForm');
    var input = document.getElementById('xploreSearchInput');
    if (!form || !input) return;

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var query = input.value.trim();
      if (!query) return;
      window.open('https://ieeexplore.ieee.org/search/searchresult.jsp?queryText=' + encodeURIComponent(query), '_blank', 'noopener');
    });
  }

  function setupProfileForm() {
    var form = document.getElementById('profileForm');
    var status = document.getElementById('profileStatus');

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      status.textContent = '...';
      status.style.color = 'var(--ink-soft)';

      callBackend({
        action: 'updateProfile',
        nome: document.getElementById('profileNome').value,
        curso: document.getElementById('profileCurso').value,
        ra: document.getElementById('profileRa').value,
        telefone: document.getElementById('profileTelefone').value
      }).then(function (data) {
        if (data.error === 'session_expired' || data.error === 'invalid_token') {
          status.textContent = t('Sessão expirada — saia e entre novamente.', 'Session expired — sign out and sign in again.');
          status.style.color = 'var(--red)';
          return;
        }
        if (data.error || !data.found) {
          status.textContent = t('Não foi possível salvar. Tente novamente.', 'Could not save. Please try again.');
          status.style.color = 'var(--red)';
          return;
        }
        sessionStorage.setItem('pels-member', JSON.stringify(data));
        renderFound(data);
        status.textContent = t('Dados salvos!', 'Profile saved!');
        status.style.color = 'var(--red)';
        setTimeout(function () { status.textContent = ''; }, 3000);
      }).catch(function () {
        status.textContent = t('Erro de conexão. Tente novamente.', 'Connection error. Please try again.');
        status.style.color = 'var(--red)';
      });
    });
  }

  function setupAvisoForm() {
    var form = document.getElementById('avisoForm');
    var status = document.getElementById('avisoStatus');

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var titulo = document.getElementById('avisoTitulo').value.trim();
      var texto = document.getElementById('avisoTexto').value.trim();
      if (!titulo) return;

      status.textContent = '...';
      status.style.color = 'var(--ink-soft)';

      callBackend({ action: 'addAviso', titulo: titulo, texto: texto }).then(function (data) {
        if (data.error === 'session_expired' || data.error === 'invalid_token') {
          status.textContent = t('Sessão expirada — saia e entre novamente.', 'Session expired — sign out and sign in again.');
          status.style.color = 'var(--red)';
          return;
        }
        if (data.error === 'not_allowed') {
          status.textContent = t('Só a diretoria pode publicar avisos.', 'Only the board can post announcements.');
          status.style.color = 'var(--red)';
          return;
        }
        if (data.error || !data.found) {
          status.textContent = t('Não foi possível publicar. Tente novamente.', 'Could not post. Please try again.');
          status.style.color = 'var(--red)';
          return;
        }
        sessionStorage.setItem('pels-member', JSON.stringify(data));
        renderAvisos(data.avisos || []);
        document.getElementById('avisoTitulo').value = '';
        document.getElementById('avisoTexto').value = '';
        status.textContent = t('Aviso publicado!', 'Announcement posted!');
        status.style.color = 'var(--red)';
        setTimeout(function () { status.textContent = ''; }, 3000);
      }).catch(function () {
        status.textContent = t('Erro de conexão. Tente novamente.', 'Connection error. Please try again.');
        status.style.color = 'var(--red)';
      });
    });
  }

  function setupDownloadCard() {
    var button = document.getElementById('downloadCard');
    if (!button) return;

    button.addEventListener('click', function () {
      var nome = document.getElementById('memberName').textContent;
      var cargo = document.getElementById('memberRole').textContent;
      var curso = document.getElementById('memberCurso').textContent;
      var desde = document.getElementById('memberDesde').textContent;
      var fotoUrl = document.getElementById('memberPhoto').src;

      var canvas = document.createElement('canvas');
      canvas.width = 900;
      canvas.height = 520;
      var ctx = canvas.getContext('2d');

      function drawCardBody(photoImg) {
        var grad = ctx.createLinearGradient(0, 0, 900, 520);
        grad.addColorStop(0, '#6e0919');
        grad.addColorStop(1, '#4a0611');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 900, 520);

        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(0, 0, 900, 70);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 26px Poppins, Inter, sans-serif';
        ctx.fillText('Carteirinha de Membro — IEEE PELS UFMS', 32, 45);

        if (photoImg) {
          ctx.save();
          var pX = 32, pY = 110, pSize = 220, radius = 18;
          ctx.beginPath();
          ctx.moveTo(pX + radius, pY);
          ctx.arcTo(pX + pSize, pY, pX + pSize, pY + pSize, radius);
          ctx.arcTo(pX + pSize, pY + pSize, pX, pY + pSize, radius);
          ctx.arcTo(pX, pY + pSize, pX, pY, radius);
          ctx.arcTo(pX, pY, pX + pSize, pY, radius);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(photoImg, pX, pY, pSize, pSize);
          ctx.restore();
        }

        var fieldsX = 300;
        var fields = [
          ['NOME', nome],
          ['CARGO', cargo],
          ['CURSO', curso],
          ['MEMBRO DESDE', desde]
        ];
        var fy = 140;
        fields.forEach(function (f) {
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.font = 'bold 13px Inter, sans-serif';
          ctx.fillText(f[0], fieldsX, fy);
          ctx.fillStyle = '#fff';
          ctx.font = '600 24px Inter, sans-serif';
          ctx.fillText(f[1], fieldsX, fy + 30);
          fy += 78;
        });

        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(0, 460, 900, 60);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(32, 475, 70, 30, 15) : ctx.rect(32, 475, 70, 30);
        ctx.fill();
        ctx.fillStyle = '#4a0611';
        ctx.font = 'bold 15px Inter, sans-serif';
        ctx.fillText('2026', 48, 495);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 15px Inter, sans-serif';
        ctx.fillText('IEEE PELS UFMS Chapter', 780 - ctx.measureText('IEEE PELS UFMS Chapter').width + 32, 495);

        try {
          var link = document.createElement('a');
          link.download = 'carteirinha-pels-ufms.png';
          link.href = canvas.toDataURL('image/png');
          link.click();
        } catch (err) {
          // Foto do Google bloqueou o canvas por CORS: gera de novo sem a foto.
          if (photoImg) drawCardBody(null);
        }
      }

      if (fotoUrl) {
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () { drawCardBody(img); };
        img.onerror = function () { drawCardBody(null); };
        img.src = fotoUrl;
      } else {
        drawCardBody(null);
      }
    });
  }

  function signOut() {
    sessionStorage.removeItem('pels-member');
    lastCredential = null;
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
    showOnly(elLoggedOut);
  }

  document.getElementById('memberSignOut').addEventListener('click', signOut);
  document.getElementById('memberSignOutNotFound').addEventListener('click', signOut);
  setupPlaceholders();
  setupXploreSearch();
  setupProfileForm();
  setupAvisoForm();
  setupAvisoActions();
  setupDownloadCard();

  window.addEventListener('load', function () {
    // Se já verificamos essa pessoa nesta aba, evita pedir login de novo —
    // mas o token do login anterior não vem junto (só fica em memória, não
    // é salvo), então tentamos renovar ele sozinho em segundo plano logo
    // abaixo. Sem essa renovação, ações que gravam dados (salvar perfil,
    // publicar aviso) pediriam pra sair e entrar de novo toda vez que a
    // página fosse recarregada.
    var mostrandoCache = false;
    var cached = sessionStorage.getItem('pels-member');
    if (cached) {
      try {
        renderFound(JSON.parse(cached));
        mostrandoCache = true;
      } catch (e) {
        sessionStorage.removeItem('pels-member');
      }
    }

    if (!window.google || !google.accounts || !google.accounts.id) {
      if (!mostrandoCache) showError('Não foi possível carregar o login do Google. Verifique sua conexão e recarregue a página.');
      return;
    }

    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.indexOf('CLIENT_ID_AQUI') !== -1) {
      if (!mostrandoCache) showError('Configuração pendente: a Área do Membro ainda não foi finalizada. Fale com a Diretoria.');
      return;
    }

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: true
    });

    if (mostrandoCache) {
      // Tenta obter um token novo silenciosamente (sem interromper quem já
      // está vendo o painel). Se não conseguir, só vai pedir login de novo
      // quando a pessoa tentar salvar algo.
      try { google.accounts.id.prompt(); } catch (e) {}
    } else {
      google.accounts.id.renderButton(
        document.getElementById('googleSignInButton'),
        { theme: 'outline', size: 'large', text: 'signin_with', locale: 'pt-BR' }
      );
    }
  });
})();
