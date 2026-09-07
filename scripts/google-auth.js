#!/usr/bin/env node
/**
 * Obtem o GOOGLE_REFRESH_TOKEN da SUA conta Google (modo oauth).
 *
 * Antes de rodar, preencha no .env:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI
 * (o passo a passo esta em docs/GOOGLE-DRIVE.md)
 *
 *   npm run setup:google
 */
import http from 'node:http';
import { google } from 'googleapis';
import { config } from '../src/config.js';

const { clientId, clientSecret, redirectUri } = config.google;

if (!clientId || !clientSecret) {
  console.error('\nPreencha GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no arquivo .env antes de rodar.\n');
  process.exit(1);
}

const urlRedirecionamento = new URL(redirectUri);
const porta = Number(urlRedirecionamento.port || 3000);
const caminhoRetorno = urlRedirecionamento.pathname;

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const urlConsentimento = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive'],
});

console.log('\n' + '-'.repeat(70));
console.log('  Autorizacao do Google Drive');
console.log('-'.repeat(70));
console.log('\n1) Abra este endereco no navegador, logado na conta que vai guardar os certificados:\n');
console.log(urlConsentimento);
console.log(`\n2) Autorize o acesso. O navegador voltara para ${redirectUri}\n`);
console.log('Aguardando a autorizacao...\n');

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${porta}`);
  if (url.pathname !== caminhoRetorno) {
    res.writeHead(404).end('Rota nao usada por este assistente.');
    return;
  }
  const codigo = url.searchParams.get('code');
  const erro = url.searchParams.get('error');

  if (erro || !codigo) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
      .end(`<h1>Autorizacao cancelada</h1><p>${erro ?? 'Codigo ausente.'}</p>`);
    console.error(`\nAutorizacao nao concluida: ${erro ?? 'codigo ausente'}\n`);
    servidor.close();
    process.exit(1);
  }

  try {
    const { tokens } = await oauth2.getToken(codigo);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(
      '<h1>Pronto!</h1><p>Pode fechar esta aba e voltar para o terminal.</p>'
    );

    if (!tokens.refresh_token) {
      console.error(
        '\nO Google nao devolveu um refresh token.\n' +
        'Remova o acesso do app em https://myaccount.google.com/permissions e rode de novo.\n'
      );
      servidor.close();
      process.exit(1);
    }

    console.log('\n' + '-'.repeat(70));
    console.log('  Copie a linha abaixo para o seu arquivo .env:');
    console.log('-'.repeat(70) + '\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    console.log('E confirme que STORAGE_DRIVER=drive e GOOGLE_AUTH_MODE=oauth estao no .env.\n');
  } catch (falha) {
    res.writeHead(500).end('Falha ao trocar o codigo pelo token.');
    console.error('\nFalha ao obter o token:', falha.message, '\n');
  } finally {
    servidor.close();
    setTimeout(() => process.exit(0), 200);
  }
});

servidor.listen(porta);
