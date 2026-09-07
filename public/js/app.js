/* ------------------------------------------------------------------
   Painel administrativo - Certificados UNIVC
   JavaScript puro, sem dependencias externas.
   ------------------------------------------------------------------ */
'use strict';

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

const estado = {
  info: null,
  eventos: [],
  eventoEditando: null,
  participantes: [],
  urlPrevia: null,
};

/* ------------------------------ HTTP ------------------------------ */

async function chamar(caminho, opcoes = {}) {
  const resposta = await fetch(caminho, {
    credentials: 'same-origin',
    headers: opcoes.corpo ? { 'Content-Type': 'application/json' } : undefined,
    method: opcoes.metodo ?? 'GET',
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : opcoes.formData,
  });
  if (resposta.status === 401) {
    mostrarLogin();
    throw new Error('Sessao expirada.');
  }
  const tipo = resposta.headers.get('content-type') ?? '';
  if (!resposta.ok) {
    const detalhe = tipo.includes('json') ? (await resposta.json()).erro : await resposta.text();
    throw new Error(detalhe || `Erro ${resposta.status}`);
  }
  if (tipo.includes('application/pdf')) return resposta.blob();
  if (tipo.includes('json')) return resposta.json();
  return resposta.text();
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

function avisar(mensagem, tipo = 'sucesso', alvo = '#mensagem-global') {
  const caixa = $(alvo);
  if (!caixa) return;
  caixa.innerHTML = `<div class="aviso ${tipo}">${escapar(mensagem)}</div>`;
  caixa.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (tipo === 'sucesso') setTimeout(() => { caixa.innerHTML = ''; }, 6000);
}

function dataCurta(iso) {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return a && m && d ? `${d}/${m}/${a}` : iso;
}
function dataHora(iso) {
  if (!iso) return '—';
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? iso : dt.toLocaleString('pt-BR');
}

/* ------------------------------ Login ------------------------------ */

function mostrarLogin() {
  $('#tela-login').classList.remove('oculto');
  $('#app').classList.add('oculto');
}
function mostrarApp() {
  $('#tela-login').classList.add('oculto');
  $('#app').classList.remove('oculto');
}

$('#form-login').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  $('#login-erro').classList.add('oculto');
  try {
    await chamar('/api/sessao', {
      metodo: 'POST',
      corpo: { usuario: $('#login-usuario').value, senha: $('#login-senha').value },
    });
    $('#login-senha').value = '';
    await iniciar();
  } catch (erro) {
    $('#login-erro').textContent = erro.message;
    $('#login-erro').classList.remove('oculto');
  }
});

$('#botao-sair').addEventListener('click', async () => {
  await chamar('/api/sessao', { metodo: 'DELETE' }).catch(() => {});
  mostrarLogin();
});

/* ------------------------------ Abas ------------------------------ */

$$('.abas button').forEach((botao) => {
  botao.addEventListener('click', () => {
    $$('.abas button').forEach((b) => b.setAttribute('aria-selected', String(b === botao)));
    $$('.aba').forEach((secao) => secao.classList.add('oculto'));
    $(`#aba-${botao.dataset.aba}`).classList.remove('oculto');
    if (botao.dataset.aba === 'certificados') carregarCertificados();
    if (botao.dataset.aba === 'emitir') preencherSelecaoEventos();
  });
});

/* --------------------------- Inicializacao --------------------------- */

async function iniciar() {
  const sessao = await chamar('/api/sessao').catch(() => ({ autenticado: false }));
  if (!sessao.autenticado) return mostrarLogin();
  mostrarApp();

  estado.info = await chamar('/api/estado');
  const inst = estado.info.instituicao;

  $('#topo-instituicao').textContent = inst.nome;
  $('#login-instituicao').textContent = inst.nome;
  $('#topo-usuario').textContent = `${inst.sigla} · painel administrativo`;
  $('#brasao-topo').textContent = inst.sigla;
  $('#link-validacao').href = `${estado.info.baseUrl}/validar`;
  $('#ajuda-link-validacao').href = `${estado.info.baseUrl}/validar`;
  $('#rodape-app').innerHTML =
    `${escapar(inst.nome)} — ${escapar(inst.mantenedora || '')} · ` +
    `<a href="${escapar(inst.site)}" target="_blank" rel="noopener">${escapar(inst.site)}</a>`;

  if (estado.info.temLogo) {
    const img = $('#brasao-topo');
    img.innerHTML = `<img src="/api/identidade/imagem?id=${encodeURIComponent(estado.info.logoId)}" alt="${escapar(inst.sigla)}">`;
    $('#previa-logo').src = `/api/identidade/imagem?id=${encodeURIComponent(estado.info.logoId)}`;
    $('#previa-logo').classList.remove('oculto');
  }

  montarPainel();
  montarSelects();
  montarDadosInstitucionais();
  await carregarEventos();
}

