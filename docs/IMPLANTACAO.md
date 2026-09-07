# Colocar a plataforma no ar

O QR Code impresso no certificado aponta para o endereço configurado em `BASE_URL`.
Por isso, **defina o endereço definitivo antes de emitir certificados de verdade**: se a URL
mudar depois, os QR Codes já impressos deixam de funcionar (o código continua válido para
digitação manual, mas o link quebra).

Endereço sugerido: `https://certificados.univc.br`

---

## Antes de tudo: checklist de produção

- [ ] `BASE_URL` com o domínio final e **https**
- [ ] `ADMIN_SENHA_HASH` gerado com `npm run setup:admin` (senha forte, não a de teste)
- [ ] `SESSION_SECRET` e `CODIGO_SECRET` aleatórios e longos
- [ ] `STORAGE_DRIVER=drive` com o Google Drive conectado e testado
- [ ] `INSTITUICAO_CNPJ` e `INSTITUICAO_CREDENCIAMENTO` preenchidos com os dados oficiais
- [ ] Logotipo oficial enviado pelo painel
- [ ] Um certificado de teste emitido, impresso e validado pelo QR Code em um celular

Gerar segredos:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Opção 1 — Render (mais simples)

1. Suba o repositório no GitHub (já está em `AguiaLTDA/certificadosdtnh`).
2. Em <https://render.com>: **New** → **Web Service** → conecte o repositório.
3. Configuração:
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. Em **Environment**, cadastre as variáveis do `.env` (uma a uma; nunca suba o arquivo).
   Use `PORT` conforme a plataforma indicar — o código já lê `process.env.PORT`.
5. Em **Settings → Custom domain**, aponte `certificados.univc.br`. O HTTPS é automático.
6. Ajuste `BASE_URL=https://certificados.univc.br` e faça um novo deploy.

> No plano gratuito o serviço hiberna após um tempo sem acesso e a primeira visita demora
> alguns segundos. Para uso institucional, prefira um plano pago ou a Opção 3.

---

## Opção 2 — Railway

1. <https://railway.app> → **New Project** → **Deploy from GitHub repo**.
2. Cadastre as variáveis em **Variables**.
3. **Settings → Networking → Generate Domain** (ou domínio próprio).
4. Atualize `BASE_URL` e redeploy.

---

## Opção 3 — Servidor próprio (VPS ou servidor do UNIVC)

Em Ubuntu/Debian:

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx

# Aplicação
sudo mkdir -p /opt/certificados && sudo chown $USER /opt/certificados
git clone https://github.com/AguiaLTDA/certificadosdtnh.git /opt/certificados
cd /opt/certificados
npm ci --omit=dev
cp .env.example .env
nano .env          # preencha tudo
```

### Serviço systemd

`/etc/systemd/system/certificados.service`:

```ini
[Unit]
Description=Plataforma de Certificados UNIVC
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/certificados
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now certificados
sudo systemctl status certificados
```

### Nginx como proxy reverso

`/etc/nginx/sites-available/certificados`:

```nginx
server {
    listen 80;
    server_name certificados.univc.br;

    client_max_body_size 12M;   # uploads de logotipo/assinatura

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;   # lotes grandes de emissão demoram
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/certificados /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# HTTPS gratuito
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d certificados.univc.br
```

O código já usa `app.set('trust proxy', 1)` e marca o cookie de sessão como `Secure` quando
`BASE_URL` começa com `https://`.

---

## Atualizar a plataforma

```bash
cd /opt/certificados
git pull
npm ci --omit=dev
sudo systemctl restart certificados
```

Nada é perdido: os dados moram no Google Drive, não no servidor.

---

## Backup

Os dados ficam no Drive, que já tem versionamento e lixeira. Ainda assim, para uma cópia fria:

1. Baixe a pasta `Certificados UNIVC` inteira (Google Drive → botão direito → **Fazer download**).
2. Guarde o `.env` em um cofre de senhas — sem `CODIGO_SECRET` você não consegue reconferir os
   selos digitais dos certificados já emitidos.

Se um dia a plataforma sair do ar, os PDFs continuam legíveis e íntegros no Drive; o que se
perde é a página de validação online.

---

## Depois de subir, teste

```bash
curl https://certificados.univc.br/saude
```

Deve responder com `"ok": true` e `"driver": "drive"`. Em seguida:

1. Emita um certificado de teste.
2. Imprima o PDF.
3. Aponte a câmera do celular para o QR Code — tem de abrir a página de validação com os dados certos.
4. Revogue esse certificado de teste e confirme que a página passa a acusar a revogação.
5. Exclua o certificado e o evento de teste.
