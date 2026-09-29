# lms-platform

LMS com vídeo protegido (Bunny Stream), pagamentos moçambicanos (M-Pesa e e-Mola via PaySuite) e PayPal.

**Stack:** Node.js · Express · TypeScript · Prisma · PostgreSQL · Next.js (App Router) · Tailwind · Docker

## Correr o projeto

```bash
docker compose up -d
```

| Serviço | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:5000/api/v1 |
| Adminer | http://localhost:8080 |

As dependências vivem dentro dos containers (o compose usa volumes anónimos para `/app/node_modules`), por isso **não** é preciso `npm install` na máquina host.

### Recarregamento automático

Eventos inotify não atravessam o bind mount do Windows para dentro do container, por isso os dois observadores usam polling: `WATCHPACK_POLLING` no frontend e `--poll --interval=3000` no `ts-node-dev`. Guardar um ficheiro recarrega sozinho, dos dois lados, em até três segundos.

O intervalo de três segundos não é arbitrário: com o polling no intervalo por omissão o backend consumia ~28% de CPU permanentemente, contra ~2% assim.

O Prisma Client é regerado no arranque do container (ver o `CMD` em `backend/Dockerfile`). O volume de `/app/node_modules` é anónimo, e o Docker preenche um novo a partir da imagem cada vez que o container é recriado — trazendo de volta o cliente gerado no build, que não conhece migrations feitas depois. Sem isto, um `docker compose up` depois de mudar o schema devolvia 500 (`Unknown field ... for include statement`) no primeiro pedido que tocasse nos campos novos.

Uma coisa continua manual: **depois de adicionar uma dependência**, corre `docker compose exec backend npm install` (ou reconstrói a imagem). Instalar no arranque reescreveria o `package-lock.json` do host a cada vez.

## Partilhar por túnel (Cloudflare)

Para mostrar isto a alguém de fora — um cliente, um teste em telefone real — expõe **um hostname só**, com o `/api` encaminhado para o backend. Dois hostnames separados parecem funcionar e não funcionam: os cookies de sessão são `SameSite=Lax`, e dois subdomínios de `trycloudflare.com` são domínios registáveis diferentes (está na Public Suffix List), pelo que o browser não envia o cookie. O login parece passar e a seguir estás deslogado, sem erro que o explique.

Com um hostname e encaminhamento por caminho, tudo é a mesma origem: os cookies funcionam sem configuração e o CORS deixa de ser relevante.

`~/.cloudflared/config.yml`:

```yaml
tunnel: <id-do-tunel>
credentials-file: /root/.cloudflared/<id-do-tunel>.json

ingress:
  # A ordem importa: a regra de /api tem de vir antes da geral.
  - hostname: demo.exemplo.com
    path: ^/api/.*
    service: http://localhost:5000
  - hostname: demo.exemplo.com
    service: http://localhost:3000
  - service: http_status:404
```

E no `.env` na raiz:

```dotenv
# Vai compilado no bundle do browser: tem de ser o endereço público.
NEXT_PUBLIC_API_URL=https://demo.exemplo.com/api/v1
CORS_ORIGIN=https://demo.exemplo.com
PUBLIC_APP_URL=https://demo.exemplo.com
PUBLIC_API_URL=https://demo.exemplo.com
```

Depois `docker compose up -d` para os containers relerem o ambiente. `COOKIE_DOMAIN` fica vazio — com um hostname único, um cookie ligado ao host é o correcto.

### Antes de pôr isto num URL público

- **Troca os segredos.** `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` e `TWO_FACTOR_ENCRYPTION_KEY` têm valores por omissão escritos neste repositório. Quem lê o repositório consegue forjar um token de sessão de qualquer utilizador. Gera novos no `.env`.
- **Não encaminhes o Mailpit (8025).** Guarda todos os emails de recuperação de password, e os links dentro deles dão acesso a contas.
- **Não encaminhes o Adminer (8080) nem o Postgres (5434).** São acesso directo à base de dados.

O túnel só expõe o que declaras no `ingress` — o risco é acrescentar-se por conveniência.

## Migrations

```bash
docker exec lms_backend ./node_modules/.bin/prisma migrate dev --name <nome>
```

## Dados de demonstração

A área do aluno só mostra alguma coisa se houver inscrições e progresso. Para semear um cenário completo — três cursos com módulos e aulas, um a meio, um por começar e um concluído:

```bash
docker exec lms_backend npm run seed:demo
```

Tudo o que cria leva um id começado em `5eed`, e o `--clean` remove exatamente isso e nada mais:

```bash
docker exec lms_backend npm run seed:demo -- --clean
```

Correr sem `--clean` limpa e volta a semear, por isso não duplica. O aluno e os cursos que espera encontrar estão no topo de `backend/seed-demo.ts`.

## Vídeos das aulas

Dois fornecedores. O Bunny é usado **se estiver configurado**; caso contrário os vídeos ficam no disco do próprio servidor e são servidos por ele.

Sem configurar nada, o upload e a reprodução funcionam — é assim que se desenvolve e se demonstra a plataforma antes de haver CDN pago.

