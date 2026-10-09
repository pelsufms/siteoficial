/**
 * PELS UFMS — Backend da Área do Membro
 *
 * O que este script faz:
 * 1. Recebe o token de login do Google enviado pelo site e confirma com o
 *    próprio Google que ele é legítimo (nunca confia em nada vindo do
 *    navegador sem checar).
 * 2. Procura o e-mail confirmado na planilha "Membros e Cargos PELS 2026
 *    (PRIVADO)" e devolve para o site SÓ os dados daquela pessoa — nunca a
 *    lista inteira.
 * 3. Permite que o próprio membro atualize Nome, Curso, RA e Telefone.
 * 4. Permite que membros da diretoria (qualquer Cargo diferente de "Membro")
 *    publiquem, editem e removam avisos no mural — cada um só mexe nos
 *    próprios avisos.
 *
 * Estrutura de colunas esperada na planilha (aba principal, primeira linha
 * é cabeçalho):
 *   A: Nome | B: Email | C: Cargo | D: Curso | E: RA | F: Telefone
 *   G: Data de Ingresso | H: FotoURL | I: Numero IEEE
 * As colunas D a I podem ficar em branco — o site trata isso normalmente.
 * A coluna H (FotoURL) é preenchida sozinha pelo próprio script quando o
 * membro envia uma foto pela Área do Membro — não precisa mexer nela na mão.
 *
 * Como publicar (uma única vez):
 * 1. Acesse https://script.google.com/ logado como pelsufms@gmail.com
 * 2. Novo projeto → apague o conteúdo padrão → cole este arquivo inteiro
 * 3. Troque CLIENT_ID_AQUI abaixo pelo Client ID do Google (Google Cloud Console)
 * 4. Implantar → Nova implantação → tipo "App da Web"
 *      - Executar como: Eu (pelsufms@gmail.com)
 *      - Quem pode acessar: Qualquer pessoa
 * 5. Autorize o script quando pedir (é a sua própria conta pedindo permissão
 *    pra ler/editar a própria planilha — normal e esperado)
 * 6. Copie a URL do App da Web gerada e cole no site (js/area-membro.js)
 *
 * Toda vez que editar este arquivo, é preciso reimplantar (Implantar >
 * Gerenciar implantações > editar > Nova versão) para o site passar a usar
 * a versão nova — a URL continua a mesma.
 *
 * Mural de avisos:
 * A aba "Avisos" (ID | Data | Titulo | Texto | Autor) é criada
 * automaticamente na primeira vez que um diretor publica um aviso pelo
 * site. Se você já tinha uma aba "Avisos" de uma versão anterior deste
 * script (só com Data | Titulo | Texto), apague essa aba uma vez — ela é
 * recriada sozinha no formato novo.
 *
 * Lembretes da página inicial ("Agora e em breve"):
 * A diretoria cadastra pela Área do Membro; ficam na aba "Lembretes" (criada
 * sozinha) e a página inicial lê pela rota pública GET ...?action=lembretes.
 * Quem decide o que vai ao ar é o webmaster (e o chair): ver
 * CARGOS_PUBLICADORES. Os demais criam rascunhos.
 * As artes (horizontais, 1600x512) vão para a pasta POSTERS_FOLDER_ID com
 * link público, pois aparecem na página aberta ao público.
 *
 * Foto de perfil:
 * Quando o membro envia uma foto pela Área do Membro, ela é salva na pasta
 * "Fotos de Perfil - Área do Membro" (FOTOS_FOLDER_ID) com permissão
 * "qualquer pessoa com o link pode ver" — necessário pra imagem aparecer
 * no <img> do site. O link em si não é divulgado em nenhum lugar público,
 * só fica guardado na planilha privada.
 *
 * Ouvidoria:
 * Canal anônimo (sem login) que grava as denúncias na planilha separada
 * "Ouvidoria PELS 2026 (CONFIDENCIAL)" (OUVIDORIA_SHEET_ID abaixo). Essa
 * planilha só é compartilhada com pelsufms@gmail.com — se quiser que o
 * tutor/orientador também leia diretamente (sem depender da conta
 * institucional), compartilhe essa planilha específica com o e-mail
 * pessoal dele.
 */

// ATENÇÃO: troque pelo Client ID real depois de criá-lo no Google Cloud Console.
var GOOGLE_CLIENT_ID = '1061281219061-hdhk000q0j4mjfegohcc3rpep5jec4e4.apps.googleusercontent.com';

// ID da planilha "Membros e Cargos PELS 2026 (PRIVADO)" — já preenchido.
var SHEET_ID = '1UMan9l-7FcVvq6pIrcPTvazZBqUgXWH-er6PaEbEPZQ';

