/**
 * Rotas publicas: e para ca que o QR Code do certificado aponta.
 * Nao exigem login e nao expoem dados alem do necessario para conferir
 * a autenticidade do documento.
 */
import path from 'node:path';
import express from 'express';
import { config, RAIZ } from '../config.js';
import * as db from '../services/db.js';
import * as certs from '../services/certificados.js';
import { normalizarCodigo } from '../services/codigo.js';
import { limitarTentativas, ipDaRequisicao } from '../services/auth.js';

export const publico = express.Router();

function assincrono(handler) {
  return (req, res, proximo) => Promise.resolve(handler(req, res, proximo)).catch(proximo);
}

/** Evita varredura automatica de codigos. */
function limiteConsulta(req, res, proximo) {
  const limite = limitarTentativas({
    chave: `validacao:${ipDaRequisicao(req)}`,
    maximo: 60,
    janelaMs: 5 * 60 * 1000,
  });
  if (!limite.permitido) {
    return res.status(429).json({
      erro: `Muitas consultas seguidas. Tente novamente em ${limite.esperarSegundos} segundos.`,
    });
  }
  proximo();
}

/* Paginas -------------------------------------------------------- */

const paginaValidacao = path.join(RAIZ, 'public', 'validar.html');

publico.get('/validar', (req, res) => res.sendFile(paginaValidacao));
publico.get('/validar/:codigo', (req, res) => res.sendFile(paginaValidacao));

/** Atalho curto, util em QR Codes impressos pequenos. */
publico.get('/c/:codigo', (req, res) => {
  res.redirect(302, `/validar/${encodeURIComponent(req.params.codigo)}`);
});

/* API publica ----------------------------------------------------- */

publico.get('/api/publico/instituicao', (req, res) => {
  res.json({ instituicao: config.instituicao, baseUrl: config.baseUrl });
});

publico.get('/api/publico/validar/:codigo', limiteConsulta, assincrono(async (req, res) => {
  const codigo = normalizarCodigo(req.params.codigo);
  if (!codigo) {
    return res.status(400).json({
      encontrado: false,
      situacao: 'codigo_invalido',
      erro: 'Codigo em formato invalido. O formato correto e UNIVC-XXXX-XXXX-XXXX.',
    });
  }
  const resultado = await certs.validarPorCodigo(codigo);
  if (!resultado.encontrado) return res.status(404).json(resultado);

  res.json({
    ...resultado,
    instituicao: config.instituicao,
    consultadoEm: new Date().toISOString(),
    linkPdf:
      resultado.certificado.temPdf && resultado.situacao !== 'revogado'
        ? config.entregaPdf === 'drive' && resultado.certificado.arquivoLink
          ? resultado.certificado.arquivoLink
          : `/api/publico/certificado/${encodeURIComponent(codigo)}/pdf`
        : null,
  });
}));

/** Entrega o PDF original a quem tem o codigo (o Drive continua privado). */
publico.get('/api/publico/certificado/:codigo/pdf', limiteConsulta, assincrono(async (req, res) => {
  const codigo = normalizarCodigo(req.params.codigo);
  if (!codigo) return res.status(400).send('Codigo invalido.');

  const certificado = await db.acharCertificadoPorCodigo(codigo);
  if (!certificado) return res.status(404).send('Certificado nao encontrado.');
  if (certificado.status === 'revogado') {
    return res.status(410).send('Este certificado foi revogado e nao pode mais ser baixado.');
  }
  const pdf = await certs.baixarPdf(certificado);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${certificado.arquivoNome ?? `${codigo}.pdf`}"`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(pdf);
}));

export default publico;
