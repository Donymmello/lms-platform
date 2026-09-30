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

O Prisma Client é regerado no arranque do container (ver o `CMD` em `backend/Dockerfile`). O volume de `/app/node_modules` é anónimo, e o Docker preenche um novo a partir da imagem cada vez que o container é recriado, trazendo de volta o cliente gerado no build, que não conhece migrations feitas depois. Sem isto, um `docker compose up` depois de mudar o schema devolvia 500 (`Unknown field ... for include statement`) no primeiro pedido que tocasse nos campos novos.

Uma coisa continua manual: **depois de adicionar uma dependência**, corre `docker compose exec backend npm install` (ou reconstrói a imagem). Instalar no arranque reescreveria o `package-lock.json` do host a cada vez.

## Pôr numa VPS para o cliente ver

Precisas de uma VPS com Docker e Compose, e de um subdomínio apontado ao IP dela. A stack traz um Caddy que tira e renova o certificado HTTPS sozinho.

**HTTPS não é opcional aqui.** Em produção os cookies de sessão são marcados `Secure`, logo só viajam por HTTPS. Sobre HTTP puro ninguém consegue entrar, e o sintoma é o login parecer passar e o pedido seguinte vir anónimo.

**1.** No DNS, um registo `A` de `demo.teudominio.com` para o IP da VPS.

**2.** Na VPS, clona e entra:

```bash
git clone https://github.com/Donymmello/lms-platform.git && cd lms-platform
```

**3.** Escreve o `.env`. Gera segredos próprios: os valores por omissão do `docker-compose.yml` estão publicados neste repositório, e com eles qualquer pessoa forja uma sessão de qualquer utilizador:

```bash
printf 'PUBLIC_ORIGIN=https://demo.teudominio.com
SITE_ADDRESS=demo.teudominio.com
COOKIE_DOMAIN=
POSTGRES_USER=lms_user
POSTGRES_DB=lms_db
POSTGRES_PASSWORD=%s
JWT_ACCESS_SECRET=%s
JWT_REFRESH_SECRET=%s
TWO_FACTOR_ENCRYPTION_KEY=%s
' "$(openssl rand -hex 16)" "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env
```

**4.** Sobe:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

**5.** Aplica as migrações:

```bash
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

E cria os dados de demonstração, se quiseres o catálogo preenchido. Ver [Dados de demonstração](#dados-de-demonstração).

O Caddy pede o certificado no primeiro pedido ao domínio, o que leva alguns segundos. Se falhar, é quase sempre uma de duas coisas: o DNS ainda não propagou, ou a porta 80 está fechada na firewall, por onde passa o desafio ACME.

### Se a VPS já serve outros sites

O caso normal numa VPS que já tem coisas a correr: as portas 80 e 443 estão ocupadas. Por isso a stack **não as publica**. Publica só `127.0.0.1:8090`, e o servidor que já lá está encaminha para ela, continuando a tratar do TLS como já trata dos outros sites.

Com Caddy como serviço do sistema, acrescenta ao `/etc/caddy/Caddyfile`:

```
demo.teudominio.com {
	reverse_proxy localhost:8090
}
```

Se o Caddy da VPS for um container, `localhost` dentro dele é ele próprio, não a máquina. Liga-o à rede da stack e trata pelo nome:

```bash
docker network connect <rede-do-caddy> lms_proxy
```

E no Caddyfile dele, `reverse_proxy lms_proxy:8090`.

Com nginx à frente em vez de Caddy, não te esqueças do `client_max_body_size`: o valor por omissão é 1 MB e rejeita qualquer vídeo com um 413 que parece bug da aplicação. O Caddy não tem esse limite.

O encaminhamento de `/api` fica dentro do repositório, no [`deploy/Caddyfile`](deploy/Caddyfile), e não no servidor da VPS. Essa divisão é o que mantém tudo na mesma origem e os cookies de sessão a funcionar; num ficheiro fora do repositório, alguém podia parti-la sem tocar no código, e o sintoma seria o login deixar de funcionar sem explicação.

### Quando a stack é a única coisa na máquina

Só então vale a pena deixá-la tomar as portas 80 e 443 e tirar o seu próprio certificado:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.tls.yml up -d --build
```

