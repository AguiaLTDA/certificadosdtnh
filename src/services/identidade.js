/**
 * Identidade visual: logotipo institucional e imagens de assinatura.
 * Os arquivos ficam na pasta "identidade" do Google Drive.
 */
import { lerConfiguracao, gravarConfiguracao } from './db.js';
import { lerBinario, pastaIdentidade, salvarBinario, excluirBinario } from './storage.js';
import { gerarId, slug } from './util.js';

const cacheImagens = new Map();
const TTL = 5 * 60 * 1000;

export const MIMES_IMAGEM = ['image/png', 'image/jpeg', 'image/jpg'];

function guardar(id, buffer) {
  cacheImagens.set(id, { buffer, em: Date.now() });
  return buffer;
}

export function invalidarCache(id) {
  if (id) cacheImagens.delete(id);
  else cacheImagens.clear();
}

export async function obterImagem(id) {
  if (!id) return null;
  const cache = cacheImagens.get(id);
  if (cache && Date.now() - cache.em < TTL) return cache.buffer;
  try {
    return guardar(id, await lerBinario(id));
  } catch {
    return null;
  }
}

/* -------------------- Logotipo -------------------- */

export async function obterLogo() {
  const cfg = await lerConfiguracao();
  return obterImagem(cfg.logoId);
}

export async function salvarLogo({ buffer, mimeType, nomeOriginal }) {
  if (!MIMES_IMAGEM.includes(mimeType)) {
    throw new Error('Envie o logotipo em PNG ou JPG. PNG com fundo transparente da o melhor resultado.');
  }
  const pasta = await pastaIdentidade();
  const extensao = mimeType === 'image/png' ? 'png' : 'jpg';
  const nome = `logotipo-${slug(nomeOriginal || 'univc')}.${extensao}`;
  const arquivo = await salvarBinario({ pasta, nome, buffer, mimeType });
  const cfg = await lerConfiguracao();
  if (cfg.logoId && cfg.logoId !== arquivo.id) {
    invalidarCache(cfg.logoId);
    await excluirBinario(cfg.logoId).catch(() => {});
  }
  invalidarCache(arquivo.id);
  await gravarConfiguracao({ logoId: arquivo.id, logoNome: nome, logoMime: mimeType });
  return arquivo;
}

export async function removerLogo() {
  const cfg = await lerConfiguracao();
  if (!cfg.logoId) return false;
  invalidarCache(cfg.logoId);
  await excluirBinario(cfg.logoId).catch(() => {});
  await gravarConfiguracao({ logoId: null, logoNome: null, logoMime: null });
  return true;
}

/* -------------------- Assinaturas -------------------- */

export async function salvarImagemAssinatura({ buffer, mimeType, nomeOriginal }) {
  if (!MIMES_IMAGEM.includes(mimeType)) {
    throw new Error('Envie a assinatura em PNG (fundo transparente) ou JPG.');
  }
  const pasta = await pastaIdentidade();
  const extensao = mimeType === 'image/png' ? 'png' : 'jpg';
  const nome = `assinatura-${slug(nomeOriginal || gerarId())}-${Date.now()}.${extensao}`;
  const arquivo = await salvarBinario({ pasta, nome, buffer, mimeType });
  invalidarCache(arquivo.id);
  return arquivo;
}

/** Anexa os buffers das imagens as assinaturas do evento. */
export async function resolverAssinaturas(assinaturas = []) {
  return Promise.all(
    (assinaturas || []).map(async (a) => ({
      nome: a?.nome ?? '',
      cargo: a?.cargo ?? '',
      imagemId: a?.imagemId ?? null,
      imagemBuffer: a?.imagemId ? await obterImagem(a.imagemId) : null,
    }))
  );
}
