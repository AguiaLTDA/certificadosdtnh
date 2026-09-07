/**
 * Layouts de certificado.
 *
 * Todos recebem o mesmo objeto `dados` e desenham uma pagina completa.
 * Regra fixa da plataforma: TODO layout imprime o bloco de autenticacao
 * (QR Code + codigo + endereco de validacao).
 */
import * as b from './base.js';

/* ------------------------------------------------------------------ *
 * 1. Classico - moldura dupla, tipografia serifada, selo ornamental
 * ------------------------------------------------------------------ */
function classico(doc, t, d) {
  const { largura, altura } = b.dimensoes(t);
  const margem = 62;
  const x = margem;
  const larguraUtil = largura - margem * 2;

  b.fundo(doc, t);
  b.molduraDupla(doc, t, 26);
  if (t.ornamentos) b.cantosOrnamentados(doc, t, 26);
  b.marcaDagua(doc, t, d.siglaInstituicao);

  // Cabecalho
  b.logotipo(doc, t, {
    x: largura / 2 - 78, y: 46, largura: 156, altura: 48,
    buffer: d.logoBuffer, sigla: d.siglaInstituicao,
  });
  b.textoCentral(doc, d.nomeInstituicao, {
    x, y: 100, largura: larguraUtil,
    fonte: t.fontes.corpoNegrito, tamanho: 9.5, cor: t.corPrimaria, espaco: 1.4, maiuscula: true,
  });
  if (d.mantenedora) {
    b.textoCentral(doc, d.mantenedora, {
      x, y: 113, largura: larguraUtil,
      fonte: t.fontes.corpo, tamanho: 7.5, cor: t.corTextoClaro, espaco: 0.6,
    });
  }

  // Titulo
  b.textoCentral(doc, d.titulo, {
    x, y: 136, largura: larguraUtil,
    fonte: t.fontes.titulo, tamanho: 32, cor: t.corPrimaria, espaco: 7, maiuscula: true,
  });
  if (d.subtitulo) {
    b.textoCentral(doc, d.subtitulo, {
      x, y: 176, largura: larguraUtil,
      fonte: t.fontes.subtitulo, tamanho: 10.5, cor: t.corDestaque, espaco: 3.2, maiuscula: true,
    });
  }
  b.linhaFina(doc, t, { x: largura / 2 - 70, y: 196, largura: 140 });

  // Corpo (medido e centralizado entre o filete e a linha de cidade/data)
  b.blocoCorpo(doc, t, {
    x, largura: larguraUtil, topo: 206, base: altura - 182,
    antes: d.antes, nome: d.nome, depois: d.depois,
    fonteAntes: t.fontes.corpoItalico, tamAntes: 11.5, corAntes: t.corTexto,
    fonteNome: t.fontes.nome, tamNome: t.tamanhoNome || 33, corNome: t.corPrimaria,
    fonteDepois: t.fontes.corpo, tamDepois: 11.5,
    larguraDepois: larguraUtil - 36, recuoDepois: 18,
    larguraFilete: 300,
  });

  // Rodape ancorado na base
  if (d.cidadeData) {
    b.textoCentral(doc, d.cidadeData, {
      x, y: altura - 172, largura: larguraUtil,
      fonte: t.fontes.corpo, tamanho: 9.5, cor: t.corTextoClaro,
    });
  }
  b.blocoAssinaturas(doc, t, { assinaturas: d.assinaturas, y: altura - 138, x: x + 40, largura: larguraUtil - 80 });

  b.blocoAutenticacao(doc, t, {
    x, y: altura - 108, largura: larguraUtil * 0.52,
    qrBuffer: d.qrBuffer, codigo: d.codigo, urlValidacao: d.urlValidacao, seloCurto: d.seloCurto,
  });
  if (t.ornamentos) b.selo(doc, t, largura - margem - 42, altura - 76, 34, d.siglaInstituicao);

  b.rodapeInstitucional(doc, t, {
    x, y: altura - 42, largura: larguraUtil, linhas: d.rodape, align: 'center',
  });
}

