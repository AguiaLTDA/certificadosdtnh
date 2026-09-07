/**
 * "Vocalizacao" = o texto que o certificado declara.
 *
 * O usuario escreve um modelo com marcadores {{...}} e a plataforma substitui
 * pelos dados reais do participante e do evento no momento da emissao.
 */
import { config } from '../config.js';
import {
  cargaHorariaPorExtenso,
  dataCurta,
  dataPorExtenso,
  formatarCpf,
  mascararDocumento,
  periodoPorExtenso,
} from './util.js';

/** Catalogo exibido no painel, ao lado do editor de texto. */
export const MARCADORES = [
  { chave: 'nome', descricao: 'Nome completo do participante' },
  { chave: 'papel', descricao: 'Participante, palestrante, monitor, organizador...' },
  { chave: 'documento', descricao: 'CPF/documento formatado' },
  { chave: 'documentoMascarado', descricao: 'CPF parcialmente oculto (***.456.789-**)' },
  { chave: 'email', descricao: 'E-mail do participante' },
  { chave: 'tema', descricao: 'Tema/titulo do evento' },
  { chave: 'subtitulo', descricao: 'Subtitulo do evento' },
  { chave: 'modalidade', descricao: 'Presencial, online ou hibrido' },
  { chave: 'cargaHoraria', descricao: 'Carga horaria por extenso: 45 (quarenta e cinco) horas' },
  { chave: 'cargaHorariaNumero', descricao: 'Carga horaria so em numero: 45' },
  { chave: 'periodo', descricao: 'Periodo por extenso: de 14 a 16 de marco de 2026' },
  { chave: 'dataInicio', descricao: 'Data inicial por extenso' },
  { chave: 'dataFim', descricao: 'Data final por extenso' },
  { chave: 'dataInicioCurta', descricao: 'Data inicial em 00/00/0000' },
  { chave: 'dataFimCurta', descricao: 'Data final em 00/00/0000' },
  { chave: 'local', descricao: 'Local de realizacao' },
  { chave: 'cidade', descricao: 'Cidade/UF' },
  { chave: 'instituicao', descricao: 'Nome da instituicao' },
  { chave: 'instituicaoSigla', descricao: 'Sigla da instituicao (UNIVC)' },
  { chave: 'observacao', descricao: 'Observacao livre do certificado' },
  { chave: 'codigo', descricao: 'Codigo de autenticacao' },
  { chave: 'urlValidacao', descricao: 'Endereco de validacao do certificado' },
];

export function montarContexto({ certificado, evento, urlValidacao }) {
  const cidade = evento?.cidade || `${config.instituicao.cidade}/${config.instituicao.uf}`;
  return {
    nome: certificado?.nome ?? '',
    papel: certificado?.papel || 'participante',
    documento: formatarCpf(certificado?.documento),
    documentoMascarado: mascararDocumento(certificado?.documento),
    email: certificado?.email ?? '',
    tema: evento?.tema ?? '',
    subtitulo: evento?.subtitulo ?? '',
    modalidade: evento?.modalidade ?? '',
    cargaHoraria: cargaHorariaPorExtenso(certificado?.cargaHoraria ?? evento?.cargaHoraria),
    cargaHorariaNumero: String(certificado?.cargaHoraria ?? evento?.cargaHoraria ?? ''),
    periodo: periodoPorExtenso(evento?.dataInicio, evento?.dataFim),
    dataInicio: dataPorExtenso(evento?.dataInicio),
    dataFim: dataPorExtenso(evento?.dataFim),
    dataInicioCurta: dataCurta(evento?.dataInicio),
    dataFimCurta: dataCurta(evento?.dataFim),
    local: evento?.local || cidade,
    cidade,
    instituicao: config.instituicao.nome,
    instituicaoSigla: config.instituicao.sigla,
    observacao: certificado?.observacao ?? '',
    codigo: certificado?.codigo ?? '',
    urlValidacao: urlValidacao ?? `${config.baseUrl}/validar`,
  };
}

/** Substitui {{marcadores}} e limpa espacos/virgulas orfaos de campos vazios. */
export function aplicar(modelo, contexto) {
  const bruto = String(modelo ?? '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (todo, chave) => {
    const valor = contexto[chave];
    return valor === undefined || valor === null ? '' : String(valor);
  });
  return bruto
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*\./g, '.')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/** Pre-visualizacao com dados ficticios, usada no painel. */
export function exemploContexto(evento) {
  return montarContexto({
    certificado: {
      nome: 'Maria Aparecida de Souza',
      documento: '12345678900',
      email: 'maria.souza@exemplo.com',
      papel: 'participante',
      cargaHoraria: evento?.cargaHoraria ?? 20,
      codigo: 'UNIVC-A1B2-C3D4-E5F6',
      observacao: '',
    },
    evento: evento ?? {
      tema: 'Semana Academica de Inovacao',
      subtitulo: 'Tecnologia, sociedade e futuro',
      cargaHoraria: 20,
      dataInicio: '2026-03-14',
      dataFim: '2026-03-16',
      local: 'Campus Sede',
      modalidade: 'Presencial',
    },
    urlValidacao: `${config.baseUrl}/validar/UNIVC-A1B2-C3D4-E5F6`,
  });
}
