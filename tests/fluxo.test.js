/**
 * Testes do fluxo principal, sem rede e sem Google Drive.
 * Rode com: npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { gerarCodigo, normalizarCodigo, gerarSelo, conferirSelo } from '../src/services/codigo.js';
import { gerarHashSenha, conferirSenha, criarToken, lerToken } from '../src/services/auth.js';
import { aplicar, montarContexto } from '../src/services/vocalizacao.js';
import { lerParticipantes, lerCsv } from '../src/services/csv.js';
import { dividirVocalizacao } from '../src/services/pdf.js';
import { cargaHorariaPorExtenso, periodoPorExtenso, mascararDocumento, formatarCpf } from '../src/services/util.js';

test('codigo de autenticacao tem formato estavel e normaliza entrada suja', () => {
  const codigo = gerarCodigo();
  assert.match(codigo, /^UNIVC-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  assert.equal(normalizarCodigo(codigo.toLowerCase().replace(/-/g, ' ')), codigo);
  assert.equal(normalizarCodigo('curto'), null);
});

test('selo digital detecta alteracao no registro', () => {
  const cert = {
    codigo: 'UNIVC-A1B2-C3D4-E5F6',
    nome: 'Maria de Souza',
    documento: '12345678900',
    eventoId: 'evt_1',
    temaEvento: 'Semana Academica',
    cargaHoraria: 20,
    papel: 'participante',
    emitidoEm: '2026-03-20T12:00:00.000Z',
  };
  cert.selo = gerarSelo(cert);
  assert.equal(conferirSelo(cert), true);

  const adulterado = { ...cert, cargaHoraria: 200 };
  assert.equal(conferirSelo(adulterado), false);
});

test('senha do administrador nunca fica em texto puro', () => {
  const hash = gerarHashSenha('senha-bem-forte');
  assert.ok(hash.startsWith('scrypt$'));
  assert.ok(!hash.includes('senha-bem-forte'));
  assert.equal(conferirSenha('senha-bem-forte', hash), true);
  assert.equal(conferirSenha('senha-errada', hash), false);
});

test('token de sessao rejeita assinatura adulterada', () => {
  const token = criarToken('admin');
  assert.equal(lerToken(token).u, 'admin');
  assert.equal(lerToken(`${token}x`), null);
  assert.equal(lerToken('qualquer.coisa'), null);
});

test('vocalizacao substitui marcadores e nao deixa lacuna de campo vazio', () => {
  const contexto = montarContexto({
    certificado: { nome: 'Ana Lima', documento: '12345678900', papel: 'monitora', cargaHoraria: 45 },
    evento: { tema: 'Curso de Extensao', dataInicio: '2026-05-04', dataFim: '2026-05-06', local: 'Campus Sede' },
    urlValidacao: 'https://exemplo/validar/X',
  });
  const texto = aplicar('Certificamos que {{nome}} atuou como {{papel}} em {{tema}}, {{periodo}}, com {{cargaHoraria}}.{{inexistente}}', contexto);
  assert.ok(texto.includes('Ana Lima'));
  assert.ok(texto.includes('monitora'));
  assert.ok(texto.includes('de 4 a 6 de maio de 2026'));
  assert.ok(texto.includes('45 (quarenta e cinco) horas'));
  assert.ok(!texto.includes('{{'));
});

test('nome e destacado a partir do texto corrido', () => {
  const { antes, depois } = dividirVocalizacao(
    'Certificamos que Ana Lima participou do evento X.',
    'Ana Lima'
  );
  assert.equal(antes, 'Certificamos que');
  assert.equal(depois, 'participou do evento X.');
});

test('nome ausente do texto nao quebra a divisao', () => {
  const { antes, depois } = dividirVocalizacao('Texto sem o nome.', 'Ana Lima');
  assert.equal(antes, '');
  assert.equal(depois, 'Texto sem o nome.');
});

test('CSV aceita ponto-e-virgula, aspas e cabecalho em variantes', () => {
  const csv = [
    'Nome Completo;CPF;E-mail;Funcao;Carga Horaria',
    '"Souza, Maria A.";123.456.789-00;maria@exemplo.com;participante;20',
    'Joao Pedro;98765432100;joao@exemplo.com;palestrante;4',
  ].join('\n');
  const { participantes } = lerParticipantes(csv);
  assert.equal(participantes.length, 2);
  assert.equal(participantes[0].nome, 'Souza, Maria A.');
  assert.equal(participantes[1].papel, 'palestrante');
  assert.equal(participantes[1].cargaHoraria, '4');
});

test('CSV sem cabecalho reconhecivel usa a ordem padrao e avisa', () => {
  const { participantes, avisos } = lerParticipantes('Maria Souza;12345678900;maria@exemplo.com');
  assert.equal(participantes.length, 1);
  assert.equal(participantes[0].email, 'maria@exemplo.com');
  assert.equal(avisos.length, 1);
});

test('CSV separado por virgula tambem funciona', () => {
  const linhas = lerCsv('a,b,c\n1,2,3');
  assert.deepEqual(linhas, [['a', 'b', 'c'], ['1', '2', '3']]);
});

test('formatacoes de apoio', () => {
  assert.equal(cargaHorariaPorExtenso(1), '1 (um) hora');
  assert.equal(cargaHorariaPorExtenso(120), '120 (cento e vinte) horas');
  assert.equal(periodoPorExtenso('2026-03-14', '2026-03-14'), 'em 14 de marco de 2026');
  assert.equal(periodoPorExtenso('2026-02-28', '2026-03-02'), 'de 28 de fevereiro a 2 de marco de 2026');
  assert.equal(formatarCpf('12345678900'), '123.456.789-00');
  assert.equal(mascararDocumento('12345678900'), '***.456.789-**');
});
