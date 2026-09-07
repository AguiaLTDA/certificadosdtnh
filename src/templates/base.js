/**
 * Primitivas de desenho compartilhadas pelos layouts de certificado.
 * Tudo aqui e vetorial (sem imagens externas), exceto o logotipo e o QR Code.
 */
import brand from '../brand/univc.js';

export const PAGINAS = {
  A4: [841.89, 595.28], // paisagem
};

export function dimensoes(tema) {
  const [a, b] = PAGINAS.A4;
  return tema.orientacao === 'retrato' ? { largura: b, altura: a } : { largura: a, altura: b };
}

/** Mistura o tema salvo no evento com a paleta institucional. */
export function resolverTema(temaEvento = {}) {
  const p = brand.paleta;
  return {
    templateId: temaEvento.templateId || 'classico',
    orientacao: temaEvento.orientacao || 'paisagem',
    corPrimaria: temaEvento.corPrimaria || p.primaria,
    corSecundaria: temaEvento.corSecundaria || p.secundaria,
    corDestaque: temaEvento.corDestaque || p.destaque,
    corTexto: temaEvento.corTexto || p.texto,
    corTextoClaro: temaEvento.corTextoClaro || p.textoClaro,
    corPapel: temaEvento.corPapel || p.papel,
    marcaDagua: temaEvento.marcaDagua !== false,
    ornamentos: temaEvento.ornamentos !== false,
    tamanhoNome: Number(temaEvento.tamanhoNome) || 0, // 0 = automatico
    fontes: { ...brand.fontes, ...(temaEvento.fontes || {}) },
  };
}

/* ------------------------------------------------------------------ */
/* Fundo, molduras e ornamentos                                        */
/* ------------------------------------------------------------------ */

export function fundo(doc, t) {
  const { largura, altura } = dimensoes(t);
  doc.save().rect(0, 0, largura, altura).fill(t.corPapel).restore();
}

export function molduraDupla(doc, t, margem = 26) {
  const { largura, altura } = dimensoes(t);
  doc.save();
  doc
    .lineWidth(2.4)
    .strokeColor(t.corPrimaria)
    .rect(margem, margem, largura - margem * 2, altura - margem * 2)
    .stroke();
  doc
    .lineWidth(0.7)
    .strokeColor(t.corDestaque)
    .rect(margem + 7, margem + 7, largura - (margem + 7) * 2, altura - (margem + 7) * 2)
    .stroke();
  doc.restore();
}

export function cantosOrnamentados(doc, t, margem = 26, tamanho = 34) {
  const { largura, altura } = dimensoes(t);
  const m = margem + 7;
  const cantos = [
    [m, m, 1, 1],
    [largura - m, m, -1, 1],
    [m, altura - m, 1, -1],
    [largura - m, altura - m, -1, -1],
  ];
  doc.save().lineWidth(2).strokeColor(t.corDestaque);
  for (const [x, y, sx, sy] of cantos) {
    doc
      .moveTo(x + sx * 4, y + sy * tamanho)
      .lineTo(x + sx * 4, y + sy * 4)
      .lineTo(x + sx * tamanho, y + sy * 4)
      .stroke();
  }
  doc.restore();
}

export function faixaLateral(doc, t, larguraFaixa = 46) {
  const { altura } = dimensoes(t);
  doc.save();
  doc.rect(0, 0, larguraFaixa, altura).fill(t.corPrimaria);
  doc.rect(larguraFaixa, 0, 5, altura).fill(t.corDestaque);
  doc.restore();
}

export function faixaTopo(doc, t, alturaFaixa = 12) {
  const { largura, altura } = dimensoes(t);
  doc.save();
  doc.rect(0, 0, largura, alturaFaixa).fill(t.corPrimaria);
  doc.rect(0, altura - alturaFaixa, largura, alturaFaixa).fill(t.corDestaque);
  doc.restore();
}

export function marcaDagua(doc, t, texto) {
  if (!t.marcaDagua || !texto) return;
  const { largura, altura } = dimensoes(t);
  doc.save();
  doc.opacity(0.05);
  doc.fillColor(t.corPrimaria).font(t.fontes.titulo).fontSize(160);
  const largTexto = doc.widthOfString(texto);
  doc.rotate(-28, { origin: [largura / 2, altura / 2] });
  doc.text(texto, largura / 2 - largTexto / 2, altura / 2 - 90, { lineBreak: false });
  doc.restore();
}

