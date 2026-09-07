# Imagem de producao da Plataforma de Certificados UNIVC.
#
# Nao inclui banco nem proxy TLS: este projeto so sobe a aplicacao Node e se
# conecta a uma rede Docker externa onde ja existe um Caddy publico fazendo
# HTTPS + reverse proxy compartilhado (ver deploy/vps/).
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY public ./public

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/server.js"]
