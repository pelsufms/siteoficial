// Canal anônimo da Ouvidoria — envia direto para o Apps Script, sem login,
// sem e-mail, sem nome. Mesma URL do backend da Área do Membro.
var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby_PFJdHZWq77_cmMUO34QOCciGgpZ65YxnuijNvtWz5YfxFhFg9BlmW-IPCZxWvDU7fQ/exec';

(function () {
  function t(pt, en) {
    return document.documentElement.getAttribute('lang') === 'en' ? en : pt;
  }

  var form = document.getElementById('ouvidoriaForm');
  if (!form) return;

  var textarea = document.getElementById('ouvidoriaMensagem');
  var status = document.getElementById('ouvidoriaStatus');
  var button = form.querySelector('button[type="submit"]');

  function updatePlaceholder() {
    textarea.placeholder = t(textarea.dataset.placeholderPt, textarea.dataset.placeholderEn);
  }
  updatePlaceholder();
  window.addEventListener('pelslangchange', updatePlaceholder);

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var mensagem = textarea.value.trim();
    if (!mensagem) return;

    button.disabled = true;
    status.textContent = t('Enviando...', 'Sending...');
    status.style.color = 'var(--ink-soft)';

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      // Content-Type text/plain evita o preflight OPTIONS, que o Apps Script não trata.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'sendOuvidoria', mensagem: mensagem })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        button.disabled = false;
        if (data && data.success) {
          form.style.display = 'none';
          status.textContent = t(
            'Denúncia enviada. Obrigado por confiar nesse canal — ela será lida pela diretoria e pelo tutor do capítulo.',
            'Report sent. Thank you for trusting this channel — it will be read by the board and the chapter advisor.'
          );
          status.style.color = 'var(--red)';
        } else {
          status.textContent = t('Não foi possível enviar. Tente novamente em instantes.', 'Could not send. Please try again in a moment.');
          status.style.color = 'var(--red)';
        }
      })
      .catch(function () {
        button.disabled = false;
        status.textContent = t('Erro de conexão. Tente novamente em instantes.', 'Connection error. Please try again in a moment.');
        status.style.color = 'var(--red)';
      });
  });
})();
