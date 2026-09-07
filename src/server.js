/**
 * Plataforma de Certificados UNIVC
 * Servidor HTTP: painel administrativo + pagina publica de validacao.
 */
import path from 'node:path';
import express from 'express';
import { config, RAIZ, avisosDeConfiguracao } from './config.js';
import { api } from './routes/api.js';
import { publico } from './routes/publico.js';
import { iniciarStorage, infoStorage } from './services/storage.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

// Cabecalhos de seguranca basicos.
app.use((req, res, proximo) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  proximo();
});

app.get('/saude', async (req, res) => {
  const armazenamento = await infoStorage();
  res.json({
    ok: armazenamento.ok,
    versao: '1.0.0',
    armazenamento,
    baseUrl: config.baseUrl,
    instituicao: config.instituicao.sigla,
  });
});

app.use(publico);
app.use('/api', api);

app.use(express.static(path.join(RAIZ, 'public'), { extensions: ['html'], maxAge: '1h' }));

app.get('/', (req, res) => res.sendFile(path.join(RAIZ, 'public', 'index.html')));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ erro: 'Rota nao encontrada.' });
  res.status(404).sendFile(path.join(RAIZ, 'public', '404.html'));
});

// Tratamento central de erros: nao vaza pilha para o cliente.
app.use((erro, req, res, proximo) => {
  console.error('[erro]', req.method, req.originalUrl, '-', erro.message);
  if (res.headersSent) return proximo(erro);
  const status = erro.status ?? (erro.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  res.status(status).json({
    erro:
      status === 413
        ? 'Arquivo grande demais. O limite e 8 MB.'
        : erro.message || 'Erro interno na plataforma.',
  });
});

async function iniciar() {
  const avisos = avisosDeConfiguracao();
  try {
    await iniciarStorage();
  } catch (erro) {
    console.error('\n[FALHA] Nao foi possivel preparar o armazenamento:', erro.message);
    console.error('Confira as variaveis do Google no arquivo .env (veja docs/GOOGLE-DRIVE.md).\n');
  }

  app.listen(config.porta, () => {
    const linha = '-'.repeat(64);
    console.log(`\n${linha}`);
    console.log(`  Plataforma de Certificados ${config.instituicao.sigla}`);
    console.log(linha);
    console.log(`  Painel     : ${config.baseUrl}/`);
    console.log(`  Validacao  : ${config.baseUrl}/validar`);
    console.log(`  Porta      : ${config.porta}`);
    console.log(`  Armazenam. : ${config.storage.driver === 'drive' ? 'Google Drive' : 'disco local (dados-locais/)'}`);
    if (avisos.length) {
      console.log(`${linha}\n  Avisos de configuracao:`);
      avisos.forEach((a) => console.log(`   - ${a}`));
    }
    console.log(`${linha}\n`);
  });
}

iniciar();
