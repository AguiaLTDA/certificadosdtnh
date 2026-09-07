import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(__dirname, '..');

function env(nome, padrao = '') {
  const v = process.env[nome];
  return v === undefined || v === '' ? padrao : v;
}

export const config = {
  porta: Number(env('PORT', '3000')),
  baseUrl: env('BASE_URL', 'http://localhost:3000').replace(/\/+$/, ''),

  admin: {
    usuario: env('ADMIN_USUARIO', 'admin'),
    senhaHash: env('ADMIN_SENHA_HASH'),
  },
  sessionSecret: env('SESSION_SECRET', 'dev-session-secret-troque-em-producao'),
  codigoSecret: env('CODIGO_SECRET', 'dev-codigo-secret-troque-em-producao'),

  storage: {
    driver: env('STORAGE_DRIVER', 'local'), // local | drive
    pastaLocal: path.join(RAIZ, 'dados-locais'),
  },

  google: {
    modo: env('GOOGLE_AUTH_MODE', 'oauth'), // oauth | service_account
    clientId: env('GOOGLE_CLIENT_ID'),
    clientSecret: env('GOOGLE_CLIENT_SECRET'),
    refreshToken: env('GOOGLE_REFRESH_TOKEN'),
    redirectUri: env('GOOGLE_REDIRECT_URI', 'http://localhost:3000/oauth2callback'),
    serviceAccountFile: env('GOOGLE_SERVICE_ACCOUNT_FILE'),
    serviceAccountJson: env('GOOGLE_SERVICE_ACCOUNT_JSON'),
    pastaRaizId: env('DRIVE_PASTA_RAIZ_ID'),
    nomePastaRaiz: 'Certificados UNIVC',
  },

  entregaPdf: env('ENTREGA_PDF', 'proxy'), // proxy | drive

  instituicao: {
    nome: env('INSTITUICAO_NOME', 'Centro Universitario Vale do Cricare'),
    sigla: env('INSTITUICAO_SIGLA', 'UNIVC'),
    mantenedora: env('INSTITUICAO_MANTENEDORA', 'Instituto Vale do Cricare'),
    cidade: env('INSTITUICAO_CIDADE', 'Sao Mateus'),
    uf: env('INSTITUICAO_UF', 'ES'),
    site: env('INSTITUICAO_SITE', 'https://www.univc.br'),
    cnpj: env('INSTITUICAO_CNPJ'),
    credenciamento: env('INSTITUICAO_CREDENCIAMENTO'),
  },
};

export function avisosDeConfiguracao() {
  const avisos = [];
  if (!config.admin.senhaHash) {
    avisos.push('ADMIN_SENHA_HASH nao definido. Rode "npm run setup:admin" e cole o hash no .env.');
  }
  if (config.sessionSecret.startsWith('dev-')) {
    avisos.push('SESSION_SECRET esta com o valor padrao de desenvolvimento.');
  }
  if (config.codigoSecret.startsWith('dev-')) {
    avisos.push('CODIGO_SECRET esta com o valor padrao de desenvolvimento.');
  }
  if (config.storage.driver === 'local') {
    avisos.push('STORAGE_DRIVER=local: os dados ficam em ./dados-locais, nao no Google Drive.');
  }
  return avisos;
}
