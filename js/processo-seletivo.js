// Página do Processo Seletivo 2026.2 (Edital nº 02/2026).
// Mostra o estado das inscrições conforme a data (fuso de Campo Grande/MS) e
// marca no cronograma o que já passou e o que está acontecendo agora.
(function () {
  // Cole aqui o link do formulário de inscrição quando for divulgado.
  // Enquanto estiver vazio, a página manda o candidato para os canais oficiais.
  var FORM_URL = '';

  var INSCRICAO_ABRE = '2026-10-09';
  var INSCRICAO_FECHA = '2026-10-16'; // vale até 23h59 desse dia

  function hojeEmCampoGrande() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande' }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  var hoje = hojeEmCampoGrande();
  var fase = hoje < INSCRICAO_ABRE ? 'antes' : hoje <= INSCRICAO_FECHA ? 'aberta' : 'encerrada';

  Array.prototype.forEach.call(document.querySelectorAll('[data-ps-fase]'), function (el) {
    el.style.display = el.getAttribute('data-ps-fase') === fase ? '' : 'none';
  });

  var link = document.getElementById('psFormLink');
  var temLink = /^https:\/\//i.test(FORM_URL);
  if (link && temLink) {
    link.href = FORM_URL;
    link.style.display = '';
  }
  ['psSemLink', 'psSemLinkEn'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el && temLink) el.style.display = 'none';
  });

  Array.prototype.forEach.call(document.querySelectorAll('#psSchedule li'), function (li) {
    var de = li.getAttribute('data-from');
    var ate = li.getAttribute('data-to');
    if (ate < hoje) li.classList.add('is-done');
    else if (de <= hoje) li.classList.add('is-now');
  });
})();