/* ------------------------------------------------------------------ *
 * 2. Moderno - faixa lateral, alinhamento a esquerda, sem serifa
 * ------------------------------------------------------------------ */
function moderno(doc, t, d) {
  const { largura, altura } = b.dimensoes(t);
  const faixa = 52;
  const x = faixa + 52;
  const larguraUtil = largura - x - 52;

  b.fundo(doc, t);
  b.faixaLateral(doc, t, faixa);
  b.marcaDagua(doc, t, d.siglaInstituicao);

  // Sigla vertical na faixa
  doc.save();
  doc.rotate(-90, { origin: [faixa / 2, altura / 2] });
  doc.font(t.fontes.corpoNegrito).fontSize(11).fillColor('#FFFFFF');
  doc.text(String(d.siglaInstituicao).toUpperCase(), faixa / 2 - 160, altura / 2 - 7, {
    width: 320, align: 'center', characterSpacing: 5, lineBreak: false,
  });
  doc.restore();

  // Cabecalho
  b.logotipo(doc, t, {
    x, y: 44, largura: 118, altura: 42, buffer: d.logoBuffer, sigla: d.siglaInstituicao,
  });
  doc.save();
  doc.font(t.fontes.corpoNegrito).fontSize(9).fillColor(t.corPrimaria)
    .text(String(d.nomeInstituicao).toUpperCase(), x + 132, 54, { width: larguraUtil - 132, characterSpacing: 1.2 });
  if (d.mantenedora) {
    doc.font(t.fontes.corpo).fontSize(7.5).fillColor(t.corTextoClaro)
      .text(d.mantenedora, x + 132, doc.y + 2, { width: larguraUtil - 132 });
  }
  doc.restore();

  // Titulo
  doc.save();
  doc.font(t.fontes.corpoNegrito).fontSize(38).fillColor(t.corPrimaria)
    .text(String(d.titulo).toUpperCase(), x, 118, { width: larguraUtil, characterSpacing: 2 });
  doc.restore();
  doc.save().rect(x, 168, 74, 5).fill(t.corDestaque).restore();
  if (d.subtitulo) {
    doc.save();
    doc.font(t.fontes.corpoNegrito).fontSize(10).fillColor(t.corSecundaria)
      .text(String(d.subtitulo).toUpperCase(), x, 184, { width: larguraUtil, characterSpacing: 2.6 });
    doc.restore();
  }

  // Corpo alinhado a esquerda, centralizado no espaco vertical livre
  b.blocoCorpo(doc, t, {
    x, largura: larguraUtil, topo: 208, base: altura - 176,
    antes: d.antes, nome: d.nome, depois: d.depois,
    align: 'left', fileteNome: false,
    fonteAntes: t.fontes.corpo, tamAntes: 11, corAntes: t.corTextoClaro,
    fonteNome: t.fontes.corpoNegrito, tamNome: t.tamanhoNome || 32, minNome: 16, corNome: t.corTexto,
    fonteDepois: t.fontes.corpo, tamDepois: 11,
    larguraDepois: larguraUtil * 0.94,
    espacoAntes: 4, espacoNome: 12,
  });

  // Base
  if (d.cidadeData) {
    doc.save();
    doc.font(t.fontes.corpo).fontSize(9).fillColor(t.corTextoClaro)
      .text(d.cidadeData, x, altura - 168, { width: larguraUtil });
    doc.restore();
  }
  b.blocoAssinaturas(doc, t, { assinaturas: d.assinaturas, y: altura - 136, x, largura: larguraUtil * 0.56 });
  b.blocoAutenticacao(doc, t, {
    x: x + larguraUtil * 0.58, y: altura - 132, largura: larguraUtil * 0.42,
    qrBuffer: d.qrBuffer, codigo: d.codigo, urlValidacao: d.urlValidacao,
    seloCurto: d.seloCurto, alinhamento: 'direita',
  });
  b.rodapeInstitucional(doc, t, {
    x, y: altura - 40, largura: larguraUtil, linhas: d.rodape, align: 'left',
  });
}

