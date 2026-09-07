/**
 * Identidade institucional do UNIVC.
 *
 * ATENCAO: as cores abaixo sao a paleta institucional padrao usada pela plataforma.
 * Se o manual de marca do UNIVC trouxer codigos diferentes, altere APENAS este arquivo
 * (ou sobrescreva por evento na aba "Tema" do painel) - nada mais precisa mudar.
 *
 * O logotipo oficial deve ser enviado pelo painel (Configuracoes > Identidade visual)
 * em PNG com fundo transparente. Enquanto nao houver logotipo enviado, o gerador
 * desenha um brasao vetorial neutro com a sigla.
 */

export const paletaUnivc = {
  primaria: '#00305B',      // azul institucional (fundo de faixas, titulos)
  secundaria: '#0A6EB4',    // azul de apoio (linhas, detalhes)
  destaque: '#C6A04E',      // dourado (selo, filetes, ornamentos)
  texto: '#1B2733',         // texto corrido
  textoClaro: '#5A6875',    // legendas, rodape
  papel: '#FFFFFF',         // fundo do certificado
  papelAlt: '#F5F8FB',      // fundo alternativo / marca d'agua
};

export const brand = {
  paleta: paletaUnivc,

  /** Fontes padrao (nucleo PDF, sem dependencia externa). */
  fontes: {
    titulo: 'Times-Bold',
    subtitulo: 'Times-Roman',
    corpo: 'Helvetica',
    corpoNegrito: 'Helvetica-Bold',
    corpoItalico: 'Helvetica-Oblique',
    nome: 'Times-BoldItalic',
  },

  /**
   * Texto padrao do certificado ("vocalizacao").
   * Marcadores disponiveis: ver src/services/vocalizacao.js
   */
  vocalizacaoPadrao:
    'Certificamos que {{nome}}, portador(a) do documento {{documento}}, ' +
    'participou na condicao de {{papel}} do evento {{tema}}, ' +
    'realizado {{periodo}}, em {{local}}, com carga horaria total de {{cargaHoraria}}.',

  vocalizacoesSugeridas: [
    {
      id: 'participacao',
      rotulo: 'Participacao em evento',
      texto:
        'Certificamos que {{nome}}, portador(a) do documento {{documento}}, ' +
        'participou na condicao de {{papel}} do evento {{tema}}, ' +
        'realizado {{periodo}}, em {{local}}, com carga horaria total de {{cargaHoraria}}.',
    },
    {
      id: 'curso',
      rotulo: 'Conclusao de curso / extensao',
      texto:
        'Certificamos que {{nome}}, portador(a) do documento {{documento}}, ' +
        'concluiu o curso {{tema}}, promovido pelo {{instituicao}} {{periodo}}, ' +
        'com carga horaria de {{cargaHoraria}} e aproveitamento satisfatorio.',
    },
    {
      id: 'palestra',
      rotulo: 'Ministrante / palestrante',
      texto:
        'Certificamos que {{nome}} ministrou a atividade {{tema}}, ' +
        'promovida pelo {{instituicao}} {{periodo}}, em {{local}}, ' +
        'perfazendo carga horaria de {{cargaHoraria}}.',
    },
    {
      id: 'organizacao',
      rotulo: 'Comissao organizadora',
      texto:
        'Certificamos que {{nome}} integrou a comissao organizadora do evento {{tema}}, ' +
        'realizado {{periodo}}, sob responsabilidade do {{instituicao}}, ' +
        'com dedicacao de {{cargaHoraria}}.',
    },
    {
      id: 'monitoria',
      rotulo: 'Monitoria / estagio',
      texto:
        'Certificamos que {{nome}} exerceu a funcao de {{papel}} em {{tema}}, ' +
        'no periodo {{periodo}}, junto ao {{instituicao}}, ' +
        'cumprindo carga horaria de {{cargaHoraria}}.',
    },
  ],

  /** Texto fixo de autenticidade impresso ao lado do QR Code. */
  textoAutenticacao:
    'A autenticidade deste certificado pode ser verificada em {{urlValidacao}} ' +
    'informando o codigo {{codigo}}.',
};

export default brand;