function montarPainel() {
  const e = estado.info.estatisticas;
  $('#n-eventos').textContent = e.eventos;
  $('#n-certificados').textContent = e.certificados;
  $('#n-horas').textContent = e.horasCertificadas.toLocaleString('pt-BR');

  const arm = estado.info.armazenamento;
  const drive = arm.driver === 'drive';
  $('#estado-armazenamento').innerHTML = arm.ok
    ? `<div class="aviso ${drive ? 'sucesso' : 'atencao'}">
         <strong>${drive ? 'Google Drive conectado' : 'Armazenamento local'}</strong><br>
         ${drive
           ? `Conta: ${escapar(arm.conta || '—')} · Pasta raiz: <span class="codigo">${escapar(arm.pastaRaizId || '')}</span>`
           : `Os arquivos estao em <span class="codigo">${escapar(arm.detalhe || 'dados-locais/')}</span>. ` +
             'Para usar o Google Drive, defina STORAGE_DRIVER=drive no .env.'}
       </div>`
    : `<div class="aviso erro"><strong>Armazenamento indisponivel</strong><br>${escapar(arm.erro || '')}</div>`;

  $('#estado-avisos').innerHTML = estado.info.avisos.length
    ? `<div class="aviso atencao"><strong>Pendencias de configuracao</strong><ul style="margin:.4rem 0 0;padding-left:1.1rem">
        ${estado.info.avisos.map((a) => `<li>${escapar(a)}</li>`).join('')}</ul></div>`
    : '';
}

function montarDadosInstitucionais() {
  const i = estado.info.instituicao;
  const linhas = [
    ['Nome', i.nome], ['Sigla', i.sigla], ['Mantenedora', i.mantenedora],
    ['Cidade/UF', `${i.cidade}/${i.uf}`], ['Site', i.site],
    ['CNPJ', i.cnpj || '(nao informado)'], ['Credenciamento', i.credenciamento || '(nao informado)'],
    ['URL de validacao', `${estado.info.baseUrl}/validar`],
  ];
  $('#dados-institucionais').innerHTML = linhas
    .map(([r, v]) => `<dt>${escapar(r)}</dt><dd>${escapar(v)}</dd>`).join('');
}

function montarSelects() {
  const layouts = $('#ev-layout');
  layouts.innerHTML = estado.info.layouts
    .map((l) => `<option value="${l.id}">${escapar(l.nome)}</option>`).join('');
  layouts.addEventListener('change', () => {
    const escolhido = estado.info.layouts.find((l) => l.id === layouts.value);
    $('#layout-descricao').textContent = escolhido?.descricao ?? '';
  });
  $('#layout-descricao').textContent = estado.info.layouts[0]?.descricao ?? '';

  $('#ev-modelo-texto').innerHTML =
    '<option value="">Escolher modelo…</option>' +
    estado.info.vocalizacoesSugeridas
      .map((v) => `<option value="${v.id}">${escapar(v.rotulo)}</option>`).join('');
  $('#ev-modelo-texto').addEventListener('change', (e) => {
    const modelo = estado.info.vocalizacoesSugeridas.find((v) => v.id === e.target.value);
    if (modelo) {
      $('#ev-vocalizacao').value = modelo.texto;
      atualizarPreviaTexto();
    }
  });

  $('#lista-marcadores').innerHTML = estado.info.marcadores
    .map((m) => `<button type="button" title="${escapar(m.descricao)}" data-marcador="${m.chave}">{{${m.chave}}}</button>`)
    .join('');
  $('#lista-marcadores').addEventListener('click', (e) => {
    const botao = e.target.closest('button[data-marcador]');
    if (!botao) return;
    inserirNoCursor($('#ev-vocalizacao'), `{{${botao.dataset.marcador}}}`);
    atualizarPreviaTexto();
  });
}

