/**
 * PELS UFMS — Backend da Área do Membro
 *
 * O que este script faz:
 * 1. Recebe o token de login do Google enviado pelo site.
 * 2. Confirma com o próprio Google que o token é válido (não confia em nada
 *    que vem do navegador sem checar).
 * 3. Procura o e-mail confirmado na planilha "Membros e Cargos PELS 2026 (PRIVADO)".
 * 4. Devolve para o site SÓ o nome e o cargo daquela pessoa — nunca a lista inteira.
 *
 * Como publicar (uma única vez):
 * 1. Acesse https://script.google.com/ logado como pelsufms@gmail.com
 * 2. Novo projeto → apague o conteúdo padrão → cole este arquivo inteiro
 * 3. Troque CLIENT_ID_AQUI abaixo pelo Client ID do Google (ver instruções
 *    que o Claude te passou para criar em Google Cloud Console)
 * 4. Implantar → Nova implantação → tipo "App da Web"
 *      - Executar como: Eu (pelsufms@gmail.com)
 *      - Quem pode acessar: Qualquer pessoa
 * 5. Autorize o script quando pedir (é a sua própria conta pedindo permissão
 *    pra ler a própria planilha — normal e esperado)
 * 6. Copie a URL do App da Web gerada e cole no site (js/area-membro.js)
 */

// ATENÇÃO: troque pelo Client ID real depois de criá-lo no Google Cloud Console.
var GOOGLE_CLIENT_ID = '1061281219061-hdhk000q0j4mjfegohcc3rpep5jec4e4.apps.googleusercontent.com';

// ID da planilha "Membros e Cargos PELS 2026 (PRIVADO)" — já preenchido.
var SHEET_ID = '1UMan9l-7FcVvq6pIrcPTvazZBqUgXWH-er6PaEbEPZQ';

function doPost(e) {
  var result;
  try {
    result = handleLogin(e);
  } catch (err) {
    result = { error: 'server_error', message: String(err) };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleLogin(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return { error: 'missing_body' };
  }

  var body = JSON.parse(e.postData.contents);
  var idToken = body.credential;
  if (!idToken) {
    return { error: 'missing_credential' };
  }

  // Pergunta pro próprio Google se esse token é legítimo e o que ele contém.
  var verifyUrl = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  var response = UrlFetchApp.fetch(verifyUrl, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    return { error: 'invalid_token' };
  }

  var tokenInfo = JSON.parse(response.getContentText());

  // Confere que o token foi emitido para O NOSSO site, não para outro app.
  if (tokenInfo.aud !== GOOGLE_CLIENT_ID) {
    return { error: 'wrong_audience' };
  }

  if (tokenInfo.email_verified !== 'true' && tokenInfo.email_verified !== true) {
    return { error: 'email_not_verified' };
  }

  var email = String(tokenInfo.email || '').toLowerCase().trim();
  var nomeGoogle = tokenInfo.name || '';
  var fotoGoogle = tokenInfo.picture || '';

  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  var data = sheet.getDataRange().getValues(); // [ [Nome, Email, Cargo], ... ]

  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][1] || '').toLowerCase().trim();
    if (rowEmail && rowEmail === email) {
      return {
        found: true,
        nome: data[i][0],
        cargo: data[i][2],
        fotoGoogle: fotoGoogle
      };
    }
  }

  return { found: false, nomeGoogle: nomeGoogle };
}
