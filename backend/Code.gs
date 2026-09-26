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
var FOTOS_FOLDER_ID = '1TAw8sZDkuhF_N7tqA9Ykt5NfQlzfllX7';

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
    avisos: getAvisos(nome)
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
  arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

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
