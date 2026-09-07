#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Instala a Plataforma de Certificados UNIVC em um VPS Ubuntu/Debian.
#
# O QUE ESTE SCRIPT FAZ:
#   - Instala Node.js 20, Nginx, Certbot, Git e o firewall (ufw)
#   - Cria um usuario de sistema dedicado para rodar a aplicacao (nao root)
#   - Baixa o codigo em /opt/certificados
#   - Cria o servico systemd (reinicia sozinho se cair, sobe junto com o SO)
#   - Configura o Nginx como proxy reverso
#   - Emite o certificado HTTPS gratuito (Let's Encrypt) via Certbot
#   - Abre as portas 22, 80 e 443 no firewall
#
# O QUE ESTE SCRIPT NAO FAZ (por seguranca, exige que VOCE faca a mao):
#   - Preencher o arquivo .env com os segredos de producao
#   - Autorizar o Google Drive (isso e feito no SEU computador, nao no VPS)
#
# COMO RODAR (como root, em um VPS Ubuntu 22.04/24.04 ou Debian 11/12 novo):
#
#   curl -fsSL -o instalar-vps.sh \
#     https://raw.githubusercontent.com/AguiaLTDA/certificadosdtnh/main/scripts/instalar-vps.sh
#   chmod +x instalar-vps.sh
#   sudo ./instalar-vps.sh certificados.univc.br
#
# Se o repositorio for privado, veja a secao "Repositorio privado" em
# docs/VPS-UBUNTU.md antes de rodar este script.
# ---------------------------------------------------------------------------
set -euo pipefail

DOMINIO="${1:-}"
REPO_URL="${REPO_URL:-https://github.com/AguiaLTDA/certificadosdtnh.git}"
APP_DIR="/opt/certificados"
APP_USER="certificados"

if [[ -z "$DOMINIO" ]]; then
  echo "Uso: sudo $0 seu-dominio.com.br"
  echo "Exemplo: sudo $0 certificados.univc.br"
  exit 1
fi

if [[ $EUID -ne 0 ]]; then
  echo "Rode este script como root (ou com sudo)."
  exit 1
fi

echo "=============================================================="
echo " Plataforma de Certificados UNIVC - instalacao"
echo " Dominio: $DOMINIO"
echo " Repositorio: $REPO_URL"
echo "=============================================================="

echo ""
echo "--- 1/8 Atualizando o sistema -------------------------------"
apt-get update -y
apt-get upgrade -y

echo ""
echo "--- 2/8 Instalando Node.js 20, Git, Nginx, Certbot ----------"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | grep -oE '^v[0-9]+' | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "Node.js $(node -v) ja instalado, pulando."
fi
apt-get install -y git nginx certbot python3-certbot-nginx ufw
node -v
npm -v

echo ""
echo "--- 3/8 Criando usuario de sistema '$APP_USER' --------------"
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
  echo "Usuario '$APP_USER' criado."
else
  echo "Usuario '$APP_USER' ja existe, pulando."
fi

echo ""
echo "--- 4/8 Baixando o codigo em $APP_DIR ------------------------"
if [[ -d "$APP_DIR/.git" ]]; then
  echo "Repositorio ja existe em $APP_DIR, atualizando..."
  git -C "$APP_DIR" pull
else
  git clone "$REPO_URL" "$APP_DIR"
fi
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

echo ""
echo "--- 5/8 Instalando dependencias (producao) ------------------"
sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && npm ci --omit=dev"

if [[ ! -f "$APP_DIR/.env" ]]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  chown "$APP_USER":"$APP_USER" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
  echo ""
  echo "*** ATENCAO: criei $APP_DIR/.env a partir do modelo. ***"
  echo "*** Ele ainda esta com valores de exemplo. Edite-o agora: ***"
  echo "***   nano $APP_DIR/.env ***"
  echo "*** Veja docs/VPS-UBUNTU.md para saber o que preencher. ***"
else
  echo "$APP_DIR/.env ja existe, nao foi sobrescrito."
fi

echo ""
echo "--- 6/8 Criando o servico systemd ----------------------------"
cat > /etc/systemd/system/certificados.service <<EOF
[Unit]
Description=Plataforma de Certificados UNIVC
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=$(command -v node) src/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

# Enrijecimento basico (o processo nao precisa de mais que isto)
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=$APP_DIR

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable certificados
echo "Servico 'certificados' criado e habilitado (ainda nao iniciado -- falta o .env)."

echo ""
echo "--- 7/8 Configurando o Nginx ---------------------------------"
cat > /etc/nginx/sites-available/certificados <<EOF
server {
    listen 80;
    server_name $DOMINIO;

    client_max_body_size 12M;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }
}
EOF
ln -sf /etc/nginx/sites-available/certificados /etc/nginx/sites-enabled/certificados
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo ""
echo "--- 8/8 Firewall (ufw) ----------------------------------------"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status

echo ""
echo "=============================================================="
echo " Infraestrutura pronta. FALTAM 3 PASSOS MANUAIS:"
echo "=============================================================="
echo ""
echo " 1) Confirme que o DNS de $DOMINIO ja aponta para o IP deste"
echo "    servidor (dig +short $DOMINIO deve devolver o IP do VPS)."
echo ""
echo " 2) Edite $APP_DIR/.env com os valores de producao:"
echo "      nano $APP_DIR/.env"
echo "    (veja docs/VPS-UBUNTU.md - secao 'Preencher o .env')"
echo ""
echo " 3) Depois de salvar o .env, rode:"
echo "      systemctl start certificados"
echo "      systemctl status certificados"
echo "      certbot --nginx -d $DOMINIO"
echo ""
echo "=============================================================="
