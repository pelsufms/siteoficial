// Página "Editais": marca cada edital como Em breve / Em andamento / Encerrado
// conforme as datas data-from e data-to do cartão (fuso de Campo Grande/MS).
(function () {
  function hojeEmCampoGrande() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande' }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  var hoje = hojeEmCampoGrande();

  Array.prototype.forEach.call(document.querySelectorAll('.ed-card'), function (card) {
    var de = card.getAttribute('data-from');
    var ate = card.getAttribute('data-to');
    var estado, pt, en;
    if (hoje < de) { estado = 'soon'; pt = 'Em breve'; en = 'Coming up'; }
    else if (hoje <= ate) { estado = 'live'; pt = 'Em andamento'; en = 'In progress'; }
    else { estado = 'done'; pt = 'Encerrado'; en = 'Closed'; }

    card.classList.add('is-' + estado);
    var status = card.querySelector('[data-ed-status]');
    status.classList.add('is-' + estado);
    status.querySelector('[data-ed-pt]').textContent = pt;
    status.querySelector('[data-ed-en]').textContent = en;
  });
})();
