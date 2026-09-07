import crypto from 'node:crypto';

export function gerarId(prefixo = '') {
  return `${prefixo}${crypto.randomUUID()}`;
}

export function slug(texto, max = 60) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, max) || 'sem-titulo';
}

const MESES = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** '2026-03-14' -> '14 de marco de 2026' */
export function dataPorExtenso(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!a || !m || !d) return String(iso);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

/** '2026-03-14' -> '14/03/2026' */
export function dataCurta(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  if (!a || !m || !d) return String(iso);
  return `${d}/${m}/${a}`;
}

export function dataHoraCurta(iso) {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return String(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

/**
 * Periodo por extenso a partir das datas do evento.
 * Mesma data -> 'em 14 de marco de 2026'
 * Mesmo mes  -> 'de 14 a 16 de marco de 2026'
 * Diferente  -> 'de 28 de fevereiro a 2 de marco de 2026'
 */
export function periodoPorExtenso(inicio, fim) {
  if (!inicio && !fim) return '';
  if (!fim || inicio === fim) return `em ${dataPorExtenso(inicio || fim)}`;
  const [ai, mi, di] = inicio.slice(0, 10).split('-').map(Number);
  const [af, mf, df] = fim.slice(0, 10).split('-').map(Number);
  if (ai === af && mi === mf) return `de ${di} a ${df} de ${MESES[mf - 1]} de ${af}`;
  if (ai === af) return `de ${di} de ${MESES[mi - 1]} a ${df} de ${MESES[mf - 1]} de ${af}`;
  return `de ${dataPorExtenso(inicio)} a ${dataPorExtenso(fim)}`;
}

/** 45 -> '45 (quarenta e cinco) horas' */
export function cargaHorariaPorExtenso(horas) {
  const n = Number(horas);
  if (!Number.isFinite(n) || n <= 0) return '';
  const inteiro = Math.trunc(n);
  const extenso = numeroPorExtenso(inteiro);
  const unidade = inteiro === 1 ? 'hora' : 'horas';
  return `${inteiro} (${extenso}) ${unidade}`;
}

const UNI = ['zero','um','dois','tres','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
const DEZ = ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
const CEM = ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];

export function numeroPorExtenso(n) {
  n = Math.trunc(Math.abs(Number(n) || 0));
  if (n < 20) return UNI[n];
  if (n < 100) {
    const d = Math.floor(n / 10), r = n % 10;
    return r ? `${DEZ[d]} e ${UNI[r]}` : DEZ[d];
  }
  if (n === 100) return 'cem';
  if (n < 1000) {
    const c = Math.floor(n / 100), r = n % 100;
    return r ? `${CEM[c]} e ${numeroPorExtenso(r)}` : CEM[c];
  }
  if (n < 1000000) {
    const m = Math.floor(n / 1000), r = n % 1000;
    const parte = m === 1 ? 'mil' : `${numeroPorExtenso(m)} mil`;
    if (!r) return parte;
    return r < 100 ? `${parte} e ${numeroPorExtenso(r)}` : `${parte} ${numeroPorExtenso(r)}`;
  }
  return String(n);
}

/** Mascara parcial do CPF para exibicao publica: 123.456.789-00 -> ***.456.789-** */
export function mascararDocumento(doc) {
  const d = String(doc ?? '').replace(/\D/g, '');
  if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  if (d.length > 4) return `${'*'.repeat(Math.max(0, d.length - 4))}${d.slice(-4)}`;
  return doc ? String(doc) : '';
}

export function formatarCpf(doc) {
  const d = String(doc ?? '').replace(/\D/g, '');
  if (d.length !== 11) return String(doc ?? '').trim();
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function limitar(texto, max) {
  const t = String(texto ?? '').trim();
  return t.length > max ? `${t.slice(0, max - 1)}\u2026` : t;
}

export function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
