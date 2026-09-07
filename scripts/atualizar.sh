#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Atualiza a Plataforma de Certificados UNIVC ja instalada no VPS
# (busca a versao mais nova do codigo e reinicia o servico).
#
# Nada dos dados e afetado: eventos, certificados e PDFs moram no Google
# Drive, nao neste servidor.
#
# COMO RODAR (como root, no VPS):
#   sudo /opt/certificados/scripts/atualizar.sh
# ---------------------------------------------------------------------------
set -euo pipefail

APP_DIR="/opt/certificados"
APP_USER="certificados"

if [[ $EUID -ne 0 ]]; then
  echo "Rode como root (ou com sudo)."
  exit 1
fi

echo "--- Buscando atualizacoes do repositorio ---------------------"
sudo -u "$APP_USER" git -C "$APP_DIR" pull

echo "--- Instalando dependencias ------------------------------------"
sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && npm ci --omit=dev"

echo "--- Reiniciando o servico ---------------------------------------"
systemctl restart certificados
sleep 2
systemctl status certificados --no-pager

echo ""
echo "Atualizado. Confira com: curl -s http://127.0.0.1:3000/saude"
