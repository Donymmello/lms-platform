# Ordem das etapas importa: `docker build` sem `--target` constrói a ÚLTIMA.
# Por isso "runner" (produção) fica no fim — um build distraído produz a
# imagem de produção, não a de desenvolvimento.

# --- ETAPA 1: Dependências ---
# Separada para ser instalada uma única vez e partilhada pelas etapas de build
# e de desenvolvimento. Antes cada uma tinha o seu `npm ci`: três instalações
# das mesmas dependências no mesmo ficheiro.
FROM node:20-alpine AS deps

WORKDIR /app

# OpenSSL é exigido pelo query engine do Prisma em tempo de execução
# (o node:20-alpine só traz OpenSSL 3.x — ver binaryTargets no schema.prisma).
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

# Todas as dependências, incluindo devDependencies.
RUN npm ci
RUN npx prisma generate

# --- ETAPA 2: Build ---
FROM deps AS builder

COPY . .

RUN npx prisma generate
RUN npm run build

# --- ETAPA 3: Ambiente de Desenvolvimento (usada pelo docker-compose local) ---
# docker-compose.yml faz bind-mount de ./backend:/app por cima desta imagem,
# por isso este alvo corre `npm run dev` (ts-node-dev) em vez do build
# compilado — a etapa "runner" abaixo não sobrevive a esse bind-mount porque
# `dist/` só existe dentro da imagem, não no código-fonte no host.
#
# Deriva de "deps", não de "builder": em desenvolvimento o TypeScript é
# compilado em memória pelo ts-node-dev, logo correr `tsc` aqui não serve de
# nada.
FROM deps AS dev

COPY . .

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

# --- ETAPA 4: Imagem Final de Execução (produção) ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

# Instalar APENAS dependências de produção
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Uploads (vídeos e materiais das aulas) vivem num volume montado aqui.
# O directório tem de existir e pertencer ao utilizador `node` ANTES de o
# volume ser montado: o Docker copia a posse do directório da imagem na
# primeira montagem, e sem isto o volume fica de root e o processo
# não-root não consegue escrever — os uploads falhavam com EACCES.
RUN mkdir -p /app/uploads/videos /app/uploads/materials /app/uploads/covers \
    && chown -R node:node /app/uploads

# Utilizador não-root por segurança
USER node

EXPOSE 5000

CMD ["node", "dist/server.js"]
