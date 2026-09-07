/**
 * Autenticacao do painel administrativo.
 *
 * Senha guardada como hash scrypt (nunca em texto puro) e sessao em cookie
 * assinado com HMAC. Sem dependencia externa.
 */
import crypto from 'node:crypto';
import { config } from '../config.js';

const NOME_COOKIE = 'certificados_sessao';
const DURACAO_MS = 12 * 60 * 60 * 1000; // 12 horas

/* -------------------- Senha -------------------- */

export function gerarHashSenha(senha) {
  const sal = crypto.randomBytes(16);
  const derivada = crypto.scryptSync(String(senha), sal, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${sal.toString('base64')}$${derivada.toString('base64')}`;
}

export function conferirSenha(senha, hashArmazenado) {
  try {
    const [algoritmo, N, r, p, salB64, chaveB64] = String(hashArmazenado).split('$');
    if (algoritmo !== 'scrypt') return false;
    const sal = Buffer.from(salB64, 'base64');
    const esperada = Buffer.from(chaveB64, 'base64');
    const derivada = crypto.scryptSync(String(senha), sal, esperada.length, {
      N: Number(N), r: Number(r), p: Number(p),
    });
    return derivada.length === esperada.length && crypto.timingSafeEqual(derivada, esperada);
  } catch {
    return false;
  }
}

/* -------------------- Sessao -------------------- */

function assinar(dados) {
  return crypto.createHmac('sha256', config.sessionSecret).update(dados).digest('base64url');
}

export function criarToken(usuario) {
  const payload = Buffer.from(
    JSON.stringify({ u: usuario, exp: Date.now() + DURACAO_MS }),
    'utf8'
  ).toString('base64url');
  return `${payload}.${assinar(payload)}`;
}

export function lerToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, assinatura] = token.split('.');
  if (!payload || !assinatura) return null;
  const esperada = assinar(payload);
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const dados = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!dados.exp || dados.exp < Date.now()) return null;
    return dados;
  } catch {
    return null;
  }
}

function lerCookies(req) {
  const bruto = req.headers.cookie;
  if (!bruto) return {};
  return Object.fromEntries(
    bruto.split(';').map((parte) => {
      const i = parte.indexOf('=');
      const chave = decodeURIComponent(parte.slice(0, i).trim());
      const valor = decodeURIComponent(parte.slice(i + 1).trim());
      return [chave, valor];
    })
  );
}

export function definirCookieSessao(res, token) {
  const seguro = config.baseUrl.startsWith('https://');
  res.setHeader('Set-Cookie', [
    `${NOME_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DURACAO_MS / 1000}` +
      (seguro ? '; Secure' : ''),
  ]);
}

export function limparCookieSessao(res) {
  res.setHeader('Set-Cookie', [`${NOME_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`]);
}

export function sessaoDaRequisicao(req) {
  return lerToken(lerCookies(req)[NOME_COOKIE]);
}

/** Middleware: exige login para as rotas do painel. */
export function exigirLogin(req, res, proximo) {
  const sessao = sessaoDaRequisicao(req);
  if (!sessao) {
    return res.status(401).json({ erro: 'Sessao expirada. Entre novamente.' });
  }
  req.usuario = sessao.u;
  proximo();
}

/* -------------------- Limite de tentativas -------------------- */

const tentativas = new Map();

export function limitarTentativas({ chave, maximo = 8, janelaMs = 10 * 60 * 1000 }) {
  const agora = Date.now();
  const registro = tentativas.get(chave);
  if (!registro || agora - registro.inicio > janelaMs) {
    tentativas.set(chave, { inicio: agora, contador: 1 });
    return { permitido: true, restantes: maximo - 1 };
  }
  registro.contador += 1;
  if (registro.contador > maximo) {
    return {
      permitido: false,
      esperarSegundos: Math.ceil((janelaMs - (agora - registro.inicio)) / 1000),
    };
  }
  return { permitido: true, restantes: maximo - registro.contador };
}

export function limparTentativas(chave) {
  tentativas.delete(chave);
}

export function ipDaRequisicao(req) {
  const encaminhado = req.headers['x-forwarded-for'];
  if (typeof encaminhado === 'string' && encaminhado) return encaminhado.split(',')[0].trim();
  return req.socket?.remoteAddress ?? 'desconhecido';
}
