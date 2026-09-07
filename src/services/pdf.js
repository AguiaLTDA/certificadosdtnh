/**
 * Montagem do PDF do certificado.
 *
 * Fluxo: dados do certificado + evento -> vocalizacao renderizada -> QR Code
 * -> layout escolhido -> Buffer PDF.
 */
import PDFDocument from 'pdfkit';
import { config } from '../config.js';
import brand from '../brand/univc.js';
import { dimensoes, resolverTema } from '../templates/base.js';
import { obterLayout } from '../templates/layouts.js';
import { aplicar, montarContexto } from './vocalizacao.js';
import { gerarQrCode } from './qr.js';
import { seloCurto } from './codigo.js';
import { dataPorExtenso, limitar } from './util.js';

export function urlValidacaoDe(codigo) {
  return `${config.baseUrl}/validar/${encodeURIComponent(codigo)}`;
}

/**
 * Separa a vocalizacao em "antes do nome" e "depois do nome" para que o nome
 * do participante possa ser impresso em destaque, sem o usuario precisar
 * escrever o texto em partes.
 */
export function dividirVocalizacao(texto, nome) {
  const completo = String(texto ?? '').trim();
  const alvo = String(nome ?? '').trim();
  if (!alvo) return { antes: '', depois: completo };

  const pos = completo.indexOf(alvo);
  if (pos < 0) return { antes: '', depois: completo };

  const antes = completo.slice(0, pos).replace(/[\s,;:]+$/, '').trim();
  const depois = completo
    .slice(pos + alvo.length)
    .replace(/^[\s,;:]+/, '')
    .trim();
  return { antes, depois };
}

function primeiraLetraMaiuscula(texto) {
  const t = String(texto ?? '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/**
 * @param {object} args
 * @param {object} args.certificado
 * @param {object} args.evento
 * @param {Buffer|null} args.logoBuffer
 * @param {Array<{nome,cargo,imagemBuffer?}>} args.assinaturas
 * @returns {Promise<Buffer>}
 */
export async function gerarPdfCertificado({ certificado, evento, logoBuffer = null, assinaturas = [] }) {
  const tema = resolverTema(evento?.temaVisual ?? {});
  const layout = obterLayout(tema.templateId);
  const urlValidacao = urlValidacaoDe(certificado.codigo);

  const contexto = montarContexto({ certificado, evento, urlValidacao });
  const textoCompleto = aplicar(evento?.vocalizacao || brand.vocalizacaoPadrao, contexto);
  const destacar = evento?.destacarNome !== false;
  const partes = destacar
    ? dividirVocalizacao(textoCompleto, certificado.nome)
    : { antes: '', depois: textoCompleto };

  const qrBuffer = await gerarQrCode(urlValidacao, { cor: tema.corPrimaria });

  const cidadeData = evento?.ocultarCidadeData
    ? ''
    : `${evento?.cidade || `${config.instituicao.cidade}/${config.instituicao.uf}`}, ${dataPorExtenso(
        certificado.emitidoEm?.slice(0, 10) || new Date().toISOString().slice(0, 10)
      )}.`;

  const dados = {
    titulo: evento?.tituloCertificado || 'Certificado',
    subtitulo: evento?.subtituloCertificado || evento?.tipo || '',
    nome: certificado.nome,
    antes: primeiraLetraMaiuscula(partes.antes),
    depois: partes.depois || textoCompleto,
    textoCompleto,
    cidadeData,
    assinaturas: assinaturas.length ? assinaturas : evento?.assinaturas ?? [],
    logoBuffer,
    qrBuffer,
    codigo: certificado.codigo,
    urlValidacao,
    seloCurto: seloCurto(certificado.selo),
    nomeInstituicao: config.instituicao.nome,
    siglaInstituicao: config.instituicao.sigla,
    mantenedora: config.instituicao.mantenedora,
    rodape: [
      config.instituicao.site,
      config.instituicao.cnpj ? `CNPJ ${config.instituicao.cnpj}` : '',
      config.instituicao.credenciamento || '',
      `Registro ${certificado.codigo}`,
    ],
  };

  const { largura, altura } = dimensoes(tema);
  const doc = new PDFDocument({
    size: [largura, altura],
    margin: 0,
    autoFirstPage: true,
    info: {
      Title: `Certificado ${certificado.codigo} - ${certificado.nome}`,
      Author: config.instituicao.nome,
      Subject: limitar(evento?.tema ?? '', 180),
      Keywords: `certificado, ${config.instituicao.sigla}, ${certificado.codigo}`,
      Creator: `Plataforma de Certificados ${config.instituicao.sigla}`,
    },
  });

  const pedacos = [];
  doc.on('data', (c) => pedacos.push(c));
  const finalizado = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(pedacos)));
    doc.on('error', reject);
  });

  layout.desenhar(doc, tema, dados);

  if (evento?.conteudoProgramatico?.trim()) {
    desenharVerso(doc, tema, dados, evento);
  }

  doc.end();
  return finalizado;
}

/** Pagina 2 opcional: conteudo programatico / programacao do evento. */
function desenharVerso(doc, tema, dados, evento) {
  const { largura, altura } = dimensoes(tema);
  const margem = 62;
  const larguraUtil = largura - margem * 2;

  doc.addPage({ size: [largura, altura], margin: 0 });
  doc.save().rect(0, 0, largura, altura).fill(tema.corPapel).restore();
  doc.save().rect(0, 0, largura, 6).fill(tema.corPrimaria).restore();

  doc.save();
  doc.font(tema.fontes.corpoNegrito).fontSize(13).fillColor(tema.corPrimaria)
    .text('CONTEUDO PROGRAMATICO', margem, 54, { width: larguraUtil, characterSpacing: 2 });
  doc.font(tema.fontes.corpo).fontSize(9.5).fillColor(tema.corTextoClaro)
    .text(evento.tema ?? '', margem, doc.y + 4, { width: larguraUtil });
  doc.restore();

  doc.save().lineWidth(0.8).strokeColor(tema.corDestaque)
    .moveTo(margem, 100).lineTo(margem + 120, 100).stroke().restore();

  doc.save();
  doc.font(tema.fontes.corpo).fontSize(10).fillColor(tema.corTexto)
    .text(evento.conteudoProgramatico.trim(), margem, 118, {
      width: larguraUtil, align: 'left', lineGap: 3.5,
    });
  doc.restore();

  doc.save();
  doc.font(tema.fontes.corpo).fontSize(7).fillColor(tema.corTextoClaro)
    .text(
      `Anexo ao certificado ${dados.codigo} - ${dados.nome}. Validacao em ${dados.urlValidacao}`,
      margem, altura - 46, { width: larguraUtil, align: 'center' }
    );
  doc.restore();
}

/** PDF de demonstracao usado na pre-visualizacao do painel. */
export async function gerarPdfExemplo({ evento, logoBuffer = null }) {
  const agora = new Date().toISOString();
  const certificado = {
    codigo: 'UNIVC-A1B2-C3D4-E5F6',
    nome: 'Maria Aparecida de Souza Nascimento',
    documento: '12345678900',
    email: 'maria.souza@exemplo.com',
    papel: 'participante',
    cargaHoraria: evento?.cargaHoraria ?? 20,
    emitidoEm: agora,
    selo: '0'.repeat(64),
    eventoId: evento?.id ?? 'exemplo',
    observacao: '',
  };
  return gerarPdfCertificado({ certificado, evento, logoBuffer });
}
