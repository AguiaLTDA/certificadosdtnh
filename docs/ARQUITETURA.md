# Arquitetura

Documento para quem for dar manutenção na plataforma.

---

## Visão geral

```
Navegador (painel)  ──►  /api/*            ──►  serviços  ──►  storage  ──►  Google Drive
Navegador (público) ──►  /validar/:codigo                                    (ou disco local)
QR Code do PDF      ──►  /validar/:codigo
```

Um único processo Node.js serve as duas frentes: o painel autenticado e a página pública de
validação. Não há build — o front é HTML, CSS e JavaScript puros servidos como arquivos estáticos.

---

## Camadas

| Camada | Arquivos | Responsabilidade |
|---|---|---|
| HTTP | `src/server.js`, `src/routes/*` | Rotas, sessão, tratamento de erro |
| Regras | `src/services/certificados.js` | Emitir, reemitir, revogar, validar |
| Documento | `src/services/pdf.js`, `src/templates/*` | Desenhar o PDF |
| Texto | `src/services/vocalizacao.js` | Marcadores `{{...}}` |
| Identidade | `src/brand/univc.js`, `src/services/identidade.js` | Paleta, logotipo, assinaturas |
| Dados | `src/services/db.js` | Coleções JSON, cache, fila de gravação |
| Armazenamento | `src/services/storage.js`, `src/services/drive.js` | Drive ou disco, mesma interface |

A regra que mantém tudo desacoplado: **nada além de `storage.js` conhece o Google Drive**.
Trocar o Drive por S3, por um banco ou pelo disco significa escrever um novo driver com os
mesmos métodos.

---

## Modelo de dados

Três arquivos JSON em `base-de-dados/`.

### `eventos.json` — lista de eventos

```jsonc
{
  "id": "evt_<uuid>",
  "tema": "Semana Academica de Inovacao",   // tema do evento (texto)
  "subtitulo": "Tecnologia, sociedade e futuro",
  "tipo": "Semana academica",
  "modalidade": "Presencial",
  "cargaHoraria": 20,
  "dataInicio": "2026-03-16",
  "dataFim": "2026-03-20",
  "local": "Campus Sede",
  "cidade": "Sao Mateus/ES",
  "papelPadrao": "participante",
  "tituloCertificado": "Certificado",
  "subtituloCertificado": "de participacao",
  "vocalizacao": "Certificamos que {{nome}}...",
  "conteudoProgramatico": "Modulo 1...",     // se preenchido, gera a 2a pagina
  "destacarNome": true,
  "ocultarCidadeData": false,
  "assinaturas": [{ "nome": "", "cargo": "", "imagemId": null }],
  "temaVisual": {                            // tema VISUAL, não confundir com "tema"
    "templateId": "classico",
    "orientacao": "paisagem",
    "corPrimaria": "#00305b",
    "corSecundaria": "#0a6eb4",
    "corDestaque": "#c6a04e",
    "marcaDagua": true,
    "ornamentos": true
  },
  "criadoEm": "...", "atualizadoEm": "..."
}
```

> **Cuidado com os dois "temas".** `tema` é o assunto do evento (vai impresso no certificado);
> `temaVisual` é a aparência. Os nomes vêm do vocabulário do usuário e foram mantidos.

### `certificados.json` — um registro por certificado

```jsonc
{
  "id": "cert_<uuid>",
  "codigo": "UNIVC-XXXX-XXXX-XXXX",
  "eventoId": "evt_<uuid>",
  "temaEvento": "...",          // cópia do tema no momento da emissão
  "nome": "Maria Aparecida de Souza",
  "documento": "12345678900",
  "email": "maria@exemplo.com",
  "papel": "participante",
  "cargaHoraria": 20,           // pode diferir da do evento
  "observacao": "",
  "emitidoEm": "2026-03-21T12:00:00.000Z",
  "atualizadoEm": "...",
  "status": "valido",           // valido | revogado
  "versao": 1,                  // sobe a cada reemissão
  "selo": "<hmac-sha256 hex>",
  "arquivoId": "<id no Drive>",
  "arquivoNome": "UNIVC-...-maria-aparecida-de-souza.pdf",
  "arquivoLink": null,
  "tamanhoBytes": 9107
}
```

### `configuracao.json` — ajustes globais

```jsonc
{ "logoId": "<id no Drive>", "logoNome": "logotipo-univc.png", "assinaturasPadrao": [] }
```

---

## Código de autenticação e selo

**Código** (`src/services/codigo.js`): 12 caracteres sorteados do alfabeto Crockford Base32
(`0-9`, `A-Z` sem `I`, `L`, `O`, `U`), no formato `UNIVC-XXXX-XXXX-XXXX`.
São 32¹² ≈ 1,15 × 10¹⁸ combinações — colisão é desprezível, e ainda assim a emissão confere
se o código já existe antes de usar.

`normalizarCodigo()` aceita o que a pessoa digitar (minúsculas, sem hífen, com espaços) e
devolve o formato canônico — ou `null` se não tiver 12 caracteres.

**Selo**: `HMAC-SHA256(CODIGO_SECRET, payloadCanonico)` onde o payload é

```
codigo | nome | documento | eventoId | temaEvento | cargaHoraria | papel | emitidoEm
```

Serve contra adulteração do registro **no Drive**, não contra falsificação do PDF impresso —
para isso a defesa é o QR Code, que consulta a base ao vivo.

Duas consequências práticas:

- **Nunca troque `CODIGO_SECRET`** depois de emitir. Todos os selos passariam a divergir.
- **Não altere `payloadCanonico()`** sem reemitir tudo — os campos e a ordem fazem parte do selo.

---

## Geração do PDF

1. `vocalizacao.js` troca os marcadores pelos dados reais.
2. `dividirVocalizacao()` procura o nome dentro do texto e o separa em "antes" e "depois",
   para imprimir o nome em destaque sem obrigar o usuário a escrever o texto em partes.
   Se o nome não aparecer no texto, o texto inteiro vai para "depois".
3. `qr.js` gera o QR Code apontando para `BASE_URL/validar/<codigo>`.
4. O layout escolhido desenha a página com as primitivas de `templates/base.js`.
5. O PDF volta como `Buffer` e é gravado no Drive.

**Ajuste automático de tamanho.** Nomes longos e textos longos são a principal fonte de layout
quebrado. `blocoCorpo()` mede o bloco (texto de abertura + nome + corpo) antes de desenhar,
reduz a fonte até caber e centraliza verticalmente o conjunto no espaço livre. Por isso os
blocos de rodapé (cidade/data, assinaturas, autenticação) são ancorados na **base** da página,
não empilhados a partir do topo.

**Fontes.** Usamos as 14 fontes padrão do PDF (Helvetica, Times), que cobrem os acentos do
português e não exigem arquivos embutidos — o PDF fica em torno de 7–9 KB. Para usar a fonte
institucional, registre o TTF com `doc.registerFont()` em `pdf.js` e aponte os nomes em
`brand.fontes`.

### Criar um novo layout

1. Escreva a função em `src/templates/layouts.js` com a assinatura `(doc, tema, dados)`.
2. Registre em `LAYOUTS` com `id`, `nome` e `descricao`.
3. Pronto: o painel lista o novo layout sozinho (vem de `GET /api/estado`).

Obrigatório em todo layout: chamar `blocoAutenticacao()`. É o que torna o certificado
verificável, e a plataforma não faz sentido sem isso.

---

## Concorrência e limites

`db.js` mantém as coleções em memória e serializa as gravações numa fila
(`enfileirar()`), de modo que duas requisições simultâneas não sobrescrevam uma à outra.

Isso pressupõe **um único processo**. Consequências:

- Não rode duas instâncias (nem `cluster`, nem duas réplicas) sobre o mesmo Drive: a última
  gravação venceria e apagaria a outra.
- Se alguém editar os JSON direto no Drive com o servidor no ar, a alteração só aparece após
  reiniciar (o cache não é invalidado de fora).

**Escala.** O modelo aguenta confortavelmente a casa das dezenas de milhares de certificados.
O gargalo é gravar o arquivo inteiro a cada mutação: com ~50 mil registros o
`certificados.json` passa de 20 MB e cada emissão fica lenta. Sinais de que é hora de migrar
para um banco relacional (PostgreSQL ou SQLite):

- mais de ~30 mil certificados;
- necessidade de vários operadores emitindo ao mesmo tempo;
- necessidade de mais de uma instância da aplicação.

A migração é localizada: reescrever `db.js` mantendo a mesma interface. `storage.js` continua
guardando os PDFs no Drive.

**Emissão em lote:** limite de 500 por requisição, com 3 PDFs em paralelo (`CONCORRENCIA`),
para não estourar a cota da API do Drive. Um lote de 300 certificados leva alguns minutos.

---

## Rotas

### Públicas

| Método | Rota | Descrição |
|---|---|---|
| GET | `/validar` | Página de validação |
| GET | `/validar/:codigo` | Mesma página, já consultando o código |
| GET | `/c/:codigo` | Atalho curto → redireciona para `/validar/:codigo` |
| GET | `/api/publico/validar/:codigo` | JSON da validação (60 consultas / 5 min por IP) |
| GET | `/api/publico/certificado/:codigo/pdf` | PDF, se `ENTREGA_PDF=proxy` e não revogado |
| GET | `/api/publico/instituicao` | Dados institucionais para a página |
| GET | `/saude` | Verificação de saúde e do armazenamento |

### Painel (exigem sessão)

| Método | Rota |
|---|---|
| POST / DELETE / GET | `/api/sessao` |
| GET | `/api/estado`, `/api/estatisticas` |
| GET POST PUT DELETE | `/api/eventos`, `/api/eventos/:id` |
| POST | `/api/previa`, `/api/previa-texto` |
| POST | `/api/eventos/:id/importar-csv`, `/api/eventos/:id/emitir`, `/api/eventos/:id/reemitir` |
| GET | `/api/eventos/:id/relatorio.csv` |
| GET | `/api/certificados`, `/api/certificados/:id/pdf` |
| POST | `/api/certificados/:id/reemitir`, `/revogar`, `/reativar` |
| DELETE | `/api/certificados/:id` |
| POST DELETE | `/api/identidade/logo` |
| POST GET | `/api/identidade/assinatura`, `/api/identidade/imagem?id=` |

---

## Decisões de projeto

**Por que JSON no Drive em vez de um banco?** Foi um requisito: o Drive é a base de dados.
A vantagem real é que a instituição enxerga e leva embora os próprios dados — os PDFs estão
lá, legíveis, mesmo que a plataforma saia do ar.

**Por que PDFKit e não HTML → PDF?** Uma conversão via navegador (Puppeteer) traria ~300 MB de
Chromium e um processo pesado por certificado. PDFKit gera um A4 em poucos milissegundos, sem
binário externo, o que viabiliza emissão em lote em hospedagem modesta.

**Por que o PDF passa pela plataforma (`ENTREGA_PDF=proxy`)?** Para não tornar arquivos com
CPF e nome completo públicos no Drive. Quem tem o código vê o documento; o resto, não.

**Por que sem framework no front?** Uma tela de operação simples, sem build, que qualquer
pessoa consegue abrir, ler e ajustar daqui a três anos.
