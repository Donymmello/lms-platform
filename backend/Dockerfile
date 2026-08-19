# --- ETAPA 1: Dependências e Build ---
    FROM node:20-alpine AS builder

    WORKDIR /app

    # OpenSSL é exigido pelo query engine do Prisma em tempo de execução
    # (o node:20-alpine só traz OpenSSL 3.x — ver binaryTargets no schema.prisma).
    RUN apk add --no-cache openssl

    # Copiar ficheiros de dependências
    COPY package*.json ./
    COPY prisma ./prisma/

    # Instalar todas as dependências (incluindo devDependencies)
    RUN npm ci

    # Copiar código-fonte
    COPY . .

    # Gerar o Prisma Client e compilar o TypeScript
    RUN npx prisma generate
    RUN npm run build

    # --- ETAPA 2: Imagem Final de Execução (produção) ---
    FROM node:20-alpine AS runner

    WORKDIR /app

    ENV NODE_ENV=production

    RUN apk add --no-cache openssl

    # Copiar ficheiros essenciais
    COPY package*.json ./
    COPY prisma ./prisma/

    # Instalar APENAS dependências de produção
    RUN npm ci --only=production

    # Copiar os ficheiros compilados da etapa anterior
    COPY --from=builder /app/dist ./dist
    COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

    # Utilizador não-root por segurança
    USER node

    EXPOSE 5000

    CMD ["node", "dist/server.js"]

    # --- ETAPA 3: Ambiente de Desenvolvimento (usada pelo docker-compose local) ---
    # docker-compose.yml faz bind-mount de ./backend:/app por cima desta imagem,
    # por isso este alvo corre `npm run dev` (ts-node-dev) em vez do build
    # compilado — a etapa "runner" acima não sobrevive a esse bind-mount porque
    # `dist/` só existe dentro da imagem, não no código-fonte no host.
    FROM node:20-alpine AS dev

    WORKDIR /app

    RUN apk add --no-cache openssl

    COPY package*.json ./
    COPY prisma ./prisma/

    RUN npm ci

    COPY . .

    RUN npx prisma generate

    EXPOSE 5000

    CMD ["npm", "run", "dev"]
