/**
 * API do painel administrativo. Tudo abaixo de /api exige sessao,
 * exceto o proprio login.
 */
import express from 'express';
import multer from 'multer';
import { config, avisosDeConfiguracao } from '../config.js';
import brand from '../brand/univc.js';
import * as db from '../services/db.js';
import * as certs from '../services/certificados.js';
import {
  conferirSenha, criarToken, definirCookieSessao, exigirLogin, ipDaRequisicao,
  limitarTentativas, limparCookieSessao, limparTentativas, sessaoDaRequisicao,
} from '../services/auth.js';
import { listarLayouts } from '../templates/layouts.js';
import { MARCADORES, exemploContexto, aplicar } from '../services/vocalizacao.js';
import { gerarPdfExemplo } from '../services/pdf.js';
import { lerParticipantes, gerarCsv } from '../services/csv.js';
import {
  obterImagem, obterLogo, removerLogo, salvarImagemAssinatura, salvarLogo,
} from '../services/identidade.js';
import { infoStorage } from '../services/storage.js';
import { gerarId, dataHoraCurta, slug } from '../services/util.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
export const api = express.Router();

const ok = (res, dados) => res.json(dados);
const falha = (res, status, mensagem) => res.status(status).json({ erro: mensagem });

function assincrono(handler) {
  return (req, res, proximo) => Promise.resolve(handler(req, res, proximo)).catch(proximo);
}

/* ------------------------------------------------------------------ */
/* Sessao                                                              */
/* ------------------------------------------------------------------ */

api.get('/sessao', (req, res) => {
  const sessao = sessaoDaRequisicao(req);
  ok(res, { autenticado: Boolean(sessao), usuario: sessao?.u ?? null });
});

api.post('/sessao', assincrono(async (req, res) => {
  const { usuario, senha } = req.body ?? {};
  const chave = `login:${ipDaRequisicao(req)}`;
  const limite = limitarTentativas({ chave });
  if (!limite.permitido) {
    return falha(res, 429, `Muitas tentativas. Tente novamente em ${limite.esperarSegundos} segundos.`);
  }
  if (!config.admin.senhaHash) {
    return falha(res, 500, 'Nenhuma senha de administrador configurada. Rode "npm run setup:admin".');
  }
  const usuarioOk = String(usuario ?? '').trim() === config.admin.usuario;
  const senhaOk = conferirSenha(String(senha ?? ''), config.admin.senhaHash);
  if (!usuarioOk || !senhaOk) {
    return falha(res, 401, 'Usuario ou senha invalidos.');
  }
  limparTentativas(chave);
  definirCookieSessao(res, criarToken(config.admin.usuario));
  ok(res, { autenticado: true, usuario: config.admin.usuario });
}));

api.delete('/sessao', (req, res) => {
  limparCookieSessao(res);
  ok(res, { autenticado: false });
});

// A partir daqui, tudo exige login.
api.use(exigirLogin);

/* ------------------------------------------------------------------ */
/* Estado geral da plataforma                                          */
/* ------------------------------------------------------------------ */

api.get('/estado', assincrono(async (req, res) => {
  const [armazenamento, configuracao, estatisticas] = await Promise.all([
    infoStorage(),
    db.lerConfiguracao(),
    certs.estatisticas(),
  ]);
  ok(res, {
    instituicao: config.instituicao,
    baseUrl: config.baseUrl,
    armazenamento,
    avisos: avisosDeConfiguracao(),
    layouts: listarLayouts(),
    marcadores: MARCADORES,
    paleta: brand.paleta,
    vocalizacaoPadrao: brand.vocalizacaoPadrao,
    vocalizacoesSugeridas: brand.vocalizacoesSugeridas,
    temLogo: Boolean(configuracao.logoId),
    logoId: configuracao.logoId ?? null,
    assinaturasPadrao: configuracao.assinaturasPadrao ?? [],
    estatisticas,
  });
}));