function inserirNoCursor(campo, texto) {
  const inicio = campo.selectionStart ?? campo.value.length;
  const fim = campo.selectionEnd ?? campo.value.length;
  campo.value = campo.value.slice(0, inicio) + texto + campo.value.slice(fim);
  campo.focus();
  campo.selectionStart = campo.selectionEnd = inicio + texto.length;
}

/* ------------------------------ Eventos ------------------------------ */

async function carregarEventos() {
  estado.eventos = await chamar('/api/eventos');
  const corpo = $('#lista-eventos');
  corpo.innerHTML = estado.eventos.length
    ? estado.eventos.map((e) => `
        <tr>
          <td><strong>${escapar(e.tema)}</strong><br><span class="ajuda">${escapar(e.tipo || '')}</span></td>
          <td>${dataCurta(e.dataInicio)}${e.dataFim && e.dataFim !== e.dataInicio ? ` a ${dataCurta(e.dataFim)}` : ''}</td>
          <td>${e.cargaHoraria}h</td>
          <td>${escapar(e.temaVisual?.templateId || 'classico')}</td>
          <td>${e.totalCertificados}</td>
          <td class="acoes">
            <button class="botao secundario pequeno" data-editar="${e.id}">Editar</button>
            <button class="botao secundario pequeno" data-emitir="${e.id}">Emitir</button>
          </td>
        </tr>`).join('')
    : '<tr><td colspan="6" class="ajuda">Nenhum evento cadastrado. Clique em “Novo evento”.</td></tr>';

  corpo.onclick = (e) => {
    const editar = e.target.closest('[data-editar]');
    const emitir = e.target.closest('[data-emitir]');
    if (editar) abrirEditor(estado.eventos.find((x) => x.id === editar.dataset.editar));
    if (emitir) {
      $$('.abas button').find((b) => b.dataset.aba === 'emitir').click();
      $('#emitir-evento').value = emitir.dataset.emitir;
      $('#emitir-evento').dispatchEvent(new Event('change'));
    }
  };
  preencherSelecaoEventos();
}

function preencherSelecaoEventos() {
  const opcoes = estado.eventos
    .map((e) => `<option value="${e.id}">${escapar(e.tema)} (${e.cargaHoraria}h)</option>`).join('');
  const emitir = $('#emitir-evento');
  const anterior = emitir.value;
  emitir.innerHTML = opcoes || '<option value="">Cadastre um evento primeiro</option>';
  if (anterior) emitir.value = anterior;
  $('#filtro-evento').innerHTML = `<option value="">Todos os eventos</option>${opcoes}`;
  atualizarResumoEvento();
}

$('#emitir-evento').addEventListener('change', atualizarResumoEvento);

function atualizarResumoEvento() {
  const evento = estado.eventos.find((e) => e.id === $('#emitir-evento').value);
  $('#emitir-resumo-evento').innerHTML = evento
    ? `Carga horaria padrao: <strong>${evento.cargaHoraria}h</strong> · Papel padrao:
       <strong>${escapar(evento.papelPadrao || 'participante')}</strong> · Layout:
       <strong>${escapar(evento.temaVisual?.templateId || 'classico')}</strong>`
    : '';
}

$('#botao-novo-evento').addEventListener('click', () => abrirEditor(null));
$('#fechar-editor').addEventListener('click', () => $('#editor-evento').classList.add('oculto'));

