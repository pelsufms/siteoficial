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
 *    publiquem avisos no mural, lidos por todo mundo que logar.
 *
 * Estrutura de colunas esperada na planilha (aba principal, primeira linha
 * é cabeçalho):
 *   A: Nome | B: Email | C: Cargo | D: Curso | E: RA | F: Telefone | G: Data de Ingresso
 * As colunas D a G podem ficar em branco — o site trata isso normalmente.
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
 * A aba "Avisos" (Data | Titulo | Texto) é criada automaticamente na primeira
 * vez que um diretor publica um aviso pelo site. Não precisa criar na mão.
 */

// ATENÇÃO: troque pelo Client ID real depois de criá-lo no Google Cloud Console.
var GOOGLE_CLIENT_ID = '1061281219061-hdhk000q0j4mjfegohcc3rpep5jec4e4.apps.googleusercontent.com';

// ID da planilha "Membros e Cargos PELS 2026 (PRIVADO)" — já preenchido.
var SHEET_ID = '1UMan9l-7FcVvq6pIrcPTvazZBqUgXWH-er6PaEbEPZQ';

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

// Acha a linha (1-indexada, incluindo cabeçalho) do e-mail na planilha
// principal. Devolve -1 se não achar.
function acharLinhaPorEmail(dados, email) {
  for (var i = 1; i < dados.length; i++) {
    var rowEmail = String(dados[i][1] || '').toLowerCase().trim();
    if (rowEmail && rowEmail === email) return i; // índice 0-based do array `dados`
  }
  return -1;
}

function montarPerfil(linha, fotoGoogle) {
  var cargo = String(linha[2] || '').trim();
  return {
    found: true,
    nome: linha[0],
    cargo: cargo,
    curso: linha[3] || '',
    ra: linha[4] || '',
    telefone: linha[5] || '',
    dataIngresso: linha[6] || '',
    fotoGoogle: fotoGoogle,
    isDiretoria: cargo !== '' && cargo !== 'Membro',
    avisos: getAvisos()
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
// token verificado). Nome, Curso, RA e Telefone são editáveis; Cargo,
// E-mail e Data de Ingresso continuam controlados pela diretoria.
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

  sheet.getRange(linhaPlanilha, 1).setValue(nome);
  sheet.getRange(linhaPlanilha, 4).setValue(curso);
  sheet.getRange(linhaPlanilha, 5).setValue(ra);
  sheet.getRange(linhaPlanilha, 6).setValue(telefone);

  var dadosAtualizados = sheet.getDataRange().getValues();
  return montarPerfil(dadosAtualizados[idx], auth.fotoGoogle);
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
    abaAvisos.appendRow(['Data', 'Titulo', 'Texto']);
  }
  abaAvisos.appendRow([new Date(), titulo, texto]);

  return montarPerfil(dados[idx], auth.fotoGoogle);
}

// Lê a aba "Avisos" (Data | Titulo | Texto), se ela existir. Não quebra o
// login caso a aba ainda não tenha sido criada.
function getAvisos() {
  try {
    var abaAvisos = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Avisos');
    if (!abaAvisos) return [];

    var linhas = abaAvisos.getDataRange().getValues(); // [ [Data, Titulo, Texto], ... ]
    var avisos = [];
    for (var i = 1; i < linhas.length; i++) {
      var titulo = String(linhas[i][1] || '').trim();
      if (!titulo) continue;
      var dataAviso = linhas[i][0];
      avisos.push({
        data: dataAviso instanceof Date ? Utilities.formatDate(dataAviso, 'GMT-4', 'dd/MM/yyyy') : String(dataAviso || ''),
        titulo: titulo,
        texto: String(linhas[i][2] || '')
      });
    }
    // Mais recentes primeiro.
    return avisos.reverse();
  } catch (err) {
    return [];
  }
}