api.get('/estatisticas', assincrono(async (req, res) => ok(res, await certs.estatisticas())));

/* ------------------------------------------------------------------ */
/* Eventos                                                             */
/* ------------------------------------------------------------------ */

/** Normaliza o corpo do formulario de evento (nomes simples e previsiveis). */
function montarEvento(corpo, anterior = {}) {
  const texto = (v, padrao = '') => String(v ?? padrao).trim();
  const assinaturas = Array.isArray(corpo.assinaturas)
    ? corpo.assinaturas
        .map((a) => ({ nome: texto(a?.nome), cargo: texto(a?.cargo), imagemId: a?.imagemId ?? null }))
        .filter((a) => a.nome || a.cargo)
        .slice(0, 4)
    : anterior.assinaturas ?? [];

  return {
    tema: texto(corpo.tema, anterior.tema ?? ''),
    subtitulo: texto(corpo.subtitulo, anterior.subtitulo ?? ''),
    tipo: texto(corpo.tipo, anterior.tipo ?? ''),
    modalidade: texto(corpo.modalidade, anterior.modalidade ?? ''),
    cargaHoraria: Number(corpo.cargaHoraria ?? anterior.cargaHoraria ?? 0) || 0,
    dataInicio: texto(corpo.dataInicio, anterior.dataInicio ?? ''),
    dataFim: texto(corpo.dataFim, anterior.dataFim ?? ''),
    local: texto(corpo.local, anterior.local ?? ''),
    cidade: texto(corpo.cidade, anterior.cidade ?? `${config.instituicao.cidade}/${config.instituicao.uf}`),
    papelPadrao: texto(corpo.papelPadrao, anterior.papelPadrao ?? 'participante'),
    tituloCertificado: texto(corpo.tituloCertificado, anterior.tituloCertificado ?? 'Certificado'),
    subtituloCertificado: texto(corpo.subtituloCertificado, anterior.subtituloCertificado ?? ''),
    vocalizacao: String(corpo.vocalizacao ?? anterior.vocalizacao ?? brand.vocalizacaoPadrao),
    conteudoProgramatico: String(corpo.conteudoProgramatico ?? anterior.conteudoProgramatico ?? ''),
    destacarNome: corpo.destacarNome !== undefined ? Boolean(corpo.destacarNome) : anterior.destacarNome !== false,
    ocultarCidadeData: Boolean(corpo.ocultarCidadeData ?? anterior.ocultarCidadeData ?? false),
    assinaturas,
    temaVisual: { ...(anterior.temaVisual ?? {}), ...(corpo.temaVisual ?? {}) },
  };
}

api.get('/eventos', assincrono(async (req, res) => {
  const eventos = await db.listarEventos();
  const certificados = await db.carregar('certificados');
  const contagem = certificados.reduce((mapa, c) => {
    mapa[c.eventoId] = (mapa[c.eventoId] ?? 0) + 1;
    return mapa;
  }, {});
  ok(res, eventos.map((e) => ({ ...e, totalCertificados: contagem[e.id] ?? 0 })));
}));

api.get('/eventos/:id', assincrono(async (req, res) => {
  const evento = await db.acharEvento(req.params.id);
  if (!evento) return falha(res, 404, 'Evento nao encontrado.');
  ok(res, evento);
}));

api.post('/eventos', assincrono(async (req, res) => {
  const dados = montarEvento(req.body ?? {});
  if (!dados.tema) return falha(res, 400, 'Informe o tema do evento.');
  if (!dados.cargaHoraria) return falha(res, 400, 'Informe a carga horaria do evento.');
  const evento = {
    id: gerarId('evt_'),
    ...dados,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  };
  await db.inserirEvento(evento);
  res.status(201).json(evento);
}));

