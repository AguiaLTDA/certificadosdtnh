# Colocar a plataforma no ar em um VPS Ubuntu/Debian

Guia direto, na ordem em que você deve executar, para deixar a plataforma **disponível 24
horas por dia**, com **reinício automático** se o processo cair ou o servidor reiniciar, e com
a **base de dados no Google Drive** (o servidor não guarda os certificados — só executa o
código).

Tempo estimado: 20–30 minutos, a maior parte esperando comandos rodarem.

---

## O que você precisa ter em mãos

- [ ] Um VPS com **Ubuntu 22.04/24.04** ou **Debian 11/12**, recém-criado
- [ ] O **IP público** desse VPS
- [ ] Acesso **root via SSH** (o provedor te dá isso na hora de criar o VPS)
- [ ] Um **domínio ou subdomínio** para apontar para ele (passo 0, abaixo)

---

## Passo 0 — Domínio

O QR Code impresso em cada certificado grava dentro de si o endereço da plataforma. Por isso,
**decida o domínio definitivo antes de emitir qualquer certificado real** — trocar depois
quebra todos os QR Codes já impressos (o código ainda pode ser digitado à mão, mas o link do
QR para de funcionar).

### Recomendado: um subdomínio do próprio univc.br

Algo como `certificados.univc.br`. É a opção mais séria para um documento institucional, e
não custa nada além do que a instituição já paga pelo domínio.

**Como fazer:**