| | Local (por omissão) | Bunny Stream |
|---|---|---|
| Configuração | nenhuma | 3 variáveis |
| Formatos | mp4, webm, ogg, mov, m4v | qualquer um |
| Codecs | **H.264 + AAC** — o ficheiro é inspecionado e recusado se não servir | qualquer um |
| Transcodificação | não | sim |
| Qualidade adaptativa | não | sim |
| CDN | não, sai tudo do teu servidor | sim |
| Controlo de acesso | verificado a cada pedido | URL assinado, validade de 1 hora |

Para passar ao Bunny, basta preencher as três variáveis e reiniciar — sem mudar código:

```
BUNNY_STREAM_LIBRARY_ID=...
BUNNY_STREAM_API_KEY=...
BUNNY_STREAM_TOKEN_AUTH_KEY=...
```

A `TOKEN_AUTH_KEY` está nas definições de segurança da biblioteca e **não é** a chave da API — são diferentes.

Os vídeos já carregados localmente continuam a funcionar depois da mudança: o id de cada um diz onde vive.

**Sem CDN, o codec é que manda, não a extensão.** Um `.mp4` pode não ter faixa de vídeo nenhuma, ou trazer H.265 que nenhum navegador reproduz — e ambos passariam por qualquer validação de extensão ou mimetype. O upload abre o ficheiro e recusa, com explicação, quando:

- não há faixa de vídeo (ficheiro só com áudio)
- o vídeo está em H.265/HEVC, Dolby Vision ou ProRes

H.265 é o que um iPhone grava por omissão e o que muitos editores exportam como "alta qualidade", por isso é provável que tropeces nele. Com o Bunny configurado nada disto importa: ele transcodifica.

Limite de 500 MB por ficheiro, verificado no browser e no servidor. Em desenvolvimento os ficheiros ficam num volume (`backend_uploads`), por isso sobrevivem a recriar o container — mas correr `docker compose up -d` é preciso uma vez para o volume ser ligado.

## Emails

O backend envia quatro notificações: boas-vindas no registo, confirmação de inscrição gratuita, recibo quando um pagamento é confirmado, e o link de recuperação de palavra-passe.

Em desenvolvimento nada sai da máquina — o compose inclui um **Mailpit** que apanha tudo e mostra em http://localhost:8025.

Para enviar a sério, aponta as variáveis a um servidor SMTP qualquer (Gmail, cPanel, Resend, SendGrid):

```
SMTP_HOST=smtp.exemplo.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_SECURE=false        # true só na porta 465
MAIL_FROM=Estúdio <nao-responder@oteudominio.com>
```

Com `SMTP_HOST` vazio o envio fica desligado e a aplicação corre à mesma — é assim que os testes e um checkout novo funcionam.

Enviar nunca faz falhar o pedido que o originou: um servidor de email em baixo não transforma um registo ou um pagamento concluído num erro.

## Verificação em dois passos

TOTP (o que o Google Authenticator e o Authy usam). O utilizador liga em `/seguranca`: lê o QR code, confirma com um código, e recebe 8 códigos de recuperação mostrados **uma única vez**.

O segredo TOTP é guardado cifrado (AES-256-GCM) com uma chave que vive no ambiente, nunca na base de dados:

```
TWO_FACTOR_ENCRYPTION_KEY=<32 bytes em hex>
TWO_FACTOR_ISSUER=Estudio
```

Gera uma chave com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Com a chave vazia ninguém consegue ativar o 2FA, mas quem já o tem continua a entrar. O compose traz uma chave de desenvolvimento — **gera outra para qualquer implantação real**.

## Testes

Os testes do backend correm contra uma base de dados Postgres real e dedicada (`lms_db_test`), não contra mocks do Prisma — as regras que interessam (acesso ao vídeo, RBAC, ownership, idempotência de webhooks, agregações) vivem em queries, e mockar o ORM não as testaria.

Criar a base de teste, uma vez:

```bash
docker exec lms_postgres psql -U lms_user -d lms_db -c "CREATE DATABASE lms_db_test OWNER lms_user;"
```

Aplicar as migrations nela (repetir sempre que houver migrations novas):

```bash
docker exec -e DATABASE_URL="postgresql://lms_user:lms_password@postgres:5432/lms_db_test?schema=public" lms_backend ./node_modules/.bin/prisma migrate deploy
```

Correr a suite:

```bash
docker exec lms_backend npm test
```

Cobertura atual — 264 testes: autenticação, 2FA e rate limiting, recuperação de password, cursos/módulos/aulas (CRUD e ownership), materiais de aula (upload, allowlist, download com acesso verificado), avaliações de módulo (correcção, tentativas, e o gabarito que nunca chega ao aluno), inscrições, pagamentos (checkout, webhooks, captura PayPal), playback assinado, vídeo local (streaming com Range e validação do ficheiro), progresso de aulas (manual e por posição do player) e analytics.

Os gateways de pagamento (PaySuite, PayPal) são substituídos por um mock **apenas na fronteira do adaptador**. Tudo abaixo disso — criação da linha de pagamento, desbloqueio da inscrição, idempotência de entregas repetidas, rejeição de assinatura inválida — corre a sério.

O `src/test/setup.ts` esvazia todas as tabelas antes de cada teste e recusa-se a arrancar se o `DATABASE_URL` não apontar para uma base cujo nome termine em `_test`.

## Verificação de tipos

```bash
docker exec lms_backend npm run typecheck
```

Verifica `src/` e os testes. O `npm run build` exclui os testes do `dist/`.