api.put('/eventos/:id', assincrono(async (req, res) => {
  const anterior = await db.acharEvento(req.params.id);
  if (!anterior) return falha(res, 404, 'Evento nao encontrado.');
  const dados = montarEvento(req.body ?? {}, anterior);
  if (!dados.tema) return falha(res, 400, 'Informe o tema do evento.');
  const atualizado = await db.atualizarEvento(req.params.id, dados);
  ok(res, atualizado);
}));

api.delete('/eventos/:id', assincrono(async (req, res) => {
  const certificados = await db.listarCertificados({ eventoId: req.params.id });
  if (certificados.length && req.query.forcar !== 'sim') {
    return falha(res, 409, `Este evento possui ${certificados.length} certificado(s) emitido(s). ` +
      'Exclua os certificados antes ou confirme a exclusao forcada.');
  }
  for (const c of certificados) await certs.excluir(c.id);
  const removido = await db.removerEvento(req.params.id);
  if (!removido) return falha(res, 404, 'Evento nao encontrado.');
  ok(res, { removido: true, certificadosRemovidos: certificados.length });
}));

/* ------------------------------------------------------------------ */
/* Pre-visualizacao                                                    */
/* ------------------------------------------------------------------ */

/** Previa em PDF a partir dos dados que estao na tela (evento nao salvo). */
api.post('/previa', assincrono(async (req, res) => {
  const base = req.body?.eventoId ? await db.acharEvento(req.body.eventoId) : null;
  const evento = { id: base?.id ?? 'previa', ...montarEvento(req.body ?? {}, base ?? {}) };
  const pdf = await gerarPdfExemplo({ evento, logoBuffer: await obterLogo() });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="previa-certificado.pdf"');
  res.setHeader('Cache-Control', 'no-store');
  res.send(pdf);
}));

/** Previa apenas do texto (vocalizacao) com dados ficticios. */
api.post('/previa-texto', assincrono(async (req, res) => {
  const contexto = exemploContexto(req.body ?? {});
  ok(res, { texto: aplicar(req.body?.vocalizacao || brand.vocalizacaoPadrao, contexto), contexto });
}));

/* ------------------------------------------------------------------ */
/* Emissao                                                             */
/* ------------------------------------------------------------------ */

api.post('/eventos/:id/importar-csv', upload.single('arquivo'), assincrono(async (req, res) => {
  const texto = req.file ? req.file.buffer.toString('utf8') : String(req.body?.texto ?? '');
  if (!texto.trim()) return falha(res, 400, 'Envie um arquivo CSV ou cole a lista.');
  ok(res, lerParticipantes(texto));
}));

api.post('/eventos/:id/emitir', assincrono(async (req, res) => {
  const participantes = Array.isArray(req.body?.participantes) ? req.body.participantes : [];
  if (!participantes.length) return falha(res, 400, 'Nenhum participante informado.');
  if (participantes.length > 500) {
    return falha(res, 400, 'Limite de 500 certificados por lote. Divida a lista.');
  }
  const resultado = await certs.emitirLote({
    eventoId: req.params.id,
    participantes,
    substituir: Boolean(req.body?.substituir),
  });
  ok(res, resultado);
}));

api.post('/eventos/:id/reemitir', assincrono(async (req, res) => {
  ok(res, await certs.reemitirEvento(req.params.id));
}));

/* ------------------------------------------------------------------ */
/* Certificados                                                        */
/* ------------------------------------------------------------------ */

api.get('/certificados', assincrono(async (req, res) => {
  const lista = await db.listarCertificados({
    eventoId: req.query.eventoId || undefined,
    busca: req.query.busca || undefined,
  });
  const limite = Math.min(Number(req.query.limite) || 200, 1000);
  ok(res, { total: lista.length, itens: lista.slice(0, limite) });
}));

api.get('/certificados/:id/pdf', assincrono(async (req, res) => {
  const certificado = await db.acharCertificado(req.params.id);
  if (!certificado) return falha(res, 404, 'Certificado nao encontrado.');
  const pdf = await certs.baixarPdf(certificado);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `${req.query.baixar === 'sim' ? 'attachment' : 'inline'}; filename="${certificado.arquivoNome}"`);
  res.send(pdf);
}));

