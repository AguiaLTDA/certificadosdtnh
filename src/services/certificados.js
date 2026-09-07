/**
 * Regras de emissao, reemissao, revogacao e validacao de certificados.
 */
import { config } from '../config.js';
import * as db from './db.js';
import { gerarCodigo, gerarSelo, conferirSelo } from './codigo.js';
import { gerarPdfCertificado } from './pdf.js';
import { obterLogo, resolverAssinaturas } from './identidade.js';
import { lerBinario, pastaCertificadosDoEvento, salvarBinario, excluirBinario, tornarPublico } from './storage.js';
import { gerarId, slug, formatarCpf } from './util.js';

const CONCORRENCIA = 3;

async function emParalelo(itens, limite, tarefa) {
  const resultados = new Array(itens.length);
  let indice = 0;
  const trabalhadores = Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (true) {
      const i = indice++;
      if (i >= itens.length) return;
      resultados[i] = await tarefa(itens[i], i);
    }
  });
  await Promise.all(trabalhadores);
  return resultados;
}

async function codigoInedito() {
  const existentes = new Set((await db.carregar('certificados')).map((c) => c.codigo));
  let tentativa = 0;
  while (tentativa++ < 50) {
    const codigo = gerarCodigo();
    if (!existentes.has(codigo)) return codigo;
  }
  throw new Error('Nao foi possivel gerar um codigo inedito. Tente novamente.');
}

function chaveParticipante(p) {
  const doc = String(p.documento ?? '').replace(/\D/g, '');
  if (doc) return `doc:${doc}`;
  const email = String(p.email ?? '').trim().toLowerCase();
  if (email) return `mail:${email}`;
  return `nome:${db.normalizar(p.nome)}`;
}

function nomeArquivo(certificado) {
  return `${certificado.codigo}-${slug(certificado.nome, 48)}.pdf`;
}

/**
 * Emite um lote de certificados para um evento.
 * @returns {{emitidos: Array, ignorados: Array, erros: Array}}
 */
export async function emitirLote({ eventoId, participantes, substituir = false }) {
  const evento = await db.acharEvento(eventoId);
  if (!evento) throw new Error('Evento nao encontrado.');

  const jaEmitidos = await db.listarCertificados({ eventoId });
  const indice = new Map(jaEmitidos.map((c) => [chaveParticipante(c), c]));

  const logoBuffer = await obterLogo();
  const assinaturas = await resolverAssinaturas(evento.assinaturas);
  const pasta = await pastaCertificadosDoEvento(slug(`${evento.tema}-${evento.id.slice(0, 6)}`));

  const emitidos = [];
  const ignorados = [];
  const erros = [];
  const aProcessar = [];

  for (const bruto of participantes) {
    const nome = String(bruto.nome ?? '').trim().replace(/\s+/g, ' ');
    if (!nome) {
      erros.push({ participante: bruto, motivo: 'Nome em branco.' });
      continue;
    }
    const participante = {
      nome,
      documento: String(bruto.documento ?? '').trim(),
      email: String(bruto.email ?? '').trim(),
      papel: String(bruto.papel ?? '').trim() || evento.papelPadrao || 'participante',
      cargaHoraria: Number(bruto.cargaHoraria) || Number(evento.cargaHoraria) || 0,
      observacao: String(bruto.observacao ?? '').trim(),
    };
    const existente = indice.get(chaveParticipante(participante));
    if (existente && !substituir) {
      ignorados.push({ nome, motivo: 'Ja possui certificado neste evento.', codigo: existente.codigo });
      continue;
    }
    aProcessar.push({ participante, existente: substituir ? existente : null });
  }

  const codigos = [];
  for (let i = 0; i < aProcessar.length; i++) codigos.push(await codigoInedito());
  // Evita colisao dentro do proprio lote
  const vistos = new Set();
  for (let i = 0; i < codigos.length; i++) {
    while (vistos.has(codigos[i])) codigos[i] = gerarCodigo();
    vistos.add(codigos[i]);
  }

  await emParalelo(aProcessar, CONCORRENCIA, async (item, i) => {
    const { participante, existente } = item;
    try {
      const agora = new Date().toISOString();
      const certificado = {
        id: gerarId('cert_'),
        codigo: existente?.codigo ?? codigos[i],
        eventoId: evento.id,
        temaEvento: evento.tema,
        nome: participante.nome,
        documento: participante.documento,
        email: participante.email,
        papel: participante.papel,
        cargaHoraria: participante.cargaHoraria,
        observacao: participante.observacao,
        emitidoEm: existente?.emitidoEm ?? agora,
        atualizadoEm: agora,
        status: 'valido',
        versao: (existente?.versao ?? 0) + 1,
      };
      certificado.selo = gerarSelo(certificado);

      const pdf = await gerarPdfCertificado({ certificado, evento, logoBuffer, assinaturas });
      const arquivo = await salvarBinario({
        pasta,
        nome: nomeArquivo(certificado),
        buffer: pdf,
        mimeType: 'application/pdf',
      });
      certificado.arquivoId = arquivo.id;
      certificado.arquivoNome = arquivo.nome;
      certificado.arquivoLink = arquivo.link ?? null;
      certificado.tamanhoBytes = pdf.length;

      if (config.entregaPdf === 'drive' && config.storage.driver === 'drive') {
        const publico = await tornarPublico(arquivo.id).catch(() => null);
        if (publico) {
          certificado.arquivoLink = publico.webViewLink ?? certificado.arquivoLink;
          certificado.arquivoDownload = publico.webContentLink ?? null;
        }
      }

      if (existente) {
        await db.atualizarCertificado(existente.id, { ...certificado, id: existente.id });
        emitidos.push({ ...certificado, id: existente.id, substituido: true });
      } else {
        await db.inserirCertificados([certificado]);
        emitidos.push(certificado);
      }
    } catch (erro) {
      erros.push({ participante: participante.nome, motivo: erro.message });
    }
  });

  return { emitidos, ignorados, erros };
}

