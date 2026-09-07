/**
 * Leitura de listas de participantes em CSV (o formato que sai do Excel,
 * do Google Forms e da maioria dos sistemas academicos).
 *
 * Aceita separador virgula ou ponto-e-virgula, aspas, BOM e quebras \r\n.
 */
import { normalizar } from './db.js';

function detectarSeparador(primeiraLinha) {
  const ponto = (primeiraLinha.match(/;/g) || []).length;
  const virgula = (primeiraLinha.match(/,/g) || []).length;
  const tab = (primeiraLinha.match(/\t/g) || []).length;
  if (tab > ponto && tab > virgula) return '\t';
  return ponto > virgula ? ';' : ',';
}

/** Parser RFC 4180 simplificado. */
export function lerCsv(textoBruto) {
  const texto = String(textoBruto ?? '').replace(/^﻿/, '');
  if (!texto.trim()) return [];
  const sep = detectarSeparador(texto.split(/\r?\n/, 1)[0] ?? '');

  const linhas = [];
  let campo = '';
  let linha = [];
  let entreAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          entreAspas = false;
        }
      } else {
        campo += c;
      }
      continue;
    }
    if (c === '"') {
      entreAspas = true;
    } else if (c === sep) {
      linha.push(campo);
      campo = '';
    } else if (c === '\n') {
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else if (c !== '\r') {
      campo += c;
    }
  }
  linha.push(campo);
  linhas.push(linha);

  return linhas.filter((l) => l.some((v) => String(v).trim() !== ''));
}

const APELIDOS = {
  nome: ['nome', 'nome completo', 'participante', 'aluno', 'nome do participante', 'name', 'nome do aluno'],
  documento: ['cpf', 'documento', 'doc', 'rg', 'cpf/cnpj', 'identificacao', 'matricula'],
  email: ['email', 'e-mail', 'e mail', 'correio eletronico', 'endereco de email'],
  papel: ['papel', 'funcao', 'condicao', 'categoria', 'tipo', 'participacao', 'perfil'],
  cargaHoraria: ['carga horaria', 'ch', 'horas', 'carga', 'carga horaria (h)', 'cargahoraria'],
  observacao: ['observacao', 'obs', 'observacoes', 'nota', 'complemento'],
};

function mapearCabecalho(cabecalho) {
  const mapa = {};
  cabecalho.forEach((bruto, indice) => {
    const titulo = normalizar(bruto);
    for (const [campo, nomes] of Object.entries(APELIDOS)) {
      if (nomes.includes(titulo)) {
        if (mapa[campo] === undefined) mapa[campo] = indice;
        return;
      }
    }
  });
  return mapa;
}

/**
 * Converte o CSV em participantes.
 * Se nao houver cabecalho reconhecivel, assume: nome, documento, email, papel.
 */
export function lerParticipantes(textoBruto) {
  const linhas = lerCsv(textoBruto);
  if (!linhas.length) return { participantes: [], colunasReconhecidas: [], avisos: ['Arquivo vazio.'] };

  const mapa = mapearCabecalho(linhas[0]);
  const temCabecalho = mapa.nome !== undefined;
  const avisos = [];
  let corpo = linhas;
  let posicoes = mapa;

  if (temCabecalho) {
    corpo = linhas.slice(1);
  } else {
    posicoes = { nome: 0, documento: 1, email: 2, papel: 3 };
    avisos.push(
      'Nenhum cabecalho reconhecido. Assumindo a ordem: nome, documento, e-mail, papel. ' +
        'Para evitar erros, use um cabecalho com as colunas nome;cpf;email;papel;carga horaria.'
    );
  }

  const participantes = corpo
    .map((linha) => {
      const pega = (campo) => {
        const i = posicoes[campo];
        return i === undefined ? '' : String(linha[i] ?? '').trim();
      };
      return {
        nome: pega('nome'),
        documento: pega('documento'),
        email: pega('email'),
        papel: pega('papel'),
        cargaHoraria: pega('cargaHoraria'),
        observacao: pega('observacao'),
      };
    })
    .filter((p) => p.nome);

  return {
    participantes,
    colunasReconhecidas: Object.keys(posicoes),
    avisos,
  };
}

/** Exporta os certificados de um evento como CSV (relatorio). */
export function gerarCsv(linhas, colunas) {
  const escapar = (v) => {
    const t = String(v ?? '');
    return /[",;\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const cabecalho = colunas.map((c) => escapar(c.titulo)).join(';');
  const corpo = linhas.map((l) => colunas.map((c) => escapar(c.valor(l))).join(';'));
  return `﻿${[cabecalho, ...corpo].join('\r\n')}`;
}
