# Conectar o Google Drive

A plataforma usa o Google Drive como base de dados: os registros (JSON), os PDFs emitidos e
a identidade visual ficam todos na sua conta. Este documento mostra como autorizar o acesso.

Existem dois modos. **Use o modo OAuth**, salvo se a instituição já usa um Shared Drive
gerenciado (aí vale a conta de serviço).

| Modo | Onde os arquivos ficam | Quando usar |
|---|---|---|
| `oauth` | No **seu** Drive (ou no Drive institucional do Google Workspace) | Recomendado |
| `service_account` | Só funciona bem em **Shared Drive** | TI corporativa |

> Conta de serviço não tem cota própria no "Meu Drive" do Google. Se você usar esse modo
> apontando para uma pasta pessoal, o upload falha com erro de cota. Por isso o padrão é OAuth.

---

## Modo OAuth (recomendado)

### 1. Criar o projeto no Google Cloud

1. Acesse <https://console.cloud.google.com/>.
2. No seletor de projetos (topo da tela), clique em **Novo projeto**.
3. Nome sugerido: `Certificados UNIVC`. Clique em **Criar**.

### 2. Ativar a Google Drive API

1. Menu lateral → **APIs e serviços** → **Biblioteca**.
2. Busque por **Google Drive API**.
3. Clique em **Ativar**.

### 3. Configurar a tela de consentimento

1. **APIs e serviços** → **Tela de permissão OAuth**.
2. Tipo de usuário:
   - **Interno** se a conta é do Google Workspace do UNIVC (mais simples, sem verificação).
   - **Externo** se for uma conta Gmail comum.
3. Preencha nome do app (`Certificados UNIVC`), e-mail de suporte e e-mail do desenvolvedor.
4. Em **Escopos**, não é preciso adicionar nada nesta tela.
5. Se escolheu **Externo**, vá em **Usuários de teste** e adicione o e-mail da conta que vai
   guardar os certificados. Sem isso o Google bloqueia a autorização.

> Com o app em modo "Teste", o refresh token expira em **7 dias**. Para produção, publique o
> app (**Publicar aplicativo** na tela de consentimento). Como o escopo do Drive é sensível,
> apps **Externos** publicados podem exigir verificação do Google — mais um motivo para usar
> **Interno** com a conta institucional.

### 4. Criar as credenciais OAuth

1. **APIs e serviços** → **Credenciais** → **Criar credenciais** → **ID do cliente OAuth**.
2. Tipo de aplicativo: **App para computador** (*Desktop app*).
3. Nome: `Certificados UNIVC - setup`.
4. Copie o **ID do cliente** e a **Chave secreta do cliente**.

### 5. Preencher o `.env`

```env
GOOGLE_AUTH_MODE=oauth
GOOGLE_CLIENT_ID=000000000000-xxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
```

Se o tipo escolhido foi "App para Web" em vez de "App para computador", adicione
`http://localhost:3000/oauth2callback` em **URIs de redirecionamento autorizados**.

### 6. Autorizar

Com o servidor da plataforma **parado** (o script sobe um servidor temporário na mesma porta):

```bash
npm run setup:google
```

O terminal mostra um endereço. Abra no navegador **logado na conta que vai guardar os
certificados**, autorize e volte ao terminal. Ele imprime:

```
GOOGLE_REFRESH_TOKEN=1//0gxxxxxxxxxxxxxxxxxxxxx
```

Cole essa linha no `.env`.

### 7. Ligar o modo Drive

```env
STORAGE_DRIVER=drive
```

Reinicie (`npm start`). No painel, a aba **Painel** deve mostrar
**"Google Drive conectado"** com o e-mail da conta e o ID da pasta raiz.

Teste também pela linha de comando:

```bash
curl http://localhost:3000/saude
```

---

## Escolher uma pasta específica do Drive

Por padrão a plataforma cria a pasta **Certificados UNIVC** na raiz do Drive.
Para usar uma pasta que já existe:

1. Abra a pasta no Google Drive.
2. Copie o ID da URL — em
   `https://drive.google.com/drive/folders/1A2B3C4D5E6F7G8H9I`
   o ID é `1A2B3C4D5E6F7G8H9I`.
3. No `.env`:

```env
DRIVE_PASTA_RAIZ_ID=1A2B3C4D5E6F7G8H9I
```

---

## Modo conta de serviço (Shared Drive)

1. **APIs e serviços** → **Credenciais** → **Criar credenciais** → **Conta de serviço**.
2. Criada a conta, abra-a → aba **Chaves** → **Adicionar chave** → **Criar nova chave** → **JSON**.
3. Salve o arquivo em `credenciais/google-service-account.json` (essa pasta está no `.gitignore`).
4. No Google Drive, crie um **Drive compartilhado** e compartilhe-o com o e-mail da conta de
   serviço (algo como `certificados@projeto.iam.gserviceaccount.com`) com permissão de
   **Gerenciador de conteúdo**.
5. Pegue o ID do Drive compartilhado (mesma lógica do item anterior).
6. No `.env`:

```env
STORAGE_DRIVER=drive
GOOGLE_AUTH_MODE=service_account
GOOGLE_SERVICE_ACCOUNT_FILE=./credenciais/google-service-account.json
DRIVE_PASTA_RAIZ_ID=<id-do-drive-compartilhado>
```

Em hospedagens que não permitem subir arquivos (Render, Railway, Heroku), cole o conteúdo do
JSON inteiro, em uma linha só, na variável `GOOGLE_SERVICE_ACCOUNT_JSON`.

---

## Problemas comuns

| Mensagem | Causa e solução |
|---|---|
| `GOOGLE_REFRESH_TOKEN nao configurado` | Rode `npm run setup:google` e cole o token no `.env`. |
| O Google não devolveu um refresh token | A conta já havia autorizado o app. Remova o acesso em <https://myaccount.google.com/permissions> e rode de novo. |
| `invalid_grant` depois de alguns dias | App em modo "Teste" (token de 7 dias). Publique o app na tela de consentimento e gere o token de novo. |
| `redirect_uri_mismatch` | O `GOOGLE_REDIRECT_URI` do `.env` não está cadastrado nas credenciais do Google Cloud. |
| `Service Accounts do not have storage quota` | Modo conta de serviço apontando para pasta pessoal. Use um Shared Drive ou troque para o modo OAuth. |
| `insufficientFilePermissions` | A conta autorizada não tem permissão de escrita na pasta indicada em `DRIVE_PASTA_RAIZ_ID`. |

---

## Migrar do modo local para o Drive

Se você testou com `STORAGE_DRIVER=local` e quer levar os dados para o Drive:

1. Configure o Drive e suba a plataforma uma vez com `STORAGE_DRIVER=drive` (ela cria as pastas).
2. No Drive, dentro de `Certificados UNIVC/base-de-dados/`, envie os arquivos
   `eventos.json`, `certificados.json` e `configuracao.json` da pasta `dados-locais/base-de-dados/`.
3. Reinicie a plataforma.
4. No painel, abra cada evento e clique em **Reemitir todos os certificados deste evento** —
   isso regera os PDFs direto no Drive, preservando os códigos.

O caminho inverso (Drive → local) é o mesmo, na direção contrária.