function abrirEditor(evento) {
  estado.eventoEditando = evento;
  const t = evento?.temaVisual ?? {};
  $('#editor-titulo').textContent = evento ? `Editar: ${evento.tema}` : 'Novo evento';
  $('#editor-evento').classList.remove('oculto');

  $('#ev-tema').value = evento?.tema ?? '';
  $('#ev-subtitulo').value = evento?.subtitulo ?? '';
  $('#ev-tipo').value = evento?.tipo ?? '';
  $('#ev-modalidade').value = evento?.modalidade ?? '';
  $('#ev-carga').value = evento?.cargaHoraria ?? '';
  $('#ev-inicio').value = evento?.dataInicio ?? '';
  $('#ev-fim').value = evento?.dataFim ?? '';
  $('#ev-local').value = evento?.local ?? '';
  $('#ev-cidade').value = evento?.cidade ?? `${estado.info.instituicao.cidade}/${estado.info.instituicao.uf}`;
  $('#ev-papel').value = evento?.papelPadrao ?? 'participante';
  $('#ev-vocalizacao').value = evento?.vocalizacao ?? estado.info.vocalizacaoPadrao;
  $('#ev-conteudo').value = evento?.conteudoProgramatico ?? '';
  $('#ev-destacar').checked = evento?.destacarNome !== false;
  $('#ev-titulo-cert').value = evento?.tituloCertificado ?? 'Certificado';
  $('#ev-subtitulo-cert').value = evento?.subtituloCertificado ?? '';
  $('#ev-layout').value = t.templateId ?? 'classico';
  $('#ev-orientacao').value = t.orientacao ?? 'paisagem';
  $('#cor-primaria').value = t.corPrimaria ?? estado.info.paleta.primaria;
  $('#cor-secundaria').value = t.corSecundaria ?? estado.info.paleta.secundaria;
  $('#cor-destaque').value = t.corDestaque ?? estado.info.paleta.destaque;
  $('#ev-marca-dagua').checked = t.marcaDagua !== false;
  $('#ev-ornamentos').checked = t.ornamentos !== false;
  $('#ev-ocultar-data').checked = Boolean(evento?.ocultarCidadeData);
  $('#ev-layout').dispatchEvent(new Event('change'));

  desenharAssinaturas(evento?.assinaturas ?? [{ nome: '', cargo: '' }]);
  atualizarPreviaTexto();
  $('#botao-excluir-evento').classList.toggle('oculto', !evento);
  $('#botao-reemitir-evento').classList.toggle('oculto', !evento);
  $('#editor-evento').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function coletarEvento() {
  return {
    tema: $('#ev-tema').value,
    subtitulo: $('#ev-subtitulo').value,
    tipo: $('#ev-tipo').value,
    modalidade: $('#ev-modalidade').value,
    cargaHoraria: Number($('#ev-carga').value) || 0,
    dataInicio: $('#ev-inicio').value,
    dataFim: $('#ev-fim').value,
    local: $('#ev-local').value,
    cidade: $('#ev-cidade').value,
    papelPadrao: $('#ev-papel').value,
    tituloCertificado: $('#ev-titulo-cert').value,
    subtituloCertificado: $('#ev-subtitulo-cert').value,
    vocalizacao: $('#ev-vocalizacao').value,
    conteudoProgramatico: $('#ev-conteudo').value,
    destacarNome: $('#ev-destacar').checked,
    ocultarCidadeData: $('#ev-ocultar-data').checked,
    assinaturas: coletarAssinaturas(),
    temaVisual: {
      templateId: $('#ev-layout').value,
      orientacao: $('#ev-orientacao').value,
      corPrimaria: $('#cor-primaria').value,
      corSecundaria: $('#cor-secundaria').value,
      corDestaque: $('#cor-destaque').value,
      marcaDagua: $('#ev-marca-dagua').checked,
      ornamentos: $('#ev-ornamentos').checked,
    },
  };
}

/* --------------------------- Assinaturas --------------------------- */

function desenharAssinaturas(lista) {
  const alvo = $('#lista-assinaturas');
  alvo.innerHTML = (lista.length ? lista : [{ nome: '', cargo: '' }])
    .map((a, i) => linhaAssinatura(a, i)).join('');
  alvo.onclick = async (e) => {
    const remover = e.target.closest('[data-remover-assinatura]');
    if (remover) {
      remover.closest('.assinatura-linha').remove();
      return;
    }
    const enviar = e.target.closest('[data-enviar-assinatura]');
    if (enviar) {
      const linha = enviar.closest('.assinatura-linha');
      const arquivo = linha.querySelector('input[type="file"]').files[0];
      if (!arquivo) return avisar('Escolha um arquivo PNG ou JPG.', 'atencao');
      const dados = new FormData();
      dados.append('arquivo', arquivo);
      try {
        const r = await chamar('/api/identidade/assinatura', { metodo: 'POST', formData: dados });
        linha.querySelector('input[data-imagem-id]').value = r.id;
        avisar('Imagem de assinatura enviada.');
      } catch (erro) {
        avisar(erro.message, 'erro');
      }
    }
  };
}

function linhaAssinatura(a, i) {
  return `
    <div class="assinatura-linha linha" style="align-items:flex-end;border-bottom:1px dashed var(--borda);padding-bottom:.6rem;margin-bottom:.6rem">
      <div class="campo" style="flex:1 1 160px;margin:0">
        <label>Nome ${i + 1}</label>
        <input data-nome value="${escapar(a.nome ?? '')}" placeholder="Prof. Dr. Fulano de Tal">
      </div>
      <div class="campo" style="flex:1 1 160px;margin:0">
        <label>Cargo</label>
        <input data-cargo value="${escapar(a.cargo ?? '')}" placeholder="Reitor">
      </div>
      <div class="campo" style="flex:1 1 180px;margin:0">
        <label>Imagem da assinatura (PNG)</label>
        <input type="file" accept="image/png,image/jpeg">
        <input type="hidden" data-imagem-id value="${escapar(a.imagemId ?? '')}">
      </div>
      <button type="button" class="botao secundario pequeno" data-enviar-assinatura>Enviar</button>
      <button type="button" class="botao secundario pequeno" data-remover-assinatura>Remover</button>
    </div>`;
}

function coletarAssinaturas() {
  return $$('.assinatura-linha').map((linha) => ({
    nome: linha.querySelector('[data-nome]').value,
    cargo: linha.querySelector('[data-cargo]').value,
    imagemId: linha.querySelector('[data-imagem-id]').value || null,
  })).filter((a) => a.nome || a.cargo);
}

$('#botao-add-assinatura').addEventListener('click', () => {
  const atuais = coletarAssinaturas();
  if (atuais.length >= 4) return avisar('Maximo de 4 assinaturas por certificado.', 'atencao');
  $('#lista-assinaturas').insertAdjacentHTML('beforeend', linhaAssinatura({}, atuais.length));
});

/* ---------------------------- Previa ---------------------------- */

let temporizadorTexto;
$('#ev-vocalizacao').addEventListener('input', () => {
  clearTimeout(temporizadorTexto);
  temporizadorTexto = setTimeout(atualizarPreviaTexto, 400);
});
['#ev-carga', '#ev-inicio', '#ev-fim', '#ev-local', '#ev-cidade', '#ev-tema'].forEach((sel) => {
  $(sel).addEventListener('change', atualizarPreviaTexto);
});

async function atualizarPreviaTexto() {
  try {
    const r = await chamar('/api/previa-texto', { metodo: 'POST', corpo: coletarEvento() });
    $('#previa-texto').textContent = r.texto;
  } catch (erro) {
    $('#previa-texto').textContent = erro.message;
  }
}

$('#botao-previa').addEventListener('click', async () => {
  const botao = $('#botao-previa');
  botao.disabled = true;
  botao.textContent = 'Gerando…';
  try {
    const corpo = coletarEvento();
    if (estado.eventoEditando) corpo.eventoId = estado.eventoEditando.id;
    const blob = await chamar('/api/previa', { metodo: 'POST', corpo });
    if (estado.urlPrevia) URL.revokeObjectURL(estado.urlPrevia);
    estado.urlPrevia = URL.createObjectURL(blob);
    $('#previa-quadro').src = estado.urlPrevia;
  } catch (erro) {
    avisar(erro.message, 'erro');
  } finally {
    botao.disabled = false;
    botao.textContent = 'Ver previa em PDF';
  }
});

$('#botao-restaurar-cores').addEventListener('click', () => {
  $('#cor-primaria').value = estado.info.paleta.primaria;
  $('#cor-secundaria').value = estado.info.paleta.secundaria;
  $('#cor-destaque').value = estado.info.paleta.destaque;
});

/* ------------------------- Salvar / excluir ------------------------- */

$('#form-evento').addEventListener('submit', async (e) => {
  e.preventDefault();
  const corpo = coletarEvento();
  try {
    const salvo = estado.eventoEditando
      ? await chamar(`/api/eventos/${estado.eventoEditando.id}`, { metodo: 'PUT', corpo })
      : await chamar('/api/eventos', { metodo: 'POST', corpo });
    estado.eventoEditando = salvo;
    await carregarEventos();
    avisar('Evento salvo.');
    $('#editor-titulo').textContent = `Editar: ${salvo.tema}`;
    $('#botao-excluir-evento').classList.remove('oculto');
    $('#botao-reemitir-evento').classList.remove('oculto');
  } catch (erro) {
    avisar(erro.message, 'erro');
  }
});

$('#botao-excluir-evento').addEventListener('click', async () => {
  if (!estado.eventoEditando) return;
  const evento = estado.eventos.find((x) => x.id === estado.eventoEditando.id);
  const quantos = evento?.totalCertificados ?? 0;
  const texto = quantos
    ? `Este evento tem ${quantos} certificado(s) emitido(s). Excluir o evento APAGA tambem os certificados e os PDFs no Drive. Confirma?`
    : 'Excluir este evento?';
  if (!confirm(texto)) return;
  try {
    await chamar(`/api/eventos/${estado.eventoEditando.id}?forcar=sim`, { metodo: 'DELETE' });
    $('#editor-evento').classList.add('oculto');
    estado.eventoEditando = null;
    await carregarEventos();
    avisar('Evento excluido.');
  } catch (erro) {
    avisar(erro.message, 'erro');
  }
});

$('#botao-reemitir-evento').addEventListener('click', async () => {
  if (!estado.eventoEditando) return;
  if (!confirm('Regerar os PDFs de todos os certificados deste evento com o layout atual? Os codigos sao preservados.')) return;
  const botao = $('#botao-reemitir-evento');
  botao.disabled = true;
  botao.textContent = 'Reemitindo…';
  try {
    const r = await chamar(`/api/eventos/${estado.eventoEditando.id}/reemitir`, { metodo: 'POST' });
    avisar(`${r.reemitidos} certificado(s) regerado(s).` + (r.falhas.length ? ` Falhas: ${r.falhas.length}.` : ''));
  } catch (erro) {
    avisar(erro.message, 'erro');
  } finally {
    botao.disabled = false;
    botao.textContent = 'Reemitir todos os certificados deste evento';
  }
});

/* ------------------------------ Emissao ------------------------------ */

$('#botao-conferir-lista').addEventListener('click', async () => {
  const eventoId = $('#emitir-evento').value;
  if (!eventoId) return avisar('Escolha um evento.', 'atencao');

  const arquivo = $('#emitir-arquivo').files[0];
  let resultado;
  try {
    if (arquivo) {
      const dados = new FormData();
      dados.append('arquivo', arquivo);
      resultado = await chamar(`/api/eventos/${eventoId}/importar-csv`, { metodo: 'POST', formData: dados });
    } else {
      const texto = $('#emitir-lista').value.trim();
      if (!texto) return avisar('Cole a lista ou envie um arquivo CSV.', 'atencao');
      resultado = await chamar(`/api/eventos/${eventoId}/importar-csv`, { metodo: 'POST', corpo: { texto } });
    }
  } catch (erro) {
    return avisar(erro.message, 'erro');
  }

  estado.participantes = resultado.participantes;
  $('#cartao-conferencia').classList.toggle('oculto', !resultado.participantes.length);
  $('#conferencia-avisos').innerHTML = resultado.avisos.length
    ? `<div class="aviso atencao">${resultado.avisos.map(escapar).join('<br>')}</div>` : '';
  $('#conferencia-lista').innerHTML = resultado.participantes.map((p, i) => `
    <tr>
      <td>${i + 1}</td><td>${escapar(p.nome)}</td><td>${escapar(p.documento)}</td>
      <td>${escapar(p.email)}</td><td>${escapar(p.papel)}</td><td>${escapar(p.cargaHoraria)}</td>
    </tr>`).join('');
  $('#emitir-contagem').textContent = `${resultado.participantes.length} participante(s) na lista.`;
  if (!resultado.participantes.length) avisar('Nenhum participante reconhecido na lista.', 'atencao');
});

$('#botao-emitir').addEventListener('click', async () => {
  const eventoId = $('#emitir-evento').value;
  if (!eventoId || !estado.participantes.length) return;
  const botao = $('#botao-emitir');
  botao.disabled = true;
  botao.textContent = 'Emitindo… isso pode levar alguns minutos';
  try {
    const r = await chamar(`/api/eventos/${eventoId}/emitir`, {
      metodo: 'POST',
      corpo: { participantes: estado.participantes, substituir: $('#emitir-substituir').checked },
    });
    mostrarResultadoEmissao(r);
    await carregarEventos();
    estado.info.estatisticas = await chamar('/api/estatisticas');
    montarPainel();
  } catch (erro) {
    avisar(erro.message, 'erro');
  } finally {
    botao.disabled = false;
    botao.textContent = 'Emitir certificados';
  }
});

function mostrarResultadoEmissao(r) {
  $('#cartao-resultado').classList.remove('oculto');
  const base = estado.info.baseUrl;
  const partes = [];

  partes.push(`<div class="aviso sucesso"><strong>${r.emitidos.length} certificado(s) emitido(s).</strong>
    Os PDFs foram gravados no Google Drive.</div>`);
  if (r.ignorados.length) {
    partes.push(`<div class="aviso atencao"><strong>${r.ignorados.length} ignorado(s)</strong> (ja possuiam certificado):<br>
      ${r.ignorados.map((i) => `${escapar(i.nome)} — ${escapar(i.codigo || '')}`).join('<br>')}</div>`);
  }
  if (r.erros.length) {
    partes.push(`<div class="aviso erro"><strong>${r.erros.length} erro(s):</strong><br>
      ${r.erros.map((e) => `${escapar(e.participante ?? '')}: ${escapar(e.motivo)}`).join('<br>')}</div>`);
  }
  if (r.emitidos.length) {
    partes.push(`<div class="tabela-rolagem"><table>
      <thead><tr><th>Codigo</th><th>Nome</th><th>Link de validacao</th><th></th></tr></thead>
      <tbody>${r.emitidos.map((c) => `
        <tr>
          <td class="codigo">${escapar(c.codigo)}</td>
          <td>${escapar(c.nome)}</td>
          <td><a href="${base}/validar/${encodeURIComponent(c.codigo)}" target="_blank" rel="noopener">${base}/validar/${escapar(c.codigo)}</a></td>
          <td><a class="botao secundario pequeno" href="/api/certificados/${c.id}/pdf" target="_blank" rel="noopener">Ver PDF</a></td>
        </tr>`).join('')}</tbody></table></div>`);
  }
  $('#resultado-emissao').innerHTML = partes.join('');
  $('#cartao-resultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* --------------------------- Certificados --------------------------- */

$('#botao-buscar').addEventListener('click', carregarCertificados);
$('#filtro-busca').addEventListener('keydown', (e) => { if (e.key === 'Enter') carregarCertificados(); });
$('#filtro-evento').addEventListener('change', carregarCertificados);

async function carregarCertificados() {
  const parametros = new URLSearchParams();
  if ($('#filtro-busca').value.trim()) parametros.set('busca', $('#filtro-busca').value.trim());
  if ($('#filtro-evento').value) parametros.set('eventoId', $('#filtro-evento').value);

  const eventoId = $('#filtro-evento').value;
  const relatorio = $('#botao-relatorio');
  relatorio.classList.toggle('oculto', !eventoId);
  if (eventoId) relatorio.href = `/api/eventos/${eventoId}/relatorio.csv`;

  try {
    const r = await chamar(`/api/certificados?${parametros}`);
    $('#certificados-total').textContent = `${r.total} certificado(s) encontrado(s)` +
      (r.total > r.itens.length ? ` — exibindo os ${r.itens.length} mais recentes.` : '.');
    const mapaEventos = Object.fromEntries(estado.eventos.map((e) => [e.id, e.tema]));
    $('#lista-certificados').innerHTML = r.itens.length ? r.itens.map((c) => `
      <tr>
        <td class="codigo">${escapar(c.codigo)}</td>
        <td>${escapar(c.nome)}<br><span class="ajuda">${escapar(c.documento || c.email || '')}</span></td>
        <td>${escapar(mapaEventos[c.eventoId] || c.temaEvento || '—')}</td>
        <td>${c.cargaHoraria}h</td>
        <td>${dataHora(c.emitidoEm)}</td>
        <td><span class="etiqueta ${c.status === 'revogado' ? 'revogado' : 'valido'}">${c.status === 'revogado' ? 'Revogado' : 'Valido'}</span></td>
        <td class="acoes">
          <a class="botao secundario pequeno" href="/api/certificados/${c.id}/pdf" target="_blank" rel="noopener">PDF</a>
          <button class="botao secundario pequeno" data-copiar="${escapar(c.codigo)}">Copiar link</button>
          <button class="botao secundario pequeno" data-reemitir="${c.id}">Reemitir</button>
          ${c.status === 'revogado'
            ? `<button class="botao secundario pequeno" data-reativar="${c.id}">Reativar</button>`
            : `<button class="botao secundario pequeno" data-revogar="${c.id}">Revogar</button>`}
          <button class="botao secundario pequeno" data-excluir="${c.id}">Excluir</button>
        </td>
      </tr>`).join('')
      : '<tr><td colspan="7" class="ajuda">Nenhum certificado encontrado.</td></tr>';
  } catch (erro) {
    avisar(erro.message, 'erro');
  }
}

$('#lista-certificados').addEventListener('click', async (e) => {
  const alvo = e.target.closest('button');
  if (!alvo) return;
  const { copiar, reemitir, revogar, reativar, excluir } = alvo.dataset;
  try {
    if (copiar) {
      const url = `${estado.info.baseUrl}/validar/${copiar}`;
      await navigator.clipboard.writeText(url);
      avisar(`Link copiado: ${url}`);
      return;
    }
    if (reemitir) {
      alvo.disabled = true;
      await chamar(`/api/certificados/${reemitir}/reemitir`, { metodo: 'POST' });
      avisar('PDF regerado com o layout atual.');
    }
    if (revogar) {
      const motivo = prompt('Motivo da revogacao (aparece na pagina publica):', '');
      if (motivo === null) return;
      await chamar(`/api/certificados/${revogar}/revogar`, { metodo: 'POST', corpo: { motivo } });
      avisar('Certificado revogado.');
    }
    if (reativar) {
      await chamar(`/api/certificados/${reativar}/reativar`, { metodo: 'POST' });
      avisar('Certificado reativado.');
    }
    if (excluir) {
      if (!confirm('Excluir definitivamente este certificado e o PDF no Drive?')) return;
      await chamar(`/api/certificados/${excluir}`, { metodo: 'DELETE' });
      avisar('Certificado excluido.');
    }
    await carregarCertificados();
  } catch (erro) {
    avisar(erro.message, 'erro');
  }
});

/* ---------------------------- Identidade ---------------------------- */

$('#botao-enviar-logo').addEventListener('click', async () => {
  const arquivo = $('#arquivo-logo').files[0];
  if (!arquivo) return avisar('Escolha um arquivo PNG ou JPG.', 'atencao');
  const dados = new FormData();
  dados.append('arquivo', arquivo);
  try {
    const r = await chamar('/api/identidade/logo', { metodo: 'POST', formData: dados });
    $('#previa-logo').src = `/api/identidade/imagem?id=${encodeURIComponent(r.id)}&t=${Date.now()}`;
    $('#previa-logo').classList.remove('oculto');
    $('#brasao-topo').innerHTML = `<img src="/api/identidade/imagem?id=${encodeURIComponent(r.id)}&t=${Date.now()}" alt="logo">`;
    avisar('Logotipo atualizado. Reemita os certificados para aplica-lo aos ja emitidos.');
  } catch (erro) {
    avisar(erro.message, 'erro');
  }
});

$('#botao-remover-logo').addEventListener('click', async () => {
  if (!confirm('Remover o logotipo? Os certificados voltam a usar o brasao vetorial.')) return;
  try {
    await chamar('/api/identidade/logo', { metodo: 'DELETE' });
    $('#previa-logo').classList.add('oculto');
    $('#brasao-topo').textContent = estado.info.instituicao.sigla;
    avisar('Logotipo removido.');
  } catch (erro) {
    avisar(erro.message, 'erro');
  }
});

/* ------------------------------ Boot ------------------------------ */

iniciar().catch(() => mostrarLogin());