Nesse caso `SITE_ADDRESS` é o hostname, não `:8090`. A porta 80 tem de estar aberta na firewall mesmo com o site a responder em 443, porque é por lá que passa o desafio ACME.

### Correr o build de produção localmente

O mesmo ficheiro serve, com `SITE_ADDRESS=:8090` (o valor por omissão): o Caddy serve HTTP simples em `http://localhost:8090` e não pede certificado nenhum. Serve para ver o build compilado antes de subir, mas **o login não funciona**, pela razão dos cookies `Secure` acima.

### O que muda em produção

O `docker-compose.prod.yml` usa-se **em vez** do `docker-compose.yml`, não como sobreposição. Os dois partilham projecto e volumes (base de dados e uploads mantêm-se), mas reclamam os mesmos nomes de container, pelo que só um corre de cada vez. Localmente, `docker compose down` antes de subir o de produção.

- O frontend serve um build compilado; o backend corre o `dist/` compilado. Sem observadores de ficheiros, sem overlay de erros do Next à frente de um visitante.
- Só o Caddy publica portas. O frontend, o backend e o Postgres ficam na rede do compose, alcançáveis pelo proxy e por mais nada.
- O Adminer desaparece. O Mailpit fica, para o envio de email não falhar, mas **a caixa de entrada deixa de ser publicada**, porque guarda os links de recuperação de password, que são acesso a contas. Para a ler, publica a 8025 o tempo que precisares e volta atrás.
- Os segredos não têm valores por omissão: sem `PUBLIC_ORIGIN`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` e `TWO_FACTOR_ENCRYPTION_KEY` no `.env`, a stack recusa arrancar em vez de subir com os de desenvolvimento, que estão publicados neste repositório.

Duas coisas que surpreendem:

- **O endereço público é compilado no bundle do browser**, não lido no arranque. Mudar `PUBLIC_ORIGIN` exige `--build` outra vez; reiniciar não chega.
- **Os cookies de sessão são `Secure`**, logo só viajam por HTTPS.

Se puseres a Cloudflare à frente da VPS com o proxy ligado, conta com o corte dela ao corpo dos pedidos: **100 MB** nos planos Free e Pro. O limite da aplicação para vídeos é 500 MB, logo um vídeo acima de 100 MB falha com 413 antes de chegar à VPS. Ou carregas esses com o proxy desligado (DNS "grey cloud"), ou contra `localhost`.

## Migrations

```bash
docker exec lms_backend ./node_modules/.bin/prisma migrate dev --name <nome>
```

## Dados de demonstração

A área do aluno só mostra alguma coisa se houver inscrições e progresso. Para semear um cenário completo, com três cursos feitos de módulos e aulas, um a meio, um por começar e um concluído:

```bash
docker exec lms_backend npm run seed:demo
```

Tudo o que cria leva um id começado em `5eed`, e o `--clean` remove exactamente isso e nada mais:

```bash
docker exec lms_backend npm run seed:demo -- --clean
```

Correr sem `--clean` limpa e volta a semear, por isso não duplica. O aluno e os cursos que espera encontrar estão no topo de `backend/seed-demo.ts`.

## Vídeos das aulas

Dois fornecedores. O Bunny é usado **se estiver configurado**; caso contrário os vídeos ficam no disco do próprio servidor e são servidos por ele.

Sem configurar nada, o upload e a reprodução funcionam. É assim que se desenvolve e se demonstra a plataforma antes de haver CDN pago.

| | Local (por omissão) | Bunny Stream |
|---|---|---|
| Configuração | nenhuma | 3 variáveis |
| Formatos | mp4, webm, ogg, mov, m4v | qualquer um |
| Codecs | **H.264 + AAC**, verificado no ficheiro e recusado se não servir | qualquer um |
| Transcodificação | não | sim |
| Qualidade adaptativa | não | sim |
| CDN | não, sai tudo do teu servidor | sim |
| Controlo de acesso | verificado a cada pedido | URL assinado, validade de 1 hora |

Para passar ao Bunny, basta preencher as três variáveis e reiniciar, sem mudar código:

```
BUNNY_STREAM_LIBRARY_ID=...
BUNNY_STREAM_API_KEY=...
BUNNY_STREAM_TOKEN_AUTH_KEY=...
```

A `TOKEN_AUTH_KEY` está nas definições de segurança da biblioteca e **não é** a chave da API. São duas chaves diferentes.

Os vídeos já carregados localmente continuam a funcionar depois da mudança: o id de cada um diz onde vive.

**Sem CDN, o codec é que manda, não a extensão.** Um `.mp4` pode não ter faixa de vídeo nenhuma, ou trazer H.265 que nenhum navegador reproduz, e ambos passariam por qualquer validação de extensão ou mimetype. O upload abre o ficheiro e recusa, com explicação, quando:

- não há faixa de vídeo (ficheiro só com áudio)
- o vídeo está em H.265/HEVC, Dolby Vision ou ProRes

H.265 é o que um iPhone grava por omissão e o que muitos editores exportam como "alta qualidade", por isso é provável que tropeces nele. Com o Bunny configurado nada disto importa: ele transcodifica.

Limite de 500 MB por ficheiro, verificado no browser e no servidor. Em desenvolvimento os ficheiros ficam num volume (`backend_uploads`), por isso sobrevivem a recriar o container. Mas correr `docker compose up -d` é preciso uma vez para o volume ser ligado.

## Emails

O backend envia quatro notificações: boas-vindas no registo, confirmação de inscrição gratuita, recibo quando um pagamento é confirmado, e o link de recuperação de palavra-passe.

Em desenvolvimento nada sai da máquina: o compose inclui um **Mailpit** que apanha tudo e mostra em http://localhost:8025.

Para enviar a sério, aponta as variáveis a um servidor SMTP qualquer (Gmail, cPanel, Resend, SendGrid):

```
SMTP_HOST=smtp.exemplo.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_SECURE=false        # true só na porta 465
MAIL_FROM=Estúdio <nao-responder@oteudominio.com>
```

Com `SMTP_HOST` vazio o envio fica desligado e a aplicação corre à mesma, que é como os testes e um checkout novo funcionam.

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

Com a chave vazia ninguém consegue activar o 2FA, mas quem já o tem continua a entrar. O compose traz uma chave de desenvolvimento. **Gera outra para qualquer implantação real.**

## Testes

Os testes do backend correm contra uma base de dados Postgres real e dedicada (`lms_db_test`), não contra mocks do Prisma. As regras que interessam (acesso ao vídeo, RBAC, ownership, idempotência de webhooks, agregações) vivem em queries, e mockar o ORM não as testaria.

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

Cobertura actual, 264 testes: autenticação, 2FA e rate limiting, recuperação de password, cursos/módulos/aulas (CRUD e ownership), materiais de aula (upload, allowlist, download com acesso verificado), avaliações de módulo (correcção, tentativas, e o gabarito que nunca chega ao aluno), inscrições, pagamentos (checkout, webhooks, captura PayPal), playback assinado, vídeo local (streaming com Range e validação do ficheiro), progresso de aulas (manual e por posição do player) e analytics.

Os gateways de pagamento (PaySuite, PayPal) são substituídos por um mock **apenas na fronteira do adaptador**. Tudo abaixo disso corre a sério: criação da linha de pagamento, desbloqueio da inscrição, idempotência de entregas repetidas, rejeição de assinatura inválida.

O `src/test/setup.ts` esvazia todas as tabelas antes de cada teste e recusa-se a arrancar se o `DATABASE_URL` não apontar para uma base cujo nome termine em `_test`.

## Verificação de tipos

```bash
docker exec lms_backend npm run typecheck
```

Verifica `src/` e os testes. O `npm run build` exclui os testes do `dist/`.
