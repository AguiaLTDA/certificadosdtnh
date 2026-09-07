#!/usr/bin/env node
/**
 * Cria um evento de demonstracao e emite tres certificados, para conferir
 * o funcionamento ponta a ponta (PDF, QR Code, codigo e validacao).
 *
 *   npm run seed
 */
import { config } from '../src/config.js';
import * as db from '../src/services/db.js';
import { emitirLote } from '../src/services/certificados.js';
import { iniciarStorage } from '../src/services/storage.js';
import { gerarId } from '../src/services/util.js';

await iniciarStorage();

const evento = {
  id: gerarId('evt_'),
  tema: 'Semana Academica de Inovacao e Tecnologia',
  subtitulo: 'Tecnologia, sociedade e futuro',
  tipo: 'Semana academica',
  modalidade: 'Presencial',
  cargaHoraria: 20,
  dataInicio: '2026-03-16',
  dataFim: '2026-03-20',
  local: 'Campus Sede',
  cidade: `${config.instituicao.cidade}/${config.instituicao.uf}`,
  papelPadrao: 'participante',
  tituloCertificado: 'Certificado',
  subtituloCertificado: 'de participacao',
  vocalizacao:
    'Certificamos que {{nome}}, portador(a) do documento {{documento}}, ' +
    'participou na condicao de {{papel}} do evento {{tema}}, ' +
    'realizado {{periodo}}, em {{local}}, com carga horaria total de {{cargaHoraria}}.',
  conteudoProgramatico:
    'Dia 1 - Abertura e conferencia magna (4h)\n' +
    'Dia 2 - Oficinas simultaneas (4h)\n' +
    'Dia 3 - Mesa redonda: tecnologia e sociedade (4h)\n' +
    'Dia 4 - Apresentacao de trabalhos (4h)\n' +
    'Dia 5 - Encerramento e premiacao (4h)',
  destacarNome: true,
  ocultarCidadeData: false,
  assinaturas: [
    { nome: 'Coordenacao Academica', cargo: 'Coordenacao do evento', imagemId: null },
    { nome: 'Reitoria', cargo: `Reitoria - ${config.instituicao.sigla}`, imagemId: null },
  ],
  temaVisual: { templateId: 'classico', orientacao: 'paisagem' },
  criadoEm: new Date().toISOString(),
  atualizadoEm: new Date().toISOString(),
};

await db.inserirEvento(evento);
console.log(`Evento criado: ${evento.tema}`);

const resultado = await emitirLote({
  eventoId: evento.id,
  participantes: [
    { nome: 'Maria Aparecida de Souza', documento: '12345678900', email: 'maria@exemplo.com' },
    { nome: 'Joao Pedro Lima', documento: '98765432100', email: 'joao@exemplo.com', papel: 'palestrante', cargaHoraria: 4 },
    { nome: 'Ana Carolina Ferreira dos Santos', documento: '11122233344', email: 'ana@exemplo.com', papel: 'monitora' },
  ],
});

console.log(`\n${resultado.emitidos.length} certificado(s) emitido(s):\n`);
for (const c of resultado.emitidos) {
  console.log(`  ${c.codigo}  ${c.nome}`);
  console.log(`    validacao: ${config.baseUrl}/validar/${c.codigo}`);
}
if (resultado.erros.length) console.log('\nErros:', resultado.erros);
console.log('\nSuba o servidor com "npm start" e abra os enderecos acima.\n');
