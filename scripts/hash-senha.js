#!/usr/bin/env node
/**
 * Gera o hash da senha do administrador para colar em ADMIN_SENHA_HASH (.env).
 *
 *   npm run setup:admin
 *   npm run setup:admin -- "minha senha forte"
 */
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { gerarHashSenha } from '../src/services/auth.js';

const senhaArgumento = process.argv.slice(2).join(' ').trim();

async function perguntar() {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const senha = await rl.question('Senha do administrador: ');
  const confirmacao = await rl.question('Repita a senha: ');
  rl.close();
  if (senha !== confirmacao) {
    console.error('\nAs senhas nao conferem. Rode o comando novamente.');
    process.exit(1);
  }
  return senha;
}

const senha = senhaArgumento || (await perguntar());

if (senha.length < 8) {
  console.error('\nUse uma senha com pelo menos 8 caracteres.');
  process.exit(1);
}

console.log('\nCopie a linha abaixo para o seu arquivo .env:\n');
console.log(`ADMIN_SENHA_HASH=${gerarHashSenha(senha)}\n`);
