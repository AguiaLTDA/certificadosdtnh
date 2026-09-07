#!/usr/bin/env node
/**
 * Gera um PDF de amostra de cada layout, para conferir o desenho sem
 * precisar subir o servidor.
 *
 *   node scripts/amostras.js [pasta-de-saida]
 */
import fs from 'node:fs';
import path from 'node:path';
import { gerarPdfExemplo } from '../src/services/pdf.js';
import { listarLayouts } from '../src/templates/layouts.js';

const eventoBase = {
  id: 'amostra',
  tema: 'Semana Academica de Inovacao e Tecnologia',
  subtitulo: 'Tecnologia, sociedade e futuro',
  tipo: 'Semana academica',
  modalidade: 'Presencial',
  cargaHoraria: 20,
  dataInicio: '2026-03-16',
  dataFim: '2026-03-20',
  local: 'Campus Sede',
  cidade: 'Sao Mateus/ES',
  tituloCertificado: 'Certificado',
  subtituloCertificado: 'de participacao',
  vocalizacao:
    'Certificamos que {{nome}}, portador(a) do documento {{documento}}, ' +
    'participou na condicao de {{papel}} do evento {{tema}}, realizado {{periodo}}, ' +
    'em {{local}}, com carga horaria total de {{cargaHoraria}}.',
  destacarNome: true,
  assinaturas: [
    { nome: 'Profa. Coordenacao Academica', cargo: 'Coordenacao do evento' },
    { nome: 'Reitoria', cargo: 'Reitoria - UNIVC' },
  ],
};

const saida = path.resolve(process.argv[2] ?? 'amostras');
fs.mkdirSync(saida, { recursive: true });

for (const layout of listarLayouts()) {
  const pdf = await gerarPdfExemplo({
    evento: { ...eventoBase, temaVisual: { templateId: layout.id } },
  });
  const arquivo = path.join(saida, `${layout.id}.pdf`);
  fs.writeFileSync(arquivo, pdf);
  console.log(`${layout.nome.padEnd(14)} -> ${arquivo} (${(pdf.length / 1024).toFixed(1)} KB)`);
}
