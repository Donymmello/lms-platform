# --- ETAPA 1: Dependências ---
    FROM node:20-alpine AS deps
    RUN apk add --no-cache libc6-compat
    WORKDIR /app

    COPY package*.json ./
    RUN npm ci

    # --- ETAPA 2: Build da Aplicação ---
    FROM node:20-alpine AS builder
    WORKDIR /app

    COPY --from=deps /app/node_modules ./node_modules
    COPY . .

    ENV NEXT_TELEMETRY_DISABLED 1

    RUN npm run build

    # --- ETAPA 3: Imagem de Produção ---
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

    # --- ETAPA 4: Ambiente de Desenvolvimento (usada pelo docker-compose local) ---
    # docker-compose.yml faz bind-mount de ./frontend:/app por cima desta imagem,
    # por isso este alvo corre `next dev` em vez de servir o build "standalone"
    # — a etapa "runner" acima não sobrevive a esse bind-mount porque `.next/`
    # compilado só existe dentro da imagem, não no código-fonte no host.
    FROM node:20-alpine AS dev
    RUN apk add --no-cache libc6-compat
    WORKDIR /app

    COPY package*.json ./
    RUN npm ci

    COPY . .

    ENV NEXT_TELEMETRY_DISABLED 1
    EXPOSE 3000

    CMD ["npm", "run", "dev"]
