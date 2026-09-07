/**
 * Codigo de autenticacao dos certificados.
 *
 * Formato: UNIVC-XXXX-XXXX-XXXX  (alfabeto Crockford Base32, sem I, L, O, U -
 * evita confusao entre 1/I/L e 0/O quando alguem digita o codigo a mao).
 *
 * Alem do codigo, cada certificado guarda um "selo" HMAC-SHA256 calculado sobre
 * os dados canonicos (nome, evento, carga horaria, data). Se alguem alterar o
 * registro no Drive por fora da plataforma, a validacao acusa divergencia.
 */
import crypto from 'node:crypto';
import { config } from '../config.js';

const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford Base32
const PREFIXO = 'UNIVC';

export function gerarCodigo() {
  const bytes = crypto.randomBytes(12);
  let saida = '';
  for (let i = 0; i < 12; i++) saida += ALFABETO[bytes[i] % ALFABETO.length];
  return `${PREFIXO}-${saida.slice(0, 4)}-${saida.slice(4, 8)}-${saida.slice(8, 12)}`;
}

export function normalizarCodigo(entrada) {
  const limpo = String(entrada ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^UNIVC/, '');
  if (limpo.length !== 12) return null;
  return `${PREFIXO}-${limpo.slice(0, 4)}-${limpo.slice(4, 8)}-${limpo.slice(8, 12)}`;
}

/** Texto canonico: qualquer mudanca aqui invalida selos ja emitidos. */
export function payloadCanonico(cert) {
  return [
    cert.codigo,
    cert.nome,
    cert.documento ?? '',
    cert.eventoId,
    cert.temaEvento ?? '',
    String(cert.cargaHoraria ?? ''),
    cert.papel ?? '',
    cert.emitidoEm,
  ].join('|');
}

export function gerarSelo(cert) {
  return crypto
    .createHmac('sha256', config.codigoSecret)
    .update(payloadCanonico(cert), 'utf8')
    .digest('hex');
}

export function conferirSelo(cert) {
  if (!cert?.selo) return false;
  const esperado = gerarSelo(cert);
  const a = Buffer.from(esperado, 'hex');
  const b = Buffer.from(String(cert.selo), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function seloCurto(selo) {
  return String(selo ?? '')
    .slice(0, 16)
    .toUpperCase()
    .replace(/(.{4})/g, '$1 ')
    .trim();
}
