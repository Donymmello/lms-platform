# Ordem das etapas importa: `docker build` sem `--target` constrói a ÚLTIMA.
# Por isso "runner" (produção) fica no fim — um build distraído produz a
# imagem de produção, não a de desenvolvimento.

# --- ETAPA 1: Dependências ---
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN npm ci

# --- ETAPA 2: Build da Aplicação ---
FROM deps AS builder

COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

# NEXT_PUBLIC_* values are compiled into the browser bundle, so this has to
# be known now, not at container start — and it has to be an address the
# visitor's browser can reach. Change it and the image must be rebuilt.
# src/config/env.ts validates it at import time, so the build fails loudly
# rather than shipping a bundle that calls nowhere.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# --- ETAPA 3: Ambiente de Desenvolvimento (usada pelo docker-compose local) ---
# docker-compose.yml faz bind-mount de ./frontend:/app por cima desta imagem,
# por isso este alvo corre `next dev` em vez de servir o build "standalone"
# — a etapa "runner" abaixo não sobrevive a esse bind-mount porque `.next/`
# compilado só existe dentro da imagem, não no código-fonte no host.
#
# Deriva de "deps", não de "builder": `next dev` compila a pedido, logo correr
# `next build` aqui era tempo gasto num resultado que o bind-mount esconde.
FROM deps AS dev

COPY . .

ENV NEXT_TELEMETRY_DISABLED 1
EXPOSE 3000

CMD ["npm", "run", "dev"]

# --- ETAPA 4: Imagem de Produção ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