/** Rosacea discreta usada como selo de conferencia. */
export function selo(doc, t, cx, cy, raio = 34, sigla = '') {
  doc.save();
  doc.lineWidth(1).strokeColor(t.corDestaque);
  doc.circle(cx, cy, raio).stroke();
  doc.circle(cx, cy, raio - 5).stroke();
  doc.lineWidth(0.6);
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2;
    doc
      .moveTo(cx + Math.cos(ang) * (raio - 5), cy + Math.sin(ang) * (raio - 5))
      .lineTo(cx + Math.cos(ang) * (raio - 10), cy + Math.sin(ang) * (raio - 10))
      .stroke();
  }
  if (sigla) {
    doc.font(t.fontes.corpoNegrito).fontSize(raio * 0.26).fillColor(t.corPrimaria)
      .text(String(sigla).toUpperCase(), cx - raio, cy - raio * 0.30, {
        width: raio * 2, align: 'center', characterSpacing: 0.8, lineBreak: false,
      });
    doc.font(t.fontes.corpo).fontSize(raio * 0.155).fillColor(t.corTextoClaro)
      .text('DOCUMENTO', cx - raio, cy + raio * 0.02, {
        width: raio * 2, align: 'center', characterSpacing: 0.4, lineBreak: false,
      });
    doc.text('VERIFICAVEL', cx - raio, cy + raio * 0.24, {
      width: raio * 2, align: 'center', characterSpacing: 0.4, lineBreak: false,
    });
  }
  doc.restore();
}

/* ------------------------------------------------------------------ */
/* Logotipo                                                            */
/* ------------------------------------------------------------------ */

/**
 * Desenha o logotipo enviado pela instituicao; se nao houver, desenha um
 * brasao vetorial neutro com a sigla (nunca fica um espaco vazio).
 */
export function logotipo(doc, t, { x, y, largura, altura, buffer, sigla }) {
  if (buffer) {
    try {
      doc.image(buffer, x, y, { fit: [largura, altura], align: 'center', valign: 'center' });
      return;
    } catch {
      /* imagem invalida: cai no brasao vetorial */
    }
  }
  brasaoVetorial(doc, t, { x, y, largura, altura, sigla });
}

export function brasaoVetorial(doc, t, { x, y, largura, altura, sigla = 'UNIVC' }) {
  const l = Math.min(largura, altura * 0.85);
  const cx = x + largura / 2;
  const topo = y + (altura - l) / 2;
  doc.save();
  doc
    .moveTo(cx - l / 2, topo)
    .lineTo(cx + l / 2, topo)
    .lineTo(cx + l / 2, topo + l * 0.58)
    .quadraticCurveTo(cx + l / 2, topo + l, cx, topo + l)
    .quadraticCurveTo(cx - l / 2, topo + l, cx - l / 2, topo + l * 0.58)
    .closePath()
    .fillAndStroke(t.corPrimaria, t.corDestaque);
  doc
    .fillColor('#FFFFFF')
    .font(t.fontes.corpoNegrito)
    .fontSize(l * 0.26)
    .text(sigla, cx - l / 2, topo + l * 0.34, { width: l, align: 'center', lineBreak: false });
  doc.restore();
}

/* ------------------------------------------------------------------ */
/* Texto                                                               */
/* ------------------------------------------------------------------ */

export function textoCentral(doc, texto, { x, y, largura, fonte, tamanho, cor, espaco = 0, maiuscula = false }) {
  doc.save();
  doc.font(fonte).fontSize(tamanho).fillColor(cor);
  const conteudo = maiuscula ? String(texto).toUpperCase() : String(texto);
  doc.text(conteudo, x, y, { width: largura, align: 'center', characterSpacing: espaco });
  const fim = doc.y;
  doc.restore();
  return fim;
}

/**
 * Escreve o texto reduzindo a fonte ate caber na altura disponivel.
 * Evita que uma vocalizacao longa estoure o layout.
 */
export function textoAjustado(doc, texto, opcoes) {
  const {
    x, y, largura, alturaMax, fonte, tamanhoMax, tamanhoMin,
    cor, align = 'center', entrelinha = 1.35,
  } = opcoes;
  doc.save();
  doc.font(fonte).fillColor(cor);
  let tamanho = tamanhoMax;
  let altura = 0;
  while (tamanho > tamanhoMin) {
    doc.fontSize(tamanho);
    altura = doc.heightOfString(texto, { width: largura, align, lineGap: tamanho * (entrelinha - 1) });
    if (altura <= alturaMax) break;
    tamanho -= 0.5;
  }
  doc.fontSize(tamanho);
  doc.text(texto, x, y, { width: largura, align, lineGap: tamanho * (entrelinha - 1) });
  const fim = doc.y;
  doc.restore();
  return { fim, tamanho, altura };
}