/** Regera o PDF de um certificado ja emitido (apos mudar tema/vocalizacao). */
export async function reemitir(certificadoId) {
  const certificado = await db.acharCertificado(certificadoId);
  if (!certificado) throw new Error('Certificado nao encontrado.');
  const evento = await db.acharEvento(certificado.eventoId);
  if (!evento) throw new Error('Evento do certificado nao encontrado.');

  const logoBuffer = await obterLogo();
  const assinaturas = await resolverAssinaturas(evento.assinaturas);
  const pasta = await pastaCertificadosDoEvento(slug(`${evento.tema}-${evento.id.slice(0, 6)}`));

  const atualizado = {
    ...certificado,
    temaEvento: evento.tema,
    atualizadoEm: new Date().toISOString(),
    versao: (certificado.versao ?? 1) + 1,
  };
  atualizado.selo = gerarSelo(atualizado);

  const pdf = await gerarPdfCertificado({ certificado: atualizado, evento, logoBuffer, assinaturas });
  const arquivo = await salvarBinario({
    pasta,
    nome: nomeArquivo(atualizado),
    buffer: pdf,
    mimeType: 'application/pdf',
  });
  atualizado.arquivoId = arquivo.id;
  atualizado.arquivoNome = arquivo.nome;
  atualizado.arquivoLink = arquivo.link ?? atualizado.arquivoLink ?? null;
  atualizado.tamanhoBytes = pdf.length;

  return db.atualizarCertificado(certificadoId, atualizado);
}

/** Reemite todos os certificados de um evento (util depois de trocar o layout). */
export async function reemitirEvento(eventoId) {
  const lista = await db.listarCertificados({ eventoId });
  const ok = [];
  const falhas = [];
  await emParalelo(lista, CONCORRENCIA, async (c) => {
    try {
      await reemitir(c.id);
      ok.push(c.codigo);
    } catch (erro) {
      falhas.push({ codigo: c.codigo, motivo: erro.message });
    }
  });
  return { reemitidos: ok.length, ok, falhas };
}

export async function revogar(certificadoId, motivo) {
  return db.atualizarCertificado(certificadoId, {
    status: 'revogado',
    motivoRevogacao: String(motivo ?? '').trim() || 'Nao informado',
    revogadoEm: new Date().toISOString(),
  });
}

export async function reativar(certificadoId) {
  return db.atualizarCertificado(certificadoId, {
    status: 'valido',
    motivoRevogacao: null,
    revogadoEm: null,
  });
}

export async function excluir(certificadoId) {
  const certificado = await db.removerCertificado(certificadoId);
  if (certificado?.arquivoId) await excluirBinario(certificado.arquivoId).catch(() => {});
  return certificado;
}

export async function baixarPdf(certificado) {
  if (!certificado?.arquivoId) throw new Error('Este certificado ainda nao possui PDF armazenado.');
  return lerBinario(certificado.arquivoId);
}

/**
 * Resultado publico da validacao. Nunca expoe dados sensiveis completos.
 */
export async function validarPorCodigo(codigo) {
  const certificado = await db.acharCertificadoPorCodigo(codigo);
  if (!certificado) {
    return { encontrado: false, situacao: 'nao_encontrado' };
  }
  const evento = await db.acharEvento(certificado.eventoId);
  const integro = conferirSelo(certificado);
  const revogado = certificado.status === 'revogado';

  return {
    encontrado: true,
    situacao: revogado ? 'revogado' : integro ? 'valido' : 'divergente',
    integro,
    certificado: {
      codigo: certificado.codigo,
      nome: certificado.nome,
      documento: certificado.documento ? formatarCpf(certificado.documento) : '',
      papel: certificado.papel,
      cargaHoraria: certificado.cargaHoraria,
      emitidoEm: certificado.emitidoEm,
      atualizadoEm: certificado.atualizadoEm,
      status: certificado.status,
      motivoRevogacao: certificado.motivoRevogacao ?? null,
      selo: certificado.selo,
      id: certificado.id,
      temPdf: Boolean(certificado.arquivoId),
      arquivoLink: config.entregaPdf === 'drive' ? certificado.arquivoLink ?? null : null,
    },
    evento: evento
      ? {
          tema: evento.tema,
          subtitulo: evento.subtitulo ?? '',
          tipo: evento.tipo ?? '',
          modalidade: evento.modalidade ?? '',
          dataInicio: evento.dataInicio ?? '',
          dataFim: evento.dataFim ?? '',
          local: evento.local ?? '',
          cidade: evento.cidade ?? '',
          cargaHoraria: evento.cargaHoraria ?? null,
        }
      : null,
  };
}

/** Numeros para o painel. */
export async function estatisticas() {
  const [eventos, certificados] = await Promise.all([
    db.carregar('eventos'),
    db.carregar('certificados'),
  ]);
  const validos = certificados.filter((c) => c.status !== 'revogado');
  const horas = validos.reduce((soma, c) => soma + (Number(c.cargaHoraria) || 0), 0);
  return {
    eventos: eventos.length,
    certificados: certificados.length,
    validos: validos.length,
    revogados: certificados.length - validos.length,
    horasCertificadas: horas,
    ultimaEmissao: certificados.reduce(
      (max, c) => (String(c.emitidoEm) > max ? String(c.emitidoEm) : max),
      ''
    ),
  };
}