api.post('/certificados/:id/reemitir', assincrono(async (req, res) => {
  ok(res, await certs.reemitir(req.params.id));
}));

api.post('/certificados/:id/revogar', assincrono(async (req, res) => {
  const atualizado = await certs.revogar(req.params.id, req.body?.motivo);
  if (!atualizado) return falha(res, 404, 'Certificado nao encontrado.');
  ok(res, atualizado);
}));

api.post('/certificados/:id/reativar', assincrono(async (req, res) => {
  const atualizado = await certs.reativar(req.params.id);
  if (!atualizado) return falha(res, 404, 'Certificado nao encontrado.');
  ok(res, atualizado);
}));

api.delete('/certificados/:id', assincrono(async (req, res) => {
  const removido = await certs.excluir(req.params.id);
  if (!removido) return falha(res, 404, 'Certificado nao encontrado.');
  ok(res, { removido: true });
}));

/* ------------------------------------------------------------------ */
/* Relatorio                                                           */
/* ------------------------------------------------------------------ */

api.get('/eventos/:id/relatorio.csv', assincrono(async (req, res) => {
  const evento = await db.acharEvento(req.params.id);
  if (!evento) return falha(res, 404, 'Evento nao encontrado.');
  const lista = await db.listarCertificados({ eventoId: evento.id });
  const csv = gerarCsv(lista, [
    { titulo: 'Codigo', valor: (c) => c.codigo },
    { titulo: 'Nome', valor: (c) => c.nome },
    { titulo: 'Documento', valor: (c) => c.documento },
    { titulo: 'E-mail', valor: (c) => c.email },
    { titulo: 'Papel', valor: (c) => c.papel },
    { titulo: 'Carga horaria', valor: (c) => c.cargaHoraria },
    { titulo: 'Situacao', valor: (c) => c.status },
    { titulo: 'Emitido em', valor: (c) => dataHoraCurta(c.emitidoEm) },
    { titulo: 'Validacao', valor: (c) => `${config.baseUrl}/validar/${c.codigo}` },
  ]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="certificados-${slug(evento.tema)}.csv"`);
  res.send(csv);
}));

/* ------------------------------------------------------------------ */
/* Identidade visual                                                   */
/* ------------------------------------------------------------------ */

api.post('/identidade/logo', upload.single('arquivo'), assincrono(async (req, res) => {
  if (!req.file) return falha(res, 400, 'Selecione um arquivo PNG ou JPG.');
  const arquivo = await salvarLogo({
    buffer: req.file.buffer,
    mimeType: req.file.mimetype,
    nomeOriginal: req.file.originalname,
  });
  ok(res, { id: arquivo.id, nome: arquivo.nome });
}));

api.delete('/identidade/logo', assincrono(async (req, res) => {
  ok(res, { removido: await removerLogo() });
}));

api.post('/identidade/assinatura', upload.single('arquivo'), assincrono(async (req, res) => {
  if (!req.file) return falha(res, 400, 'Selecione um arquivo PNG ou JPG.');
  const arquivo = await salvarImagemAssinatura({
    buffer: req.file.buffer,
    mimeType: req.file.mimetype,
    nomeOriginal: req.file.originalname,
  });
  ok(res, { id: arquivo.id, nome: arquivo.nome });
}));

api.get('/identidade/imagem', assincrono(async (req, res) => {
  const buffer = await obterImagem(String(req.query.id ?? ''));
  if (!buffer) return falha(res, 404, 'Imagem nao encontrada.');
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.send(buffer);
}));

api.put('/identidade/assinaturas-padrao', assincrono(async (req, res) => {
  const lista = Array.isArray(req.body?.assinaturas) ? req.body.assinaturas.slice(0, 4) : [];
  await db.gravarConfiguracao({ assinaturasPadrao: lista });
  ok(res, { assinaturasPadrao: lista });
}));

export default api;