1. Descubra quem administra o DNS do `univc.br` hoje — normalmente o setor de TI/webmaster,
   ou o painel do registrador do domínio (no Brasil, o mais comum é o
   [registro.br](https://registro.br), mas pode estar em Cloudflare, GoDaddy, ou outro).
2. Nesse painel, crie um registro **A** (endereço IPv4):
   - **Nome/Host:** `certificados`
   - **Aponta para (valor):** o IP público do seu VPS
   - **TTL:** o padrão sugerido serve
3. A propagação costuma levar de alguns minutos a poucas horas. Para conferir:
   ```bash
   dig +short certificados.univc.br
   ```
   Deve devolver o IP do VPS.

Se você não tem acesso a esse painel, peça para quem administra o domínio do UNIVC criar
esse registro — é uma tarefa de 2 minutos para quem já tem acesso.

### Se ainda não for possível mexer no univc.br agora

Duas saídas temporárias, para não travar o projeto:

- **Registrar um domínio novo, só para isto** (ex.: `certificadosunivc.com.br`, por volta de
  R$ 40/ano no registro.br). Migra para o subdomínio oficial depois, com uma nova emissão.
- **Usar só o IP por enquanto** (`http://<ip-do-vps>`), sabendo que **não há HTTPS** nesse
  caso e que **todo certificado emitido nesse período vira obsoleto** quando o domínio
  definitivo entrar (os QR Codes vão apontar para o IP, não mais válido). Só faz sentido para
  testar a plataforma, nunca para emitir certificados de verdade.

> Recomendo resolver o subdomínio oficial antes de emitir qualquer certificado que valha
> alguma coisa. É o único passo deste guia que depende de outra pessoa (quem administra o
> DNS), então comece por ele enquanto prepara o resto.

---

## Passo 1 — Repositório privado? Leia antes de clonar

Se `github.com/AguiaLTDA/certificadosdtnh` for **público**, pule este passo — `git clone`
funciona sem nada extra.

Se for **privado**, o VPS precisa de uma credencial para baixar o código. A forma recomendada
para servidor é uma **chave de implantação (deploy key)**, somente leitura, presa a este
repositório:

1. No VPS (ainda sem o código clonado), gere uma chave dedicada:
   ```bash
   ssh-keygen -t ed25519 -C "vps-certificados" -f /root/.ssh/deploy_certificados -N ""
   cat /root/.ssh/deploy_certificados.pub
   ```
2. Copie a saída (começa com `ssh-ed25519 ...`).
3. No GitHub: `AguiaLTDA/certificadosdtnh` → **Settings** → **Deploy keys** → **Add deploy
   key** → cole a chave pública. Não marque "Allow write access" — o servidor só precisa ler.
4. No VPS, configure o Git para usar essa chave só para este host:
   ```bash
   cat >> /root/.ssh/config <<'EOF'
   Host github.com-certificados
       HostName github.com
       User git
       IdentityFile /root/.ssh/deploy_certificados
       IdentitiesOnly yes
   EOF
   ```
5. Use esta URL ao clonar (no script do passo 2, na variável `REPO_URL`):
   ```
   git@github.com-certificados:AguiaLTDA/certificadosdtnh.git
   ```

Alternativa mais rápida (mas menos indicada para um servidor de longo prazo, porque o token
expira e precisa ser trocado): gerar um **Personal Access Token** de leitura em
**GitHub → Settings → Developer settings → Fine-grained tokens**, com acesso restrito a este
repositório, e clonar com
`https://<TOKEN>@github.com/AguiaLTDA/certificadosdtnh.git`.

---

## Passo 2 — Rodar o instalador no VPS

Conecte por SSH como root:

```bash
ssh root@<ip-do-vps>
```

Baixe e rode o script de instalação (ele está no próprio repositório, em
[`scripts/instalar-vps.sh`](../scripts/instalar-vps.sh)):

```bash
curl -fsSL -o instalar-vps.sh \
  https://raw.githubusercontent.com/AguiaLTDA/certificadosdtnh/main/scripts/instalar-vps.sh
chmod +x instalar-vps.sh

# Se o repositorio for privado, defina REPO_URL com a URL do passo 1:
# export REPO_URL="git@github.com-certificados:AguiaLTDA/certificadosdtnh.git"

sudo ./instalar-vps.sh certificados.univc.br
```

Troque `certificados.univc.br` pelo domínio que você decidiu no Passo 0.

**O que este script faz sozinho:**

- Instala Node.js 20, Nginx, Certbot, Git e o firewall (`ufw`)
- Cria um usuário de sistema dedicado (`certificados`) para rodar a aplicação — não como root
- Baixa o código em `/opt/certificados`
- Cria o serviço `systemd` (reinicia sozinho se cair, sobe junto com o servidor)
- Configura o Nginx como porta de entrada
- Abre as portas 22 (SSH), 80 e 443 (web) no firewall

Ele **não** mexe no `.env` nem tenta emitir HTTPS sozinho — isso é o Passo 3 e o Passo 4,
porque exigem decisões (segredos, confirmação de DNS) que só você deve tomar.

---

## Passo 3 — Gerar os segredos de produção (no seu computador, não no VPS)

Estes três valores devem ser gerados **na sua máquina de desenvolvimento** (onde você já tem
o repositório clonado e testou a plataforma), não no VPS — o Google Drive exige autorização
por navegador, que é mais simples de fazer no seu próprio computador.

### 3.1 — Senha do administrador

```bash
npm run setup:admin
```

Copie a linha `ADMIN_SENHA_HASH=...` que aparece no final.

### 3.2 — Segredos de sessão e de assinatura dos certificados

```bash
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('CODIGO_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

Guarde as duas linhas.

### 3.3 — Autorização do Google Drive

Siga [`docs/GOOGLE-DRIVE.md`](GOOGLE-DRIVE.md) até o final. Ao terminar, você terá:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
```

> Use uma conta Google **institucional** do UNIVC para isso, dedicada a este fim — não uma
> conta pessoal. É essa conta que vai guardar todos os certificados emitidos.

Guarde essas três linhas junto com as anteriores. No total você deve ter em mãos:
`ADMIN_SENHA_HASH`, `SESSION_SECRET`, `CODIGO_SECRET`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`.

---

## Passo 4 — Preencher o `.env` no VPS

De volta ao VPS (via SSH):

```bash
nano /opt/certificados/.env
```

Preencha assim (substitua os valores entre `<>` pelos que você gerou no Passo 3, e o domínio
pelo que você decidiu no Passo 0):

```env
BASE_URL=https://certificados.univc.br
PORT=3000

ADMIN_USUARIO=admin
ADMIN_SENHA_HASH=<cole aqui o hash gerado no passo 3.1>
SESSION_SECRET=<cole aqui o segredo gerado no passo 3.2>
CODIGO_SECRET=<cole aqui o outro segredo gerado no passo 3.2>

STORAGE_DRIVER=drive
GOOGLE_AUTH_MODE=oauth
GOOGLE_CLIENT_ID=<cole aqui>
GOOGLE_CLIENT_SECRET=<cole aqui>
GOOGLE_REFRESH_TOKEN=<cole aqui>
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback

ENTREGA_PDF=proxy

INSTITUICAO_NOME=Centro Universitario Vale do Cricare
INSTITUICAO_SIGLA=UNIVC
INSTITUICAO_MANTENEDORA=Instituto Vale do Cricare
INSTITUICAO_CIDADE=Sao Mateus
INSTITUICAO_UF=ES
INSTITUICAO_SITE=https://www.univc.br
INSTITUICAO_CNPJ=
INSTITUICAO_CREDENCIAMENTO=
```

Preencha `INSTITUICAO_CNPJ` e `INSTITUICAO_CREDENCIAMENTO` com os dados oficiais — eles ficam
vazios de propósito no modelo, para ninguém inventar números.

Salve (`Ctrl+O`, `Enter`, `Ctrl+X` no nano) e proteja o arquivo:

```bash
chown certificados:certificados /opt/certificados/.env
chmod 600 /opt/certificados/.env
```

---

## Passo 5 — Iniciar e emitir o HTTPS

```bash
systemctl start certificados
systemctl status certificados        # deve mostrar "active (running)"
curl -s http://127.0.0.1:3000/saude   # deve responder {"ok":true,...,"driver":"drive"}
```

Se `driver` aparecer como `"local"` em vez de `"drive"`, o `.env` não foi salvo corretamente
ou `STORAGE_DRIVER` não está como `drive` — confira com
`sudo -u certificados grep STORAGE_DRIVER /opt/certificados/.env`.

Confirmado que está tudo certo e que o DNS já propagou (Passo 0), emita o HTTPS gratuito:

```bash
certbot --nginx -d certificados.univc.br
```

O Certbot pergunta um e-mail de contato (para avisos de expiração — não deveria expirar
sozinho, ele renova automaticamente) e se quer redirecionar HTTP para HTTPS: **escolha que
sim**. A partir daqui, a renovação é automática (o pacote já instala um temporizador do
sistema para isso); confirme uma vez com:

```bash
certbot renew --dry-run
```

---

## Passo 6 — Verificação final

1. Abra `https://certificados.univc.br/` no navegador — deve aparecer a tela de login.
2. Entre com o usuário/senha definidos no Passo 3.1.
3. Cadastre um evento de teste e emita um certificado de teste para você mesmo.
4. Abra `https://certificados.univc.br/validar` em outro dispositivo (ou aponte a câmera do
   celular para o QR Code do PDF gerado) — deve mostrar os dados corretos.
5. Revogue esse certificado de teste no painel e confirme que a página pública passa a
   mostrar "revogado".
6. Exclua o certificado e o evento de teste.
7. No seu Google Drive, confirme que a pasta **Certificados UNIVC** foi criada, com o PDF de
   teste dentro de `certificados/`.

Se tudo isso funcionou, a plataforma está no ar, com a base de dados no Drive.

---

## Manter no ar

**Reinício automático:** já está configurado. Se o processo Node cair por qualquer motivo, o
`systemd` sobe de novo em até 5 segundos (`Restart=always`). Se o servidor inteiro reiniciar
(atualização do provedor, queda de energia), o serviço sobe sozinho no boot
(`systemctl enable` já foi feito pelo instalador).

**Atualizar para uma versão nova do código:**

```bash
sudo /opt/certificados/scripts/atualizar.sh
```

Isso busca a versão mais recente do repositório, reinstala dependências e reinicia o
serviço. Nenhum dado é afetado — eventos, certificados e PDFs moram no Google Drive, não
neste servidor.

**Ver o que está acontecendo (logs em tempo real):**

```bash
journalctl -u certificados -f
```

**Monitorar se o site cai (opcional, recomendado):** cadastre
`https://certificados.univc.br/saude` em um serviço gratuito de monitoramento externo, como o
[UptimeRobot](https://uptimerobot.com) (checagem a cada 5 minutos, grátis, avisa por e-mail
ou SMS se parar de responder). Isso avisa a instituição antes que um aluno perceba que a
validação está fora do ar.

**Atualizações de segurança do próprio Ubuntu (opcional, recomendado):**

```bash
apt-get install -y unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades
```

---

## Backup e o que NÃO perder

Os dados (eventos, certificados, PDFs) ficam no Google Drive — que já tem versionamento e
lixeira próprios. O VPS em si não guarda nada que não possa ser recriado, **exceto** o
arquivo `.env`, que contém segredos insubstituíveis:

- Perder `CODIGO_SECRET` não impede a plataforma de continuar funcionando, mas os selos
  digitais dos certificados já emitidos deixam de ser reconferíveis se você precisar recriar
  o arquivo do zero com um valor diferente. **Nunca troque esse valor** depois de emitir
  certificados — guarde-o.
- Perder o `GOOGLE_REFRESH_TOKEN` é recuperável (basta refazer a autorização em
  `docs/GOOGLE-DRIVE.md`), mas dá trabalho.

Guarde uma cópia do `.env` de produção em um cofre de senhas institucional (não em e-mail, não
em texto puro em disco). Muitos provedores de VPS também oferecem **snapshot** do servidor
inteiro — vale ativar, mesmo sendo dado recriável, para acelerar uma recuperação.

---

## Solução de problemas

| Sintoma | Causa provável |
|---|---|
| `systemctl status certificados` mostra `failed` | Rode `journalctl -u certificados -n 50` para ver o erro. Quase sempre é `.env` incompleto ou mal formatado. |
| `curl .../saude` mostra `"driver":"local"` | `STORAGE_DRIVER` não é `drive` no `.env`, ou o serviço não foi reiniciado depois de editar o arquivo (`systemctl restart certificados`). |
| `certbot` reclama que não consegue validar o domínio | O DNS ainda não propagou (confira com `dig +short seu-dominio`), ou a porta 80 está bloqueada no firewall do provedor (verifique também o firewall do painel do VPS, além do `ufw`). |
| Página abre mas fica em branco / erro 502 | O Nginx está de pé mas o Node não — confira `systemctl status certificados`. |
| `git clone` pede usuário/senha e trava | Repositório privado sem a chave de implantação configurada — veja o Passo 1. |
| Emiti um certificado e o QR Code não abre | O `BASE_URL` do `.env` não bate com o domínio real, ou o certificado foi emitido antes do domínio estar certo — vai precisar reemitir. |

---

## Referências

- [`scripts/instalar-vps.sh`](../scripts/instalar-vps.sh) — instalador automático (Passo 2)
- [`scripts/atualizar.sh`](../scripts/atualizar.sh) — atualização de versão (seção "Manter no ar")
- [`docs/GOOGLE-DRIVE.md`](GOOGLE-DRIVE.md) — autorização do Google Drive (Passo 3.3)
- [`docs/ARQUITETURA.md`](ARQUITETURA.md) — como o sistema funciona por dentro
- [`docs/IMPLANTACAO.md`](IMPLANTACAO.md) — visão geral de todas as formas de hospedar (Render, Railway, VPS)