// ID da planilha "Ouvidoria PELS 2026 (CONFIDENCIAL)" — separada da planilha
// de membros de propósito, e sem nenhum compartilhamento além do dono
// (pelsufms@gmail.com). Só recebe as denúncias, sem nenhum dado de quem
// enviou (nem e-mail, nem IP, nem nome).
var OUVIDORIA_SHEET_ID = '11iTOu-cJ6JgPQ9ujdDuNyNY8LiJGn-lIUpJqTELPL9Y';

// ID da pasta "Fotos de Perfil - Área do Membro" no Drive, onde as fotos
// enviadas pelos próprios membros são guardadas.
var FOTOS_FOLDER_ID = '1aCFUhwcVA-gLYIQCPam5TjMsoUEvX6Ch';

// ID da pasta "Lembretes - Posters (página inicial)", onde ficam as artes
// dos lembretes publicados pela diretoria (ficam com link público para a
// página inicial conseguir exibi-las).
var POSTERS_FOLDER_ID = '1fuy7xewEwxyCCvH1-TWL3LrzHl8DILBo';

var LEMBRETES_HEADERS = ['ID', 'Titulo', 'TituloEN', 'Selo', 'SeloEN', 'Link', 'PosterURL', 'Destaque', 'Validade', 'Publicado', 'Inicio'];

// Cargos (como estão na coluna "Cargo" da planilha) que decidem quais
// lembretes/eventos aparecem na página inicial. Os demais da diretoria
// cadastram e editam, mas o item só vai ao ar quando um desses libera.
var CARGOS_PUBLICADORES = ['Webmaster', 'Chair'];

function podePublicar(cargo) {
  var c = String(cargo || '').trim().toLowerCase();
  return CARGOS_PUBLICADORES.some(function (p) { return p.toLowerCase() === c; });
}

