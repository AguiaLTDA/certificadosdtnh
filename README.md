# Plataforma de Certificados — UNIVC

Emissão, autenticação e validação pública de certificados em PDF do
**Centro Universitário Vale do Cricaré (UNIVC)**, com o **Google Drive como base de dados**
e armazenamento dos arquivos.

Cada certificado sai com um **código de autenticação único** e um **QR Code** que leva à
página pública de validação da própria plataforma.

---

## O que a plataforma faz

| Recurso | Descrição |
|---|---|
| **Layouts prontos** | 4 layouts desenhados pela plataforma: Clássico, Moderno, Minimalista e Institucional |
| **Tema editável** | Cores, orientação (A4 paisagem/retrato), marca d'água, ornamentos, título e subtítulo |
| **Carga horária** | Definida por evento e sobrescrita por participante; impressa por extenso |
| **Vocalização** | O texto declarado no certificado é livre, com marcadores `{{nome}}`, `{{tema}}`, `{{cargaHoraria}}`… |
| **Código + QR Code** | Todo certificado leva `UNIVC-XXXX-XXXX-XXXX` e um QR Code apontando para `/validar/<código>` |
| **Selo digital** | HMAC-SHA256 dos dados: se alguém editar o registro no Drive por fora, a validação acusa divergência |
| **Emissão em lote** | Cole a lista ou envie um CSV (Excel, Google Sheets, Google Forms) |
| **Google Drive** | PDFs, registros JSON e identidade visual ficam no seu Drive |
| **Validação pública** | Página aberta, sem login, com opção de imprimir o comprovante |
| **Revogação** | Um certificado pode ser revogado sem sumir do registro |
| **Relatório** | Exportação CSV por evento, com o link de validação de cada pessoa |
| **Identidade UNIVC** | Logotipo, nome, mantenedora, cidade, site, CNPJ e credenciamento no documento |

---

## Instalação rápida

Requisitos: **Node.js 20 ou superior**.

```bash
git clone https://github.com/AguiaLTDA/certificadosdtnh.git
cd certificadosdtnh
npm install
cp .env.example .env
```

Gere a senha do administrador e cole o resultado no `.env`:

```bash
npm run setup:admin
```

Gere dois segredos aleatórios e coloque em `SESSION_SECRET` e `CODIGO_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Suba a plataforma:

```bash
npm start
```

- Painel: <http://localhost:3000/>
- Validação pública: <http://localhost:3000/validar>

Sem configurar o Google, a plataforma roda em modo local (`STORAGE_DRIVER=local`) e grava
tudo em `./dados-locais`. É o modo recomendado para testar antes de conectar o Drive.

Para ver os quatro layouts sem subir o servidor:

```bash
node scripts/amostras.js amostras
```

---

## Conectar o Google Drive

O passo a passo completo, com prints das telas do Google Cloud, está em
**[docs/GOOGLE-DRIVE.md](docs/GOOGLE-DRIVE.md)**. Resumo:

1. Crie um projeto no Google Cloud e ative a **Google Drive API**.
2. Crie credenciais **OAuth 2.0 (aplicativo para computador)** e anote *Client ID* e *Client secret*.
3. Preencha `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env`.
4. Rode `npm run setup:google`, autorize no navegador e cole o `GOOGLE_REFRESH_TOKEN` no `.env`.
5. Troque para `STORAGE_DRIVER=drive` e reinicie.

A plataforma cria sozinha esta estrutura no seu Drive:

```
Certificados UNIVC/
├── base-de-dados/     eventos.json, certificados.json, configuracao.json
├── certificados/      PDFs emitidos (uma subpasta por evento)
└── identidade/        logotipo e imagens de assinatura
```

---

## Uso no dia a dia

### 1. Cadastrar o evento
**Eventos → Novo evento.** Informe tema, carga horária, datas e local. Na mesma tela você
escolhe o layout, ajusta as cores, escreve o texto do certificado e cadastra até 4 assinaturas.
O botão **Ver prévia em PDF** mostra o resultado antes de emitir qualquer coisa.

### 2. Escrever a vocalização
O texto aceita marcadores que são trocados pelos dados reais na emissão:

```
Certificamos que {{nome}}, portador(a) do documento {{documento}},
participou na condição de {{papel}} do evento {{tema}}, realizado {{periodo}},
em {{local}}, com carga horária total de {{cargaHoraria}}.
```

Vira, no PDF:

> Certificamos que **Maria Aparecida de Souza**, portador(a) do documento 123.456.789-00,
> participou na condição de participante do evento Semana Acadêmica de Inovação e Tecnologia,
> realizado de 16 a 20 de março de 2026, em Campus Sede, com carga horária total de
> 20 (vinte) horas.

O nome sai em destaque automaticamente — não é preciso quebrar o texto em partes.
A lista completa de marcadores fica ao lado do editor, no painel.

### 3. Emitir
**Emitir certificados** → escolha o evento → cole a lista ou envie o CSV → **Conferir lista**
→ **Emitir certificados**. Formato aceito (só o nome é obrigatório):

```csv
nome;cpf;email;papel;carga horaria
Maria Aparecida de Souza;12345678900;maria@exemplo.com;participante;20
João Pedro Lima;98765432100;joao@exemplo.com;palestrante;4
```

Exemplo pronto: [`exemplos/participantes-exemplo.csv`](exemplos/participantes-exemplo.csv).

### 4. Validar
Quem recebe o certificado lê o QR Code ou digita o código em `/validar`. A página mostra
nome, evento, período, carga horária, data de emissão, selo digital e a situação do documento.

---

## Estrutura do projeto

```
src/
├── server.js              servidor Express (painel + página pública)
├── config.js              leitura do .env
├── brand/univc.js         identidade institucional: paleta, fontes, textos padrão
├── routes/
│   ├── api.js             API do painel (exige login)
│   └── publico.js         validação pública (sem login)
├── services/
│   ├── drive.js           cliente do Google Drive
│   ├── storage.js         abstração de armazenamento (Drive ou disco)
│   ├── db.js              coleções JSON com cache e gravação em fila
│   ├── certificados.js    emissão, reemissão, revogação, validação
│   ├── pdf.js             montagem do PDF
│   ├── vocalizacao.js     motor de marcadores {{...}}
│   ├── codigo.js          código de autenticação e selo HMAC
│   ├── qr.js              geração do QR Code
│   ├── identidade.js      logotipo e assinaturas
│   ├── csv.js             leitura/escrita de CSV
│   ├── auth.js            login, sessão e limite de tentativas
│   └── util.js            datas, números por extenso, CPF
└── templates/
    ├── base.js            primitivas de desenho
    └── layouts.js         os 4 layouts

public/                    painel (index.html), validação (validar.html), CSS e JS
scripts/                   setup:admin, setup:google, seed, amostras
tests/                     testes automatizados (npm test)
docs/                      Google Drive, implantação e arquitetura
```

---

## Comandos

| Comando | O que faz |
|---|---|
| `npm start` | Sobe a plataforma |
| `npm run dev` | Sobe com recarga automática |
| `npm run setup:admin` | Gera o hash da senha do administrador |
| `npm run setup:google` | Obtém o refresh token do Google Drive |
| `npm run seed` | Cria um evento e 3 certificados de demonstração |
| `npm test` | Roda os testes |
| `node scripts/amostras.js pasta` | Gera um PDF de amostra de cada layout |

---

## Segurança

- Senha do administrador guardada como **hash scrypt**; sessão em cookie **HttpOnly** assinado com HMAC.
- Limite de tentativas de login por IP e limite de consultas na validação pública
  (evita varredura automática de códigos).
- Código de autenticação com 12 caracteres do alfabeto Crockford Base32
  (sem `I`, `L`, `O`, `U` — não confunde `1`/`I` nem `0`/`O` na digitação).
- Selo HMAC-SHA256 sobre os dados canônicos do certificado.
- Por padrão (`ENTREGA_PDF=proxy`) os arquivos **não ficam públicos no Drive**: o PDF é servido
  pela plataforma apenas para quem tem o código.
- `.env`, `dados-locais/` e `credenciais/` estão no `.gitignore` — não versione segredos.

> **Atenção:** nunca altere `CODIGO_SECRET` depois de emitir certificados. Todos os selos já
> emitidos passariam a acusar divergência.

---

## Personalizar a identidade visual

- **Logotipo:** painel → *Identidade visual* → envie um PNG com fundo transparente
  (largura recomendada 600 px). Sem logotipo, a plataforma desenha um brasão vetorial com a sigla.
- **Cores:** a paleta institucional está em [`src/brand/univc.js`](src/brand/univc.js).
  Confira os códigos com o manual de marca do UNIVC e ajuste ali — o painel também permite
  sobrescrever as cores por evento.
- **Dados institucionais** (nome, mantenedora, CNPJ, credenciamento, site): variáveis
  `INSTITUICAO_*` no `.env`. Os campos de CNPJ e credenciamento vêm em branco de propósito —
  preencha com os dados oficiais.

---

## Documentação

- [docs/GOOGLE-DRIVE.md](docs/GOOGLE-DRIVE.md) — conectar o Google Drive passo a passo
- [docs/IMPLANTACAO.md](docs/IMPLANTACAO.md) — colocar no ar com domínio e HTTPS
- [docs/ARQUITETURA.md](docs/ARQUITETURA.md) — como funciona por dentro, modelo de dados e limites

---

## Licença

MIT — veja [LICENSE](LICENSE).
