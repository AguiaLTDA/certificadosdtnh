/**
 * Camada de armazenamento.
 *
 * A plataforma nunca fala com o Google Drive diretamente: fala com este modulo.
 * Assim o mesmo codigo roda com o Drive (producao) ou com o disco (desenvolvimento).
 *
 * Estrutura criada dentro da pasta raiz:
 *   Certificados UNIVC/
 *     ├── base-de-dados/      (JSON: eventos, certificados, contadores)
 *     ├── certificados/       (PDFs emitidos, subpasta por evento)
 *     └── identidade/         (logotipo, assinaturas, selos)
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import * as gd from './drive.js';

export const PASTA_DB = 'base-de-dados';
export const PASTA_PDF = 'certificados';
export const PASTA_ASSETS = 'identidade';

let pronto = null;
const estado = { driver: config.storage.driver, raiz: null, pastas: {} };

/* ------------------------------------------------------------------ *
 * Driver local
 * ------------------------------------------------------------------ */
const local = {
  async init() {
    estado.raiz = config.storage.pastaLocal;
    for (const p of [PASTA_DB, PASTA_PDF, PASTA_ASSETS]) {
      const alvo = path.join(estado.raiz, p);
      await fs.mkdir(alvo, { recursive: true });
      estado.pastas[p] = alvo;
    }
  },
  async subPasta(pastaBase, nome) {
    const alvo = path.join(pastaBase, nome);
    await fs.mkdir(alvo, { recursive: true });
    return alvo;
  },
  async lerJson(nome) {
    const alvo = path.join(estado.pastas[PASTA_DB], nome);
    if (!fsSync.existsSync(alvo)) return null;
    return JSON.parse(await fs.readFile(alvo, 'utf8'));
  },
  async gravarJson(nome, dados) {
    const alvo = path.join(estado.pastas[PASTA_DB], nome);
    const temp = `${alvo}.tmp`;
    await fs.writeFile(temp, JSON.stringify(dados, null, 2), 'utf8');
    await fs.rename(temp, alvo);
  },
  async salvarBinario({ pasta, nome, buffer }) {
    const alvo = path.join(pasta, nome);
    await fs.writeFile(alvo, buffer);
    return { id: path.relative(estado.raiz, alvo).replace(/\\/g, '/'), nome, link: null };
  },
  async lerBinario(id) {
    const alvo = path.isAbsolute(id) ? id : path.join(estado.raiz, id);
    return fs.readFile(alvo);
  },
  async excluir(id) {
    const alvo = path.isAbsolute(id) ? id : path.join(estado.raiz, id);
    if (fsSync.existsSync(alvo)) await fs.unlink(alvo);
  },
  async tornarPublico() {
    return { webViewLink: null, webContentLink: null };
  },
  async info() {
    return { driver: 'local', ok: true, detalhe: estado.raiz };
  },
};

/* ------------------------------------------------------------------ *
 * Driver Google Drive
 * ------------------------------------------------------------------ */
const remoto = {
  async init() {
    estado.raiz = config.google.pastaRaizId || (await gd.garantirPasta(config.google.nomePastaRaiz, null));
    for (const p of [PASTA_DB, PASTA_PDF, PASTA_ASSETS]) {
      estado.pastas[p] = await gd.garantirPasta(p, estado.raiz);
    }
  },
  async subPasta(pastaBaseId, nome) {
    return gd.garantirPasta(nome, pastaBaseId);
  },
  async lerJson(nome) {
    const arq = await gd.acharArquivo(nome, estado.pastas[PASTA_DB]);
    if (!arq) return null;
    const buf = await gd.baixarArquivo(arq.id);
    const txt = buf.toString('utf8').trim();
    return txt ? JSON.parse(txt) : null;
  },
  async gravarJson(nome, dados) {
    await gd.salvarArquivo({
      nome,
      paiId: estado.pastas[PASTA_DB],
      buffer: Buffer.from(JSON.stringify(dados, null, 2), 'utf8'),
      mimeType: 'application/json',
    });
  },
  async salvarBinario({ pasta, nome, buffer, mimeType }) {
    const r = await gd.salvarArquivo({ nome, paiId: pasta, buffer, mimeType });
    return { id: r.id, nome: r.name, link: r.webViewLink ?? null };
  },
  async lerBinario(id) {
    return gd.baixarArquivo(id);
  },
  async excluir(id) {
    await gd.excluirArquivo(id);
  },
  async tornarPublico(id) {
    return gd.tornarPublico(id);
  },
  async info() {
    const about = await gd.testarConexao();
    return {
      driver: 'drive',
      ok: true,
      conta: about?.user?.emailAddress ?? null,
      pastaRaizId: estado.raiz,
      detalhe: `Pasta raiz: ${estado.raiz}`,
    };
  },
};

function driver() {
  return config.storage.driver === 'drive' ? remoto : local;
}

export async function iniciarStorage() {
  if (!pronto) {
    pronto = driver()
      .init()
      .catch((erro) => {
        pronto = null;
        throw erro;
      });
  }
  return pronto;
}

async function garantido() {
  await iniciarStorage();
  return driver();
}

export async function lerJson(nome) {
  return (await garantido()).lerJson(nome);
}
export async function gravarJson(nome, dados) {
  return (await garantido()).gravarJson(nome, dados);
}
export async function pastaCertificadosDoEvento(slugEvento) {
  const d = await garantido();
  return d.subPasta(estado.pastas[PASTA_PDF], slugEvento);
}
export async function pastaIdentidade() {
  await iniciarStorage();
  return estado.pastas[PASTA_ASSETS];
}
export async function salvarBinario(args) {
  return (await garantido()).salvarBinario(args);
}
export async function lerBinario(id) {
  return (await garantido()).lerBinario(id);
}
export async function excluirBinario(id) {
  return (await garantido()).excluir(id);
}
export async function tornarPublico(id) {
  return (await garantido()).tornarPublico(id);
}
export async function infoStorage() {
  try {
    return await (await garantido()).info();
  } catch (erro) {
    return { driver: config.storage.driver, ok: false, erro: erro.message };
  }
}