/** Nome do participante: reduz a fonte se o nome for muito longo. */
export function nomeParticipante(doc, nome, { x, y, largura, fonte, cor, tamanhoBase = 34, minimo = 18 }) {
  doc.save();
  doc.font(fonte).fillColor(cor);
  let tamanho = tamanhoBase;
  while (tamanho > minimo) {
    doc.fontSize(tamanho);
    if (doc.widthOfString(nome) <= largura) break;
    tamanho -= 1;
  }
  doc.fontSize(tamanho);
  doc.text(nome, x, y, { width: largura, align: 'center' });
  const fim = doc.y;
  doc.restore();
  return fim;
}

/**
 * Bloco central do certificado: texto antes do nome, nome em destaque e texto
 * depois do nome, medido e centralizado verticalmente na area disponivel.
 *
 * Sem isso o conteudo fica colado no topo e sobra um vazio antes das
 * assinaturas quando o texto e curto.
 */
export function blocoCorpo(doc, t, cfg) {
  const {
    x, largura, topo, base,
    antes, nome, depois,
    fonteAntes, tamAntes = 11.5, corAntes,
    fonteNome, tamNome = 33, minNome = 18, corNome,
    fonteDepois, tamDepois = 11.5, minDepois = 8, corDepois,
    larguraDepois = largura, recuoDepois = 0,
    align = 'center', fileteNome = true, larguraFilete = 300,
    entrelinha = 1.35,
    espacoAntes = 6, espacoNome = 18,
  } = cfg;

  const regiao = Math.max(60, base - topo);

  // --- medicao ---
  let alturaAntes = 0;
  if (antes) {
    doc.font(fonteAntes).fontSize(tamAntes);
    alturaAntes = doc.heightOfString(antes, { width: largura, align }) + espacoAntes;
  }

  doc.font(fonteNome);
  let tamanhoNome = tamNome;
  while (tamanhoNome > minNome) {
    doc.fontSize(tamanhoNome);
    if (doc.widthOfString(nome) <= largura) break;
    tamanhoNome -= 1;
  }
  doc.fontSize(tamanhoNome);
  const alturaNome = doc.heightOfString(nome, { width: largura, align }) + espacoNome;

  doc.font(fonteDepois);
  let tamanhoDepois = tamDepois;
  let alturaDepois = 0;
  const alturaLivreDepois = Math.max(40, regiao - alturaAntes - alturaNome);
  while (tamanhoDepois > minDepois) {
    doc.fontSize(tamanhoDepois);
    alturaDepois = doc.heightOfString(depois, {
      width: larguraDepois, align, lineGap: tamanhoDepois * (entrelinha - 1),
    });
    if (alturaDepois <= alturaLivreDepois) break;
    tamanhoDepois -= 0.5;
  }

  const total = alturaAntes + alturaNome + alturaDepois;
  let y = topo + Math.max(0, (regiao - total) / 2);

  // --- desenho ---
  if (antes) {
    doc.save();
    doc.font(fonteAntes).fontSize(tamAntes).fillColor(corAntes || t.corTexto)
      .text(antes, x, y, { width: largura, align });
    doc.restore();
    y += alturaAntes;
  }

  doc.save();
  doc.font(fonteNome).fontSize(tamanhoNome).fillColor(corNome || t.corPrimaria)
    .text(nome, x, y, { width: largura, align });
  doc.restore();
  const baseNome = y + alturaNome - espacoNome;
  if (fileteNome) {
    const inicioFilete = align === 'left' ? x : x + (largura - larguraFilete) / 2;
    linhaFina(doc, t, { x: inicioFilete, y: baseNome + 6, largura: larguraFilete, cor: t.corDestaque });
  }
  y += alturaNome;

  doc.save();
  doc.font(fonteDepois).fontSize(tamanhoDepois).fillColor(corDepois || t.corTexto)
    .text(depois, x + recuoDepois, y, {
      width: larguraDepois, align, lineGap: tamanhoDepois * (entrelinha - 1),
    });
  const fim = doc.y;
  doc.restore();
  return fim;
}

