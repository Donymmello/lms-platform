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

    # Uploads (vídeos e materiais das aulas) vivem num volume montado aqui.
    # O directório tem de existir e pertencer ao utilizador `node` ANTES de o
    # volume ser montado: o Docker copia a posse do directório da imagem na
    # primeira montagem, e sem isto o volume fica de root e o processo
    # não-root não consegue escrever — os uploads falhavam com EACCES.
    RUN mkdir -p /app/uploads/videos /app/uploads/materials \
        && chown -R node:node /app/uploads

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

    # Generated here so the image can run without a database, and again at
    # startup below — see the CMD for why both are needed.
    RUN npx prisma generate

    EXPOSE 5000

    # Prisma Client is regenerated on every start, not just at build.
    #
    # docker-compose mounts an anonymous volume over /app/node_modules, and
    # Docker fills a *new* one from the image every time the container is
    # recreated. The client baked into the image matches the schema as it was
    # when the image was built, so any migration since then left the running
    # container with a client that does not know the new fields — a 500 from
    # Prisma ("Unknown field ... for include statement") on the first request
    # to touch them. Generating at startup keeps the client and the schema on
    # disk in step, whatever state the volume came back in.
    #
    # Costs a second or two on a warm volume. Note this does NOT install new
    # dependencies: after adding a package, run `npm install` in the container
    # (or rebuild the image), because doing that here would rewrite the
    # bind-mounted package-lock.json on every start.
    CMD ["sh", "-c", "npx prisma generate && npm run dev"]
