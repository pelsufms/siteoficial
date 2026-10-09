// Página da Eleição da Diretoria 2027 (Edital nº 01/2026).
// Mostra a fase atual da eleição conforme a data (fuso de Campo Grande/MS) e
// marca no cronograma o que já passou e o que está acontecendo agora.
(function () {
  // Cole aqui o link do Formulário de Candidatura quando for divulgado.
  // Enquanto estiver vazio, a página manda o candidato para os canais oficiais.
  var FORM_URL = '';

  function hojeEmCampoGrande() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande' }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  var hoje = hojeEmCampoGrande();
  var fase;
  if (hoje < '2026-10-09') fase = 'antes';
  else if (hoje <= '2026-10-16') fase = 'candidaturas';
  else if (hoje <= '2026-10-22') fase = 'analise';
  else if (hoje <= '2026-10-26') fase = 'votacao';
  else if (hoje <= '2026-10-30') fase = 'resultado';
  else if (hoje < '2027-01-04') fase = 'transicao';
  else fase = 'concluida';

  Array.prototype.forEach.call(document.querySelectorAll('[data-el-fase]'), function (el) {
    el.style.display = el.getAttribute('data-el-fase') === fase ? '' : 'none';
  });

  var link = document.getElementById('elFormLink');
  var temLink = /^https:\/\//i.test(FORM_URL);
  if (link && temLink) {
    link.href = FORM_URL;
    link.style.display = '';
  }
  ['elSemLink', 'elSemLinkEn'].forEach(function (id) {
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