export function linhaFina(doc, t, { x, y, largura, cor, espessura = 0.8 }) {
  doc.save().lineWidth(espessura).strokeColor(cor || t.corDestaque)
    .moveTo(x, y).lineTo(x + largura, y).stroke().restore();
}

/* ------------------------------------------------------------------ */
/* Assinaturas                                                         */
/* ------------------------------------------------------------------ */

/**
 * assinaturas: [{ nome, cargo, imagemBuffer? }]
 * Distribui ate 4 assinaturas em linha.
 */
export function blocoAssinaturas(doc, t, { assinaturas, y, x, largura }) {
  const lista = (assinaturas || []).filter((a) => a && (a.nome || a.cargo)).slice(0, 4);
  if (!lista.length) return y;
  const espacamento = largura / lista.length;
  const colunaLargura = Math.min(220, espacamento - 12);

  lista.forEach((assinatura, i) => {
    const centro = x + espacamento * i + espacamento / 2;
    const cx = centro - colunaLargura / 2;

    if (assinatura.imagemBuffer) {
      try {
        doc.image(assinatura.imagemBuffer, cx, y - 42, {
          fit: [colunaLargura, 38],
          align: 'center',
          valign: 'bottom',
        });
      } catch {
        /* ignora imagem invalida */
      }
    }
    doc.save().lineWidth(0.9).strokeColor(t.corTextoClaro)
      .moveTo(cx, y).lineTo(cx + colunaLargura, y).stroke().restore();

    doc.save();
    doc.font(t.fontes.corpoNegrito).fontSize(9.5).fillColor(t.corTexto)
      .text(assinatura.nome || '', cx, y + 5, { width: colunaLargura, align: 'center' });
    if (assinatura.cargo) {
      doc.font(t.fontes.corpo).fontSize(8).fillColor(t.corTextoClaro)
        .text(assinatura.cargo, cx, doc.y + 1, { width: colunaLargura, align: 'center' });
    }
    doc.restore();
  });
  return y + 46;
}

/* ------------------------------------------------------------------ */
/* Bloco de autenticacao (QR Code + codigo)                            */
/* ------------------------------------------------------------------ */

/**
 * Bloco obrigatorio em todos os layouts: QR Code + codigo + endereco de
 * validacao. E o que torna o certificado verificavel.
 */
export function blocoAutenticacao(doc, t, opcoes) {
  const {
    x, y, largura, qrBuffer, codigo, urlValidacao,
    seloCurto, alinhamento = 'esquerda',
  } = opcoes;
  const ladoQr = 62;
  const qrX = alinhamento === 'direita' ? x + largura - ladoQr : x;
  const textoX = alinhamento === 'direita' ? x : x + ladoQr + 10;
  const textoLargura = largura - ladoQr - 10;
  const align = alinhamento === 'direita' ? 'right' : 'left';

  if (qrBuffer) {
    doc.save();
    doc.rect(qrX - 3, y - 3, ladoQr + 6, ladoQr + 6).fill('#FFFFFF');
    doc.lineWidth(0.6).strokeColor(t.corTextoClaro).rect(qrX - 3, y - 3, ladoQr + 6, ladoQr + 6).stroke();
    doc.image(qrBuffer, qrX, y, { fit: [ladoQr, ladoQr] });
    doc.restore();
  }

  doc.save();
  doc.font(t.fontes.corpoNegrito).fontSize(7.5).fillColor(t.corPrimaria)
    .text('AUTENTICACAO E VALIDACAO', textoX, y, { width: textoLargura, align, characterSpacing: 0.6 });

  doc.font(t.fontes.corpoNegrito).fontSize(10).fillColor(t.corTexto)
    .text(codigo, textoX, doc.y + 1.5, { width: textoLargura, align });

  const rodape = seloCurto
    ? 'Confira a autenticidade em ' + urlValidacao + '\nSelo digital: ' + seloCurto
    : 'Confira a autenticidade em ' + urlValidacao;

  doc.font(t.fontes.corpo).fontSize(6.8).fillColor(t.corTextoClaro)
    .text(rodape, textoX, doc.y + 1.5, { width: textoLargura, align, lineGap: 1 });
  doc.restore();
  return y + ladoQr;
}

export function rodapeInstitucional(doc, t, { x, y, largura, linhas, align = 'center' }) {
  doc.save();
  doc.font(t.fontes.corpo).fontSize(6.8).fillColor(t.corTextoClaro)
    .text(linhas.filter(Boolean).join('   |   '), x, y, { width: largura, align, lineGap: 1 });
  doc.restore();
}
