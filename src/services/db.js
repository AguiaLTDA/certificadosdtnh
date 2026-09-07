/**
 * "Banco de dados" em JSON, com o Google Drive como armazenamento.
 *
 * Cada colecao e um arquivo JSON na pasta base-de-dados/.
 * Mantemos cache em memoria e gravacao serializada (fila) para evitar
 * que duas requisicoes simultaneas sobrescrevam uma a outra.
 *
 * Escala prevista: dezenas de milhares de certificados. Acima disso vale
 * migrar para um banco relacional (ver docs/ARQUITETURA.md).
 */
import { lerJson, gravarJson } from './storage.js';

const COLECOES = {
  eventos: 'eventos.json',
  certificados: 'certificados.json',
  configuracao: 'configuracao.json',
};

const cache = new Map();
let fila = Promise.resolve();

/** Executa a funcao em fila, garantindo uma gravacao por vez. */
function enfileirar(fn) {
  const proximo = fila.then(fn, fn);
  fila = proximo.catch(() => {});
  return proximo;
}

function padrao(colecao) {
  return colecao === 'configuracao' ? {} : [];
}

export async function carregar(colecao) {
  if (cache.has(colecao)) return cache.get(colecao);
  const arquivo = COLECOES[colecao];
  if (!arquivo) throw new Error(`Colecao desconhecida: ${colecao}`);
  const dados = (await lerJson(arquivo)) ?? padrao(colecao);
  cache.set(colecao, dados);
  return dados;
}

export async function persistir(colecao) {
  const dados = cache.get(colecao) ?? padrao(colecao);
  await gravarJson(COLECOES[colecao], dados);
}

/**
 * Aplica uma mutacao na colecao e grava. `fn` recebe os dados e devolve
 * o resultado que sera repassado a quem chamou.
 */
export async function mutar(colecao, fn) {
  return enfileirar(async () => {
    const dados = await carregar(colecao);
    const resultado = await fn(dados);
    await persistir(colecao);
    return resultado;
  });
}

export function limparCache() {
  cache.clear();
}

/* -------------------- Eventos -------------------- */
export async function listarEventos() {
  return [...(await carregar('eventos'))].sort((a, b) =>
    String(b.criadoEm ?? '').localeCompare(String(a.criadoEm ?? ''))
  );
}
export async function acharEvento(id) {
  return (await carregar('eventos')).find((e) => e.id === id) ?? null;
}
export async function inserirEvento(evento) {
  return mutar('eventos', (lista) => {
    lista.push(evento);
    return evento;
  });
}
export async function atualizarEvento(id, campos) {
  return mutar('eventos', (lista) => {
    const i = lista.findIndex((e) => e.id === id);
    if (i < 0) return null;
    lista[i] = { ...lista[i], ...campos, id, atualizadoEm: new Date().toISOString() };
    return lista[i];
  });
}
export async function removerEvento(id) {
  return mutar('eventos', (lista) => {
    const i = lista.findIndex((e) => e.id === id);
    if (i < 0) return false;
    lista.splice(i, 1);
    return true;
  });
}

/* -------------------- Certificados -------------------- */
export async function listarCertificados(filtro = {}) {
  let lista = await carregar('certificados');
  if (filtro.eventoId) lista = lista.filter((c) => c.eventoId === filtro.eventoId);
  if (filtro.busca) {
    const t = normalizar(filtro.busca);
    lista = lista.filter(
      (c) =>
        normalizar(c.nome).includes(t) ||
        normalizar(c.codigo).includes(t) ||
        normalizar(c.documento ?? '').includes(t) ||
        normalizar(c.email ?? '').includes(t)
    );
  }
  return [...lista].sort((a, b) => String(b.emitidoEm).localeCompare(String(a.emitidoEm)));
}
export async function acharCertificadoPorCodigo(codigo) {
  const alvo = String(codigo ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!alvo) return null;
  return (
    (await carregar('certificados')).find(
      (c) => c.codigo.toUpperCase().replace(/[^A-Z0-9]/g, '') === alvo
    ) ?? null
  );
}
export async function acharCertificado(id) {
  return (await carregar('certificados')).find((c) => c.id === id) ?? null;
}
export async function inserirCertificados(novos) {
  return mutar('certificados', (lista) => {
    lista.push(...novos);
    return novos;
  });
}
export async function atualizarCertificado(id, campos) {
  return mutar('certificados', (lista) => {
    const i = lista.findIndex((c) => c.id === id);
    if (i < 0) return null;
    lista[i] = { ...lista[i], ...campos, id };
    return lista[i];
  });
}
export async function removerCertificado(id) {
  return mutar('certificados', (lista) => {
    const i = lista.findIndex((c) => c.id === id);
    if (i < 0) return null;
    return lista.splice(i, 1)[0];
  });
}

/* -------------------- Configuracao -------------------- */
export async function lerConfiguracao() {
  return carregar('configuracao');
}
export async function gravarConfiguracao(campos) {
  return mutar('configuracao', (atual) => {
    Object.assign(atual, campos);
    return atual;
  });
}

export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