/* ------------------------------------------------------------------ *
 * 3. Minimalista - muito respiro, um filete, tipografia sem serifa
 * ------------------------------------------------------------------ */
function minimalista(doc, t, d) {
  const { largura, altura } = b.dimensoes(t);
  const margem = 78;
  const x = margem;
  const larguraUtil = largura - margem * 2;

  b.fundo(doc, t);
  doc.save().rect(0, 0, largura, 7).fill(t.corPrimaria).restore();

  b.logotipo(doc, t, {
    x: largura / 2 - 62, y: 48, largura: 124, altura: 38,
    buffer: d.logoBuffer, sigla: d.siglaInstituicao,
  });
  b.textoCentral(doc, d.nomeInstituicao, {
    x, y: 94, largura: larguraUtil,
    fonte: t.fontes.corpo, tamanho: 8.5, cor: t.corTextoClaro, espaco: 2.2, maiuscula: true,
  });

  b.textoCentral(doc, d.titulo, {
    x, y: 132, largura: larguraUtil,
    fonte: t.fontes.corpoNegrito, tamanho: 22, cor: t.corTexto, espaco: 9, maiuscula: true,
  });
  if (d.subtitulo) {
    b.textoCentral(doc, d.subtitulo, {
      x, y: 164, largura: larguraUtil,
      fonte: t.fontes.corpo, tamanho: 9, cor: t.corTextoClaro, espaco: 2.4, maiuscula: true,
    });
  }

  b.blocoCorpo(doc, t, {
    x, largura: larguraUtil, topo: 194, base: altura - 186,
    antes: d.antes, nome: d.nome, depois: d.depois,
    fileteNome: false,
    fonteAntes: t.fontes.corpo, tamAntes: 10.5, corAntes: t.corTextoClaro,
    fonteNome: t.fontes.corpoNegrito, tamNome: t.tamanhoNome || 30, minNome: 17, corNome: t.corPrimaria,
    fonteDepois: t.fontes.corpo, tamDepois: 10.5, entrelinha: 1.5,
    larguraDepois: larguraUtil - 60, recuoDepois: 30,
    espacoAntes: 8, espacoNome: 14,
  });

  if (d.cidadeData) {
    b.textoCentral(doc, d.cidadeData, {
      x, y: altura - 176, largura: larguraUtil,
      fonte: t.fontes.corpo, tamanho: 9, cor: t.corTextoClaro,
    });
  }
  b.blocoAssinaturas(doc, t, { assinaturas: d.assinaturas, y: altura - 142, x: x + 30, largura: larguraUtil - 60 });
  b.linhaFina(doc, t, { x, y: altura - 116, largura: larguraUtil, cor: t.corTextoClaro, espessura: 0.5 });
  b.blocoAutenticacao(doc, t, {
    x, y: altura - 104, largura: larguraUtil * 0.5,
    qrBuffer: d.qrBuffer, codigo: d.codigo, urlValidacao: d.urlValidacao, seloCurto: d.seloCurto,
  });
  b.rodapeInstitucional(doc, t, {
    x: largura / 2, y: altura - 40, largura: larguraUtil / 2, linhas: d.rodape, align: 'right',
  });
}

/* ------------------------------------------------------------------ *
 * 4. Institucional - faixas no topo e na base, formal
 * ------------------------------------------------------------------ */