// Leitura PÚBLICA (sem login) usada pela página inicial do site:
//   .../exec?action=lembretes
//     -> { configurado: bool, lembretes: [...] }
// "lembretes" traz só os liberados e não vencidos. "configurado" é false
// quando ainda não existe nenhum lembrete cadastrado (aí o site mostra a
// lista padrão); se existir ao menos um, o site mostra só os liberados
// (inclusive nenhum, escondendo o letreiro).
function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  var result = { error: 'unknown_action' };
  try {
    if (action === 'lembretes') {
      var todos = lerLembretes();
      result = {
        configurado: todos.length > 0,
        lembretes: todos.filter(function (l) { return l.publicado && !l.expirado && !l.agendado; })
      };
    }
  } catch (err) {
    result = { error: 'server_error' };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var result;
  try {
    if (!e || !e.postData || !e.postData.contents) {
      result = { error: 'missing_body' };
    } else {
      var body = JSON.parse(e.postData.contents);
      var action = body.action || 'login';

      if (action === 'login') result = handleLogin(body);
      else if (action === 'updateProfile') result = handleUpdateProfile(body);
      else if (action === 'addAviso') result = handleAddAviso(body);
      else if (action === 'updateAviso') result = handleUpdateAviso(body);
      else if (action === 'deleteAviso') result = handleDeleteAviso(body);
      else if (action === 'sendOuvidoria') result = handleSendOuvidoria(body);
      else if (action === 'addLembrete') result = handleSaveLembrete(body, false);
      else if (action === 'updateLembrete') result = handleSaveLembrete(body, true);
      else if (action === 'deleteLembrete') result = handleDeleteLembrete(body);
      else if (action === 'setLembretePublicado') result = handleSetLembretePublicado(body);
      else if (action === 'seedLembretes') result = handleSeedLembretes(body);
      else if (action === 'seedProcessoSeletivo') result = handleSeedProcessoSeletivo(body);
      else result = { error: 'unknown_action' };
    }
  } catch (err) {
    result = { error: 'server_error', message: String(err) };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// Confere o token de login do Google e devolve os dados confirmados, ou
// null se o token for inválido/de outro app.
function verifyToken(idToken) {
  if (!idToken) return null;

  var verifyUrl = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  var response = UrlFetchApp.fetch(verifyUrl, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) return null;

  var tokenInfo = JSON.parse(response.getContentText());

  if (tokenInfo.aud !== GOOGLE_CLIENT_ID) return null;
  if (tokenInfo.email_verified !== 'true' && tokenInfo.email_verified !== true) return null;

  return {
    email: String(tokenInfo.email || '').toLowerCase().trim(),
    nomeGoogle: tokenInfo.name || '',
    fotoGoogle: tokenInfo.picture || ''
  };
}

// Acha a linha (0-indexada no array `dados`) do e-mail na planilha
// principal. Devolve -1 se não achar.
function acharLinhaPorEmail(dados, email) {
  for (var i = 1; i < dados.length; i++) {
    var rowEmail = String(dados[i][1] || '').toLowerCase().trim();
    if (rowEmail && rowEmail === email) return i;
  }
  return -1;
}

function montarPerfil(linha, fotoGoogle) {
  var cargo = String(linha[2] || '').trim();
  var nome = linha[0];
  return {
    found: true,
    nome: nome,
    cargo: cargo,
    curso: linha[3] || '',
    ra: linha[4] || '',
    telefone: linha[5] || '',
    dataIngresso: linha[6] || '',
    fotoUrl: linha[7] || '',
    numeroIeee: linha[8] || '',
    fotoGoogle: fotoGoogle,
    isDiretoria: cargo !== '' && cargo !== 'Membro',
    podePublicar: podePublicar(cargo),
    avisos: getAvisos(nome),
    lembretes: (cargo !== '' && cargo !== 'Membro') ? lerLembretes() : []
  };
}

function handleLogin(body) {
  var auth = verifyToken(body.credential);
  if (!auth) return { error: 'invalid_token' };

  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  var dados = sheet.getDataRange().getValues();
  var idx = acharLinhaPorEmail(dados, auth.email);

  if (idx === -1) return { found: false, nomeGoogle: auth.nomeGoogle };
  return montarPerfil(dados[idx], auth.fotoGoogle);
}

// O membro só pode editar os PRÓPRIOS dados (identificado pelo e-mail do
// token verificado). Cargo e e-mail continuam controlados pela diretoria;
// todo o resto (nome, curso, RA, telefone, data de ingresso, foto, número
// IEEE) o próprio membro pode preencher.
function handleUpdateProfile(body) {
  var auth = verifyToken(body.credential);
  if (!auth) return { error: 'invalid_token' };

  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  var dados = sheet.getDataRange().getValues();
  var idx = acharLinhaPorEmail(dados, auth.email);
  if (idx === -1) return { found: false, nomeGoogle: auth.nomeGoogle };

  var linhaPlanilha = idx + 1; // getRange é 1-indexado
  var nome = String(body.nome || '').trim() || dados[idx][0];
  var curso = String(body.curso || '').trim();
  var ra = String(body.ra || '').trim();
  var telefone = String(body.telefone || '').trim();
  var dataIngresso = String(body.dataIngresso || '').trim();
  var numeroIeee = String(body.numeroIeee || '').trim();

  sheet.getRange(linhaPlanilha, 1).setValue(nome);
  sheet.getRange(linhaPlanilha, 4).setValue(curso);
  sheet.getRange(linhaPlanilha, 5).setValue(ra);
  sheet.getRange(linhaPlanilha, 6).setValue(telefone);
  sheet.getRange(linhaPlanilha, 7).setValue(dataIngresso);
  sheet.getRange(linhaPlanilha, 9).setValue(numeroIeee);

  if (body.fotoBase64 && body.fotoMimeType) {
    var novaFotoUrl = salvarFotoPerfil(body.fotoBase64, body.fotoMimeType, dados[idx][7]);
    sheet.getRange(linhaPlanilha, 8).setValue(novaFotoUrl);
  }

  var dadosAtualizados = sheet.getDataRange().getValues();
  return montarPerfil(dadosAtualizados[idx], auth.fotoGoogle);
}

// Salva a foto enviada pelo membro na pasta "Fotos de Perfil - Área do
// Membro", apaga a foto antiga dessa mesma pessoa (se houver) para não
// acumular arquivo órfão, e devolve a URL pronta para exibir num <img>.
function salvarFotoPerfil(base64, mimeType, urlAntiga) {
  if (urlAntiga) {
    try {
      var match = String(urlAntiga).match(/id=([a-zA-Z0-9_-]+)/);
      if (match) DriveApp.getFileById(match[1]).setTrashed(true);
    } catch (err) {
      // Se não conseguir apagar a antiga, segue o baile — não é crítico.
    }
  }

  var bytes = Utilities.base64Decode(base64);
  var blob = Utilities.newBlob(bytes, mimeType, 'foto-perfil.jpg');
  var pasta = DriveApp.getFolderById(FOTOS_FOLDER_ID);
  var arquivo = pasta.createFile(blob);
  compartilharPublico(arquivo);

  return 'https://drive.google.com/uc?export=view&id=' + arquivo.getId();
}

// Só quem tem Cargo diferente de "Membro" (ou seja, diretoria/tutor) pode
// publicar avisos. Cria a aba "Avisos" automaticamente se ainda não existir.
function handleAddAviso(body) {
  var auth = verifyToken(body.credential);
  if (!auth) return { error: 'invalid_token' };

  var planilha = SpreadsheetApp.openById(SHEET_ID);
  var sheet = planilha.getSheets()[0];
  var dados = sheet.getDataRange().getValues();
  var idx = acharLinhaPorEmail(dados, auth.email);
  if (idx === -1) return { found: false, nomeGoogle: auth.nomeGoogle };

  var cargo = String(dados[idx][2] || '').trim();
  if (cargo === '' || cargo === 'Membro') return { error: 'not_allowed' };

  var titulo = String(body.titulo || '').trim();
  var texto = String(body.texto || '').trim();
  if (!titulo) return { error: 'missing_title' };

  var abaAvisos = planilha.getSheetByName('Avisos');
  if (!abaAvisos) {
    abaAvisos = planilha.insertSheet('Avisos');
    abaAvisos.appendRow(['ID', 'Data', 'Titulo', 'Texto', 'Autor']);
  }
  var novoId = String(new Date().getTime());
  abaAvisos.appendRow([novoId, new Date(), titulo, texto, dados[idx][0]]);

  return montarPerfil(dados[idx], auth.fotoGoogle);
}

// Acha a linha (1-indexada, pronta para getRange) de um aviso pelo ID.
// Devolve -1 se não achar.
function acharLinhaAvisoPorId(abaAvisos, id) {
  var linhas = abaAvisos.getDataRange().getValues();
  for (var i = 1; i < linhas.length; i++) {
    if (String(linhas[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

// Só quem publicou o aviso pode editá-lo (compara pelo Nome salvo na
// própria linha do aviso, não pelo e-mail, então funciona mesmo que o
// autor já tenha trocado de cargo).
function handleUpdateAviso(body) {
  var auth = verifyToken(body.credential);
  if (!auth) return { error: 'invalid_token' };

  var planilha = SpreadsheetApp.openById(SHEET_ID);
  var sheet = planilha.getSheets()[0];
  var dados = sheet.getDataRange().getValues();
  var idx = acharLinhaPorEmail(dados, auth.email);
  if (idx === -1) return { found: false, nomeGoogle: auth.nomeGoogle };

  var abaAvisos = planilha.getSheetByName('Avisos');
  if (!abaAvisos) return { error: 'not_found' };

  var linhaAviso = acharLinhaAvisoPorId(abaAvisos, body.id);
  if (linhaAviso === -1) return { error: 'not_found' };

  var autorAtual = String(abaAvisos.getRange(linhaAviso, 5).getValue());
  if (autorAtual !== String(dados[idx][0])) return { error: 'not_allowed' };

  var titulo = String(body.titulo || '').trim();
  var texto = String(body.texto || '').trim();
  if (!titulo) return { error: 'missing_title' };

  abaAvisos.getRange(linhaAviso, 3).setValue(titulo);
  abaAvisos.getRange(linhaAviso, 4).setValue(texto);

  return montarPerfil(dados[idx], auth.fotoGoogle);
}

function handleDeleteAviso(body) {
  var auth = verifyToken(body.credential);
  if (!auth) return { error: 'invalid_token' };

  var planilha = SpreadsheetApp.openById(SHEET_ID);
  var sheet = planilha.getSheets()[0];
  var dados = sheet.getDataRange().getValues();
  var idx = acharLinhaPorEmail(dados, auth.email);
  if (idx === -1) return { found: false, nomeGoogle: auth.nomeGoogle };

  var abaAvisos = planilha.getSheetByName('Avisos');
  if (!abaAvisos) return { error: 'not_found' };

  var linhaAviso = acharLinhaAvisoPorId(abaAvisos, body.id);
  if (linhaAviso === -1) return { error: 'not_found' };

  var autorAtual = String(abaAvisos.getRange(linhaAviso, 5).getValue());
  if (autorAtual !== String(dados[idx][0])) return { error: 'not_allowed' };

  abaAvisos.deleteRow(linhaAviso);

  return montarPerfil(dados[idx], auth.fotoGoogle);
}

// ---------- Lembretes da página inicial ("Agora e em breve") ----------

function abaLembretes(criar) {
  var planilha = SpreadsheetApp.openById(SHEET_ID);
  var aba = planilha.getSheetByName('Lembretes');
  if (!aba && criar) {
    aba = planilha.insertSheet('Lembretes');
    aba.appendRow(LEMBRETES_HEADERS);
  } else if (aba && !aba.getRange(1, 10).getValue()) {
    // Aba criada por uma versão anterior (sem a coluna "Publicado").
    aba.getRange(1, 10).setValue('Publicado');
  }
  if (aba && !aba.getRange(1, 11).getValue()) aba.getRange(1, 11).setValue('Inicio');
  return aba;
}

var _planilhaTz = null;
function planilhaTz() {
  if (!_planilhaTz) _planilhaTz = SpreadsheetApp.openById(SHEET_ID).getSpreadsheetTimeZone() || 'GMT-4';
  return _planilhaTz;
}

// A planilha converte "2026-10-08" em data; formata no fuso da própria
// planilha para não deslocar um dia.
function normalizarData(valor) {
  if (valor && typeof valor.getTime === 'function') {
    return Utilities.formatDate(valor, planilhaTz(), 'yyyy-MM-dd');
  }
  return String(valor || '').trim();
}

// Só aceita links http(s), páginas do próprio site (projetos/...) ou âncoras
// (#membros) — barra "javascript:" e similares, já que o link vai para um
// href na página pública.
function linkSeguro(link) {
  link = String(link || '').trim();
  if (/^https?:\/\//i.test(link) || /^projetos\/[\w.\-]+$/.test(link) || /^[\w\-]+\.html(#[\w\-]+)?$/.test(link) || /^#[\w\-]+$/.test(link)) return link;
  return '';
}

// Lê todos os lembretes (mais recentes primeiro), marcando os vencidos.
function lerLembretes() {
  var aba = abaLembretes(false);
  if (!aba) return [];

  var hoje = Utilities.formatDate(new Date(), 'GMT-4', 'yyyy-MM-dd');
  var linhas = aba.getDataRange().getValues();
  var lista = [];
  for (var i = 1; i < linhas.length; i++) {
    var titulo = String(linhas[i][1] || '').trim();
    if (!titulo) continue;
    var validade = normalizarData(linhas[i][8]);
    var inicio = normalizarData(linhas[i][10]);
    lista.push({
      id: String(linhas[i][0]),
      titulo: titulo,
      tituloEn: String(linhas[i][2] || '').trim(),
      selo: String(linhas[i][3] || '').trim(),
      seloEn: String(linhas[i][4] || '').trim(),
      link: linkSeguro(linhas[i][5]),
      posterUrl: String(linhas[i][6] || '').trim(),
      destaque: String(linhas[i][7] || '').trim().toUpperCase() === 'SIM',
      validade: validade,
      inicio: inicio,
      expirado: !!validade && validade < hoje,
      agendado: !!inicio && inicio > hoje,
      // Célula vazia (linhas antigas) conta como liberado.
      publicado: String(linhas[i][9] || '').trim().toUpperCase() !== 'NAO'
    });
  }
  return lista.reverse();
}

// Valida o login e confere que a pessoa é da diretoria (Cargo != "Membro").
// Devolve { auth, dados, idx } ou { erro: <resposta pronta para o site> }.
function autenticarDiretor(body) {
  var auth = verifyToken(body.credential);
  if (!auth) return { erro: { error: 'invalid_token' } };

  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  var dados = sheet.getDataRange().getValues();
  var idx = acharLinhaPorEmail(dados, auth.email);
  if (idx === -1) return { erro: { found: false, nomeGoogle: auth.nomeGoogle } };

  var cargo = String(dados[idx][2] || '').trim();
  if (cargo === '' || cargo === 'Membro') return { erro: { error: 'not_allowed' } };
  return { auth: auth, dados: dados, idx: idx, publica: podePublicar(cargo) };
}

// Como autenticarDiretor, mas só deixa passar quem decide o que vai ao ar.
function autenticarPublicador(body) {
  var ctx = autenticarDiretor(body);
  if (ctx.erro) return ctx;
  if (!ctx.publica) return { erro: { error: 'not_allowed' } };
  return ctx;
}

function acharLinhaLembretePorId(aba, id) {
  var linhas = aba.getDataRange().getValues();
  for (var i = 1; i < linhas.length; i++) {
    if (String(linhas[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

function idDoArquivoDrive(url) {
  var m = String(url || '').match(/(?:\/d\/|id=)([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

// Tenta liberar o arquivo para quem tem o link. Em Drives compartilhados isso
// pode ser bloqueado pelo Google; nesse caso o arquivo herda o acesso da pasta
// (deixe a pasta como Qualquer pessoa com o link: Leitor).
function compartilharPublico(arquivo) {
  try {
    arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {}
}

// Salva a arte na pasta de pôsteres; apaga a anterior (se houver). Devolve
// uma URL que o <img> da página inicial consegue carregar.
function salvarPoster(base64, mimeType, urlAntiga) {
  var idAntigo = idDoArquivoDrive(urlAntiga);
  if (idAntigo) {
    try { DriveApp.getFileById(idAntigo).setTrashed(true); } catch (err) {}
  }
  var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, 'poster.jpg');
  var arquivo = DriveApp.getFolderById(POSTERS_FOLDER_ID).createFile(blob);
  compartilharPublico(arquivo);
  return 'https://lh3.googleusercontent.com/d/' + arquivo.getId();
}

// Qualquer pessoa da diretoria cria/edita lembretes, mas o campo "Publicado"
// só muda quando quem salva é publicador (webmaster/chair): os demais criam
// sempre como rascunho e, ao editar, não mexem no status.
function handleSaveLembrete(body, editando) {
  var ctx = autenticarDiretor(body);
  if (ctx.erro) return ctx.erro;

  var titulo = String(body.titulo || '').trim();
  if (!titulo) return { error: 'missing_title' };

  var aba = abaLembretes(true);
  var linha = -1;
  var posterAtual = '';
  if (editando) {
    linha = acharLinhaLembretePorId(aba, body.id);
    if (linha === -1) return { error: 'not_found' };
    posterAtual = String(aba.getRange(linha, 7).getValue() || '');
  }

  var posterUrl = posterAtual;
  if (body.posterBase64 && body.posterMimeType) {
    try {
      posterUrl = salvarPoster(body.posterBase64, body.posterMimeType, posterAtual);
    } catch (err) {
      return { error: 'poster_failed', message: String(err) };
    }
  }

  var validade = String(body.validade || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validade)) validade = '';
  var inicio = String(body.inicio || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) inicio = '';
  if (inicio && validade && inicio > validade) return { error: 'invalid_dates' };

  var campos = [
    titulo.substring(0, 140),
    String(body.tituloEn || '').trim().substring(0, 140),
    String(body.selo || '').trim().substring(0, 40),
    String(body.seloEn || '').trim().substring(0, 40),
    linkSeguro(body.link)
  ];
  var destaque = body.destaque ? 'SIM' : 'NAO';

  if (editando) {
    aba.getRange(linha, 2, 1, 5).setValues([campos]);
    aba.getRange(linha, 7, 1, 3).setValues([[posterUrl, destaque, validade]]);
    aba.getRange(linha, 11).setValue(inicio);
    if (ctx.publica && typeof body.publicado === 'boolean') {
      aba.getRange(linha, 10).setValue(body.publicado ? 'SIM' : 'NAO');
    }
  } else {
    var id = String(new Date().getTime());
    var publicado = ctx.publica && body.publicado ? 'SIM' : 'NAO';
    aba.appendRow([id].concat(campos, [posterUrl, destaque, validade, publicado, inicio]));
  }

  return montarPerfil(ctx.dados[ctx.idx], ctx.auth.fotoGoogle);
}

// Liberar/ocultar um lembrete na página inicial (só publicadores).
function handleSetLembretePublicado(body) {
  var ctx = autenticarPublicador(body);
  if (ctx.erro) return ctx.erro;

  var aba = abaLembretes(false);
  if (!aba) return { error: 'not_found' };
  var linha = acharLinhaLembretePorId(aba, body.id);
  if (linha === -1) return { error: 'not_found' };

  aba.getRange(linha, 10).setValue(body.publicado ? 'SIM' : 'NAO');
  return montarPerfil(ctx.dados[ctx.idx], ctx.auth.fotoGoogle);
}

// Cadastra de uma vez os projetos/eventos padrão do site para o webmaster
// poder escolher quais mostrar. Pula os que já existem (pelo título).
var LEMBRETES_PADRAO = [
  { titulo: 'Circuito PELS: curso de eletrônica de potência', tituloEn: 'Circuito PELS: power electronics course', selo: 'Inscrições abertas', seloEn: 'Enrollment open', link: 'projetos/circuito-pels.html', destaque: true },
  { titulo: 'Iniciação Científica com membros PELS', tituloEn: 'Undergraduate Research with PELS members', selo: 'Em andamento', seloEn: 'In progress', link: 'projetos/iniciacao-cientifica.html' },
  { titulo: 'Power English: círculo de conversação em inglês', tituloEn: 'Power English: English conversation circle', selo: 'Recorrente', seloEn: 'Recurring', link: 'projetos/power-english.html' },
  { titulo: 'Paper Club: leitura e discussão de artigos', tituloEn: 'Paper Club: reading and discussing papers', selo: 'Recorrente', seloEn: 'Recurring', link: 'projetos/paper-club.html' },
  { titulo: 'SolIEEEdário: ações na Comunidade Mandela', tituloEn: 'SolIEEEdário: outreach in the Mandela Community', selo: 'Contínuo', seloEn: 'Ongoing', link: 'projetos/solieeedario.html' },
  { titulo: 'PELS Day', tituloEn: 'PELS Day', selo: 'Edição anual', seloEn: 'Annual edition', link: 'projetos/pels-day.html' },
  { titulo: 'Veja como se tornar membro do capítulo', tituloEn: 'See how to become a chapter member', selo: 'Participe', seloEn: 'Join us', link: '#membros' }
];

function handleSeedLembretes(body) {
  var ctx = autenticarPublicador(body);
  if (ctx.erro) return ctx.erro;

  var aba = abaLembretes(true);
  var existentes = {};
  lerLembretes().forEach(function (l) { existentes[l.titulo] = true; });

  var base = new Date().getTime();
  // De trás pra frente: a leitura mostra o mais recente primeiro.
  for (var i = LEMBRETES_PADRAO.length - 1; i >= 0; i--) {
    var p = LEMBRETES_PADRAO[i];
    if (existentes[p.titulo]) continue;
    aba.appendRow([String(base + i), p.titulo, p.tituloEn, p.selo, p.seloEn, linkSeguro(p.link), '', p.destaque ? 'SIM' : 'NAO', '', 'SIM']);
  }
  return montarPerfil(ctx.dados[ctx.idx], ctx.auth.fotoGoogle);
}

// Um lembrete por etapa do Processo Seletivo 2026.2 (Edital nº 02/2026) e um
// para as Eleições 2027 (Edital nº 01/2026), com o banner 1600x512 de cada
// um, hospedado no próprio site. Cada um só
// aparece na página inicial entre "inicio" e "validade" (inclusive).
var BASE_SITE = 'https://pelsufms.github.io/siteoficial/';
var LEMBRETES_PS = [
  { titulo: 'Eleições do Capítulo: candidaturas de 09 a 16/10 e votação online de 23 a 26/10', tituloEn: 'Chapter elections: candidacies Oct 9 to 16 and online voting Oct 23 to 26', selo: 'Eleição 2027', seloEn: '2027 Election', poster: 'eleicoes-2027.jpg', link: 'eleicoes.html', inicio: '2026-10-09', validade: '2026-10-26', destaque: true },
  { titulo: 'Processo Seletivo 2026.2: edital publicado', tituloEn: '2026.2 Selection Process: call published', selo: 'Edital nº 02/2026', seloEn: 'Call no. 02/2026', poster: 'ps-01-edital.jpg', inicio: '2026-10-07', validade: '2026-10-08' },
  { titulo: 'Inscrições abertas: 09 a 16/10, até 23h59', tituloEn: 'Enrollment open: Oct 9 to 16, until 11:59 pm', selo: 'Inscrições abertas', seloEn: 'Enrollment open', poster: 'ps-02-inscricoes.jpg', inicio: '2026-10-09', validade: '2026-10-16', destaque: true },
  { titulo: 'Lista de inscritos, ordem de apresentação e local da sessão', tituloEn: 'List of candidates, presentation order and session venue', selo: '18/10', seloEn: 'Oct 18', poster: 'ps-03-lista.jpg', inicio: '2026-10-17', validade: '2026-10-18' },
  { titulo: 'Sessão única de apresentação e entrevista, a partir das 13h30', tituloEn: 'Single presentation and interview session, from 1:30 pm', selo: '23/10', seloEn: 'Oct 23', poster: 'ps-04-sessao.jpg', inicio: '2026-10-19', validade: '2026-10-23', destaque: true },
  { titulo: 'Resultado preliminar do Processo Seletivo', tituloEn: 'Selection Process preliminary result', selo: '25/10', seloEn: 'Oct 25', poster: 'ps-05-preliminar.jpg', inicio: '2026-10-24', validade: '2026-10-25' },
  { titulo: 'Recurso até 23h59', tituloEn: 'Appeals until 11:59 pm', selo: '26/10', seloEn: 'Oct 26', poster: 'ps-06-recurso.jpg', inicio: '2026-10-26', validade: '2026-10-26' },
  { titulo: 'Resultado final do Processo Seletivo', tituloEn: 'Selection Process final result', selo: '28/10', seloEn: 'Oct 28', poster: 'ps-07-final.jpg', inicio: '2026-10-27', validade: '2026-10-28' },
  { titulo: 'Reunião de boas-vindas e início do apadrinhamento', tituloEn: 'Welcome meeting and start of the mentoring', selo: '30/10', seloEn: 'Oct 30', poster: 'ps-08-boas-vindas.jpg', inicio: '2026-10-29', validade: '2026-10-30' }
];

function handleSeedProcessoSeletivo(body) {
  var ctx = autenticarPublicador(body);
  if (ctx.erro) return ctx.erro;

  var aba = abaLembretes(true);
  var existentes = {};
  lerLembretes().forEach(function (l) { existentes[l.titulo] = true; });

  var base = new Date().getTime();
  // De trás pra frente: a leitura mostra o mais recente primeiro.
  for (var i = LEMBRETES_PS.length - 1; i >= 0; i--) {
    var p = LEMBRETES_PS[i];
    if (existentes[p.titulo]) continue;
    aba.appendRow([String(base + i), p.titulo, p.tituloEn, p.selo, p.seloEn, linkSeguro(p.link || 'processo-seletivo.html#cronograma'),
      BASE_SITE + 'assets/img/lembretes/' + p.poster, p.destaque ? 'SIM' : 'NAO', p.validade, 'SIM', p.inicio]);
  }
  return montarPerfil(ctx.dados[ctx.idx], ctx.auth.fotoGoogle);
}

// Qualquer da diretoria exclui rascunhos; itens que estão no ar só os
// publicadores excluem.
function handleDeleteLembrete(body) {
  var ctx = autenticarDiretor(body);
  if (ctx.erro) return ctx.erro;

  var aba = abaLembretes(false);
  if (!aba) return { error: 'not_found' };
  var linha = acharLinhaLembretePorId(aba, body.id);
  if (linha === -1) return { error: 'not_found' };

  var noAr = String(aba.getRange(linha, 10).getValue() || '').trim().toUpperCase() !== 'NAO';
  if (noAr && !ctx.publica) return { error: 'not_allowed' };

  var idPoster = idDoArquivoDrive(aba.getRange(linha, 7).getValue());
  if (idPoster) {
    try { DriveApp.getFileById(idPoster).setTrashed(true); } catch (err) {}
  }
  aba.deleteRow(linha);

  return montarPerfil(ctx.dados[ctx.idx], ctx.auth.fotoGoogle);
}

// Canal da Ouvidoria: DE PROPÓSITO não chama verifyToken nem pede
// credencial nenhuma — quem denuncia não precisa logar com o Google nem
// se identificar de forma alguma. Só grava a mensagem e a data/hora numa
// planilha separada (OUVIDORIA_SHEET_ID), que só pelsufms@gmail.com acessa.
function handleSendOuvidoria(body) {
  var mensagem = String(body.mensagem || '').trim();
  if (!mensagem) return { error: 'missing_message' };
  if (mensagem.length > 4000) mensagem = mensagem.substring(0, 4000);

  var planilha = SpreadsheetApp.openById(OUVIDORIA_SHEET_ID);
  var aba = planilha.getSheets()[0];
  if (aba.getLastRow() === 0) {
    aba.appendRow(['Data', 'Mensagem']);
  }
  aba.appendRow([new Date(), mensagem]);

  return { success: true };
}

// Lê a aba "Avisos" (ID | Data | Titulo | Texto | Autor), se ela existir.
// `nomeAtual` é o nome de quem está logado, só para marcar quais avisos
// essa pessoa pode editar/excluir (os que ela mesma publicou).
function getAvisos(nomeAtual) {
  try {
    var abaAvisos = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Avisos');
    if (!abaAvisos) return [];

    var linhas = abaAvisos.getDataRange().getValues();
    var avisos = [];
    for (var i = 1; i < linhas.length; i++) {
      var titulo = String(linhas[i][2] || '').trim();
      if (!titulo) continue;
      var dataAviso = linhas[i][1];
      var autor = String(linhas[i][4] || '');
      // Usa "duck typing" em vez de instanceof: valores vindos da planilha
      // às vezes não passam no instanceof Date mesmo sendo datas.
      var dataFormatada = (dataAviso && typeof dataAviso.getTime === 'function')
        ? Utilities.formatDate(dataAviso, 'GMT-4', 'dd/MM/yyyy')
        : String(dataAviso || '');

      avisos.push({
        id: String(linhas[i][0]),
        data: dataFormatada,
        titulo: titulo,
        texto: String(linhas[i][3] || ''),
        autor: autor,
        podeEditar: !!nomeAtual && autor === String(nomeAtual)
      });
    }
    // Mais recentes primeiro.
    return avisos.reverse();
  } catch (err) {
    return [];
  }
}

// Rode UMA vez no editor (menu de funções -> autorizarDrive -> Executar) para
// o Google pedir a permissão de acesso ao Drive, necessária para salvar
// pôsteres e fotos de perfil. Ela cria e apaga um arquivo de teste de
// propósito: só assim o Google pede a permissão de ESCRITA (ler a pasta não
// basta). Depois, publique uma Nova versão da implantação.
function autorizarDrive() {
  var pastas = [POSTERS_FOLDER_ID, FOTOS_FOLDER_ID];
  pastas.forEach(function (id) {
    var pasta = DriveApp.getFolderById(id);
    var teste = pasta.createFile('teste-autorizacao.txt', 'ok');
    teste.setTrashed(true);
    Logger.log('Escrita OK na pasta: ' + pasta.getName());
  });
  Logger.log('Drive autorizado (leitura e escrita).');
}