/**
 * Cliente do Google Drive.
 *
 * Dois modos de autenticacao:
 *  - oauth           : usa o SEU Drive (arquivos ficam na sua conta). Recomendado.
 *  - service_account : usa uma conta de servico. So funciona bem em Shared Drive,
 *                      porque conta de servico nao tem cota propria no "Meu Drive".
 */
import fs from 'node:fs';
import { Readable } from 'node:stream';
import { google } from 'googleapis';
import { config } from '../config.js';

const ESCOPOS = ['https://www.googleapis.com/auth/drive'];
const MIME_PASTA = 'application/vnd.google-apps.folder';

let clienteDrive = null;

export function criarAuth() {
  if (config.google.modo === 'service_account') {
    let credenciais = null;
    if (config.google.serviceAccountJson) {
      credenciais = JSON.parse(config.google.serviceAccountJson);
    } else if (config.google.serviceAccountFile && fs.existsSync(config.google.serviceAccountFile)) {
      credenciais = JSON.parse(fs.readFileSync(config.google.serviceAccountFile, 'utf8'));
    } else {
      throw new Error(
        'Conta de servico nao configurada. Defina GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_SERVICE_ACCOUNT_FILE.'
      );
    }
    return new google.auth.GoogleAuth({ credentials: credenciais, scopes: ESCOPOS });
  }

  const { clientId, clientSecret, redirectUri, refreshToken } = config.google;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET nao configurados.');
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  if (!refreshToken) {
    throw new Error('GOOGLE_REFRESH_TOKEN nao configurado. Rode "npm run setup:google".');
  }
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

export function drive() {
  if (!clienteDrive) {
    clienteDrive = google.drive({ version: 'v3', auth: criarAuth() });
  }
  return clienteDrive;
}

const COMUM = { supportsAllDrives: true, includeItemsFromAllDrives: true };

function escapar(nome) {
  return String(nome).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Busca uma pasta pelo nome dentro de um pai; cria se nao existir. */
export async function garantirPasta(nome, paiId = null) {
  const d = drive();
  const filtros = [
    `name='${escapar(nome)}'`,
    `mimeType='${MIME_PASTA}'`,
    'trashed=false',
    paiId ? `'${escapar(paiId)}' in parents` : "'root' in parents",
  ];
  const { data } = await d.files.list({
    q: filtros.join(' and '),
    fields: 'files(id,name)',
    pageSize: 1,
    ...COMUM,
  });
  if (data.files?.length) return data.files[0].id;

  const criada = await d.files.create({
    requestBody: {
      name: nome,
      mimeType: MIME_PASTA,
      ...(paiId ? { parents: [paiId] } : {}),
    },
    fields: 'id',
    ...COMUM,
  });
  return criada.data.id;
}

export async function acharArquivo(nome, paiId) {
  const { data } = await drive().files.list({
    q: `name='${escapar(nome)}' and '${escapar(paiId)}' in parents and trashed=false`,
    fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
    pageSize: 1,
    ...COMUM,
  });
  return data.files?.[0] ?? null;
}

export async function listarArquivos(paiId) {
  const arquivos = [];
  let pageToken;
  do {
    const { data } = await drive().files.list({
      q: `'${escapar(paiId)}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id,name,mimeType,size,modifiedTime,webViewLink)',
      pageSize: 200,
      pageToken,
      ...COMUM,
    });
    arquivos.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return arquivos;
}

/** Cria ou substitui um arquivo pelo nome dentro da pasta. */
export async function salvarArquivo({ nome, paiId, buffer, mimeType }) {
  const d = drive();
  const existente = await acharArquivo(nome, paiId);
  const media = { mimeType, body: Readable.from(buffer) };

  if (existente) {
    const { data } = await d.files.update({
      fileId: existente.id,
      media,
      fields: 'id,name,webViewLink,modifiedTime',
      ...COMUM,
    });
    return data;
  }
  const { data } = await d.files.create({
    requestBody: { name: nome, parents: [paiId] },
    media,
    fields: 'id,name,webViewLink,modifiedTime',
    ...COMUM,
  });
  return data;
}

export async function baixarArquivo(fileId) {
  const { data } = await drive().files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(data);
}

export async function excluirArquivo(fileId) {
  await drive().files.update({
    fileId,
    requestBody: { trashed: true },
    ...COMUM,
  });
}

export async function tornarPublico(fileId) {
  try {
    await drive().permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });
  } catch (erro) {
    if (erro?.code !== 400) throw erro;
  }
  const { data } = await drive().files.get({
    fileId,
    fields: 'webViewLink,webContentLink',
    supportsAllDrives: true,
  });
  return data;
}

export async function testarConexao() {
  const { data } = await drive().about.get({ fields: 'user(emailAddress,displayName),storageQuota' });
  return data;
}