function institucional(doc, t, d) {
  const { largura, altura } = b.dimensoes(t);
  const margem = 58;
  const x = margem;
  const larguraUtil = largura - margem * 2;

  b.fundo(doc, t);
  doc.save().rect(0, 0, largura, 74).fill(t.corPrimaria).restore();
  doc.save().rect(0, 74, largura, 4).fill(t.corDestaque).restore();
  doc.save().rect(0, altura - 26, largura, 26).fill(t.corPrimaria).restore();
  b.marcaDagua(doc, t, d.siglaInstituicao);

  b.logotipo(doc, t, {
    x: x, y: 16, largura: 108, altura: 44, buffer: d.logoBuffer, sigla: d.siglaInstituicao,
  });
  doc.save();
  doc.font(t.fontes.corpoNegrito).fontSize(11).fillColor('#FFFFFF')
    .text(String(d.nomeInstituicao).toUpperCase(), x + 124, 24, {
      width: larguraUtil - 124, characterSpacing: 1.4,
    });
  if (d.mantenedora) {
    doc.font(t.fontes.corpo).fontSize(8).fillColor('#D9E4EE')
      .text(d.mantenedora, x + 124, doc.y + 2, { width: larguraUtil - 124 });
  }
  doc.restore();

  b.textoCentral(doc, d.titulo, {
    x, y: 112, largura: larguraUtil,
    fonte: t.fontes.titulo, tamanho: 28, cor: t.corPrimaria, espaco: 5, maiuscula: true,
  });
  if (d.subtitulo) {
    b.textoCentral(doc, d.subtitulo, {
      x, y: 148, largura: larguraUtil,
      fonte: t.fontes.corpoNegrito, tamanho: 9.5, cor: t.corSecundaria, espaco: 2.8, maiuscula: true,
    });
  }

  b.blocoCorpo(doc, t, {
    x, largura: larguraUtil, topo: 176, base: altura - 184,
    antes: d.antes, nome: d.nome, depois: d.depois,
    fonteAntes: t.fontes.corpo, tamAntes: 11, corAntes: t.corTextoClaro,
    fonteNome: t.fontes.nome, tamNome: t.tamanhoNome || 31, minNome: 17, corNome: t.corTexto,
    fonteDepois: t.fontes.corpo, tamDepois: 11,
    larguraDepois: larguraUtil - 40, recuoDepois: 20,
    larguraFilete: 260,
  });

  if (d.cidadeData) {
    b.textoCentral(doc, d.cidadeData, {
      x, y: altura - 176, largura: larguraUtil,
      fonte: t.fontes.corpo, tamanho: 9.5, cor: t.corTextoClaro,
    });
  }
  b.blocoAssinaturas(doc, t, { assinaturas: d.assinaturas, y: altura - 142, x: x + 30, largura: larguraUtil - 60 });
  b.blocoAutenticacao(doc, t, {
    x, y: altura - 106, largura: larguraUtil * 0.55,
    qrBuffer: d.qrBuffer, codigo: d.codigo, urlValidacao: d.urlValidacao, seloCurto: d.seloCurto,
  });
  doc.save();
  doc.font(t.fontes.corpo).fontSize(6.6).fillColor('#FFFFFF')
    .text(d.rodape.filter(Boolean).join('   |   '), x, altura - 18, { width: larguraUtil, align: 'center' });
  doc.restore();
}

export const LAYOUTS = {
  classico: {
    id: 'classico',
    nome: 'Classico',
    descricao: 'Moldura dupla, tipografia serifada e selo ornamental. Uso formal.',
    desenhar: classico,
  },
  moderno: {
    id: 'moderno',
    nome: 'Moderno',
    descricao: 'Faixa lateral colorida, texto alinhado a esquerda, sem serifa.',
    desenhar: moderno,
  },
  minimalista: {
    id: 'minimalista',
    nome: 'Minimalista',
    descricao: 'Muito espaco em branco, um filete no topo, leitura limpa.',
    desenhar: minimalista,
  },
  institucional: {
    id: 'institucional',
    nome: 'Institucional',
    descricao: 'Cabecalho em faixa com o logotipo e rodape solido. Uso oficial.',
    desenhar: institucional,
  },
};

export function obterLayout(id) {
  return LAYOUTS[id] || LAYOUTS.classico;
}

export function listarLayouts() {
  return Object.values(LAYOUTS).map(({ id, nome, descricao }) => ({ id, nome, descricao }));
}
