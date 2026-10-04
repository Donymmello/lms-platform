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

Uma coisa continua manual: **depois de adicionar uma dependência**, corre `docker compose exec lms-backend npm install` (ou reconstrói a imagem). Instalar no arranque reescreveria o `package-lock.json` do host a cada vez.

### Imagens e nomes

Cada ficheiro compose diz explicitamente que imagem constrói — `lms-platform-backend:dev` e `:prod`, o mesmo para o frontend. Sem isso ambos construíam para a mesma etiqueta, e um `up -d` depois de ter construído o outro corria o alvo errado: o comando de produção contra um bind mount sem `dist/` dentro, com o container em ciclo de reinício a dizer `Cannot find module '/app/dist/server.js'`.

Os containers, por outro lado, **não têm nome fixo** — o Compose gera `lms-platform-lms-backend-1` e afins. Trata-os sempre pelo serviço:

```bash
docker compose exec lms-backend sh
docker compose logs -f lms-backend
docker compose restart lms-backend
```

Nos `Dockerfile` a etapa de produção é a **última**, de propósito: `docker build ./backend` sem `--target` produz a imagem de produção. Com a etapa de desenvolvimento no fim, o mesmo comando dava uma imagem que corre `ts-node-dev` e espera um bind mount — a diferença só aparece em execução, e parece bug da aplicação.

Para correr os testes não é preciso construir nada à mão: o container de desenvolvimento já tem as devDependencies e o Prisma Client. Ver [Testes](#testes).

As imagens antigas acumulam-se a cada `--build` — a anterior perde a etiqueta e fica como `<none>`. Para as varrer sem tocar nas que estão em uso:

```bash
docker image prune
```

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
docker compose -f docker-compose.prod.yml exec lms-backend npx prisma migrate deploy
```

O `--build` não é opcional numa actualização: as migrações são copiadas para dentro da imagem, logo sem reconstruir o `migrate deploy` não vê as que chegaram no `git pull`.

Se o `up` falhar por nome ou porta já em uso, para a stack antes de a subir:

```bash
docker compose -f docker-compose.prod.yml down --remove-orphans
```

Acontece a quem actualizar por cima de containers criados antes de os serviços passarem a ter nomes prefixados, ou antes de o `container_name` ter sido removido. O Compose acompanha containers pelo nome do serviço, logo os antigos ficam órfãos: continuam a segurar nomes e portas que os novos querem. Acrescentar `--remove-orphans` ao próprio `up` não resolve: a remoção e a criação correm ao mesmo tempo e voltam a chocar.

O `down` age pela etiqueta do projecto e não pelos nomes de serviço, por isso apanha-os todos. Sem `-v` não toca em volumes — base de dados, uploads e certificados ficam — e não vê containers de outros projectos na máquina.

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

Se o Caddy da VPS for um container, `localhost` dentro dele é ele próprio, não a máquina. Nesse caso os dois têm de partilhar uma rede, e isso declara-se — **não** se faz com `docker network connect` à mão. Uma ligação feita à mão não fica escrita em lado nenhum: o Compose recria o container do proxy a cada `up -d --build`, o container novo nasce só na rede do compose, e o site responde 502 até alguém se lembrar de reconectar.

Descobre o nome da rede do outro Caddy:

```bash
docker inspect <container-do-caddy> -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}'
```

Põe-no no `.env` e acrescenta o ficheiro [`docker-compose.shared-proxy.yml`](docker-compose.shared-proxy.yml) ao comando:

```bash
echo 'SHARED_PROXY_NETWORK=vektra-site_default' >> .env
docker compose -f docker-compose.prod.yml -f docker-compose.shared-proxy.yml up -d --build
```

Só o proxy entra na rede partilhada; a base de dados, o backend e o frontend ficam de fora.

E no Caddyfile dele, encaminha para o nome do **serviço**:

```
lms.teudominio.com {
	reverse_proxy lms-proxy:8090
}
```

`lms-proxy` com hífen. O Compose cria esse alias de DNS em todas as redes do serviço, e refá-lo em cada recriação. O nome do container não serve, porque já não é fixo — um `reverse_proxy lms_proxy:8090` escrito antes desta mudança deixa de resolver. Verifica antes de actualizar:

```bash
grep -n 'lms' /etc/caddy/Caddyfile
```

**Atenção a um problema que isto pode causar, e já causou uma vez.** O DNS do Docker responde pelo **nome do serviço** em todas as redes a que um container pertence. Ligar o proxy a duas redes faz com que um pedido por `frontend` possa ser atendido pelo container de outro projecto — e o sintoma é 502 num site que não se tocou, ou pior, o proxy a servir a aplicação errada.

Os serviços desta stack chamam-se `lms-postgres`, `lms-backend`, `lms-frontend`, `lms-proxy` e `lms-mailpit` por essa razão, não por estética. Se os outros projectos na máquina usarem `frontend`, `backend` ou `db`, vale a pena prefixá-los também antes de partilhar redes: a colisão é silenciosa até ao dia em que não é.

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

## Papéis e quem os dá

Três papéis: `STUDENT` (por omissão em qualquer registo), `INSTRUCTOR` (cria e publica cursos) e `ADMIN` (gere contas e vê o log de auditoria).

**Não há subida self-service.** Havia: a página `/ensinar` tinha um botão que transformava qualquer aluno em instrutor na hora, e um instrutor publica no catálogo sem aprovação de ninguém — numa plataforma com uma instrutora, isso significa um estranho a pôr um curso no catálogo dela.

Agora há pedido e aprovação:

1. Em `/ensinar`, quem está autenticado escreve o que quer ensinar e envia (`POST /users/me/instructor-request`, 3 por hora por IP).
2. O pedido é escrito no log de auditoria **e** enviado por email a todos os ADMIN activos, lidos da base de dados — não há lista a configurar em lado nenhum. A ordem é essa de propósito: o email é «envia e esquece» e pode falhar, logo o log é o registo que fica.
3. Um admin promove em `/admin/users`, e essa mudança também fica no log.

Não há tabela de candidaturas. O pedido não tem estado visível para quem o fez — o browser lembra-se de o ter enviado, e é tudo. Vale a pena construir a fila a sério (modelo, estados, ecrã de admin, email nas duas direcções) quando chegarem candidaturas com regularidade; com uma instrutora, não.

Para ler os pedidos sem depender do email: `/admin/auditoria`, filtro «Pedidos para ensinar». A mensagem aparece na entrada.

### O primeiro ADMIN é feito por SQL

Não há outra forma, e de propósito: `PATCH /users/:id/role` recusa mudar o papel de quem faz o pedido, para um admin não se despromover e deixar a plataforma sem nenhum.

```bash
docker compose -f docker-compose.prod.yml exec lms-postgres psql -U lms_user -d lms_db -c "UPDATE users SET role='ADMIN' WHERE email='o-teu@email.com';"
```

Sai e entra outra vez depois: o papel vai assinado dentro do token de acesso, e o que tens no browser ainda diz o antigo.

**Com zero admins, ninguém pode promover ninguém.** Faz este passo antes de precisares dele.

## Migrations

```bash
docker compose exec lms-backend ./node_modules/.bin/prisma migrate dev --name <nome>
```

## Dados de demonstração

A área do aluno só mostra alguma coisa se houver inscrições e progresso. Para semear um cenário completo, com três cursos feitos de módulos e aulas, um a meio, um por começar e um concluído:

```bash
docker compose exec lms-backend npm run seed:demo
```

Tudo o que cria leva um id começado em `5eed`, e o `--clean` remove exactamente isso e nada mais:

```bash
docker compose exec lms-backend npm run seed:demo -- --clean
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

## Backups

[`deploy/backup.sh`](deploy/backup.sh) guarda as três coisas que não se reconstroem a partir do repositório: a base de dados, os uploads (vídeos, materiais, capas) e o `.env`. Sem o `.env` os segredos 2FA já guardados ficam ilegíveis, por isso ele conta como dado e não como configuração.

Corre no host, não dentro de um container, e descobre a stack pelas etiquetas do Compose — não precisa dos `-f` nem do `.env` para arrancar.

```bash
sudo /home/dony/lms-platform/deploy/backup.sh
```

Pela primeira vez vale a pena correr à mão e ver o resultado:

```bash
sudo tail -5 /var/backups/lms/backup.log
```

### Instalar no cron

Às 3h30, com a saída de erro a ir para o log (um backup que falha em silêncio é pior que nenhum, porque dá confiança):

```bash
echo '30 3 * * * root /home/dony/lms-platform/deploy/backup.sh >> /var/backups/lms/cron.log 2>&1' | sudo tee /etc/cron.d/lms-backup
```

```bash
sudo chmod 644 /etc/cron.d/lms-backup
```

### O que guarda, e como

| | |
|---|---|
| `db/` | um `pg_dump -Fc` por execução, datado. Mantém 14 dias (`BACKUP_KEEP_DAYS`) |
| `uploads/` | espelho **aditivo**: traz o que falta, nunca sobrepõe nem apaga |
| `env/.env` | cópia, modo 600 |

O espelho dos uploads não é um tar datado de propósito. Os vídeos são a maior parte dos bytes e não mudam depois de carregados: um tar por dia duplicaria gigabytes para nada. E por não apagar, um ficheiro removido por engano continua recuperável — o preço é que uma alteração legítima ao mesmo nome não chega ao backup, o que não acontece aqui porque os nomes são UUIDs.

O dump é verificado com `pg_restore --list` antes de contar como bom. Um ficheiro de tamanho não-nulo não prova nada: um dump cortado a meio também o tem.

O script desiste se houver menos de 2 GB livres (`BACKUP_MIN_FREE_MB`). Encher o disco desta VPS não derrubava só esta stack.

### Restaurar

A base de dados, por cima de uma stack a correr:

```bash
cat /var/backups/lms/db/lms_db-AAAAMMDD-HHMMSS.dump | docker exec -i $(docker ps -q -f label=com.docker.compose.project=lms-platform -f label=com.docker.compose.service=lms-postgres) pg_restore -U lms_user -d lms_db --clean --if-exists
```

`--clean --if-exists` apaga os objectos antes de os recriar, por isso **isto substitui os dados actuais**. Para espiar sem destruir nada, restaura para uma base nova com `-d lms_db_restore` depois de a criar.

Os uploads voltam pelo caminho inverso ao do backup:

```bash
tar cf - -C /var/backups/lms/uploads . | docker run --rm -i -v lms-platform_backend_uploads:/data alpine:3 tar xf - --skip-old-files -C /data
```

### Ainda em falta

**Os backups estão na mesma máquina que a stack.** Isso cobre o que falha mais: uma migration má, um `DROP` por engano, um ficheiro apagado. Não cobre perder o disco ou a VPS. Para fora, o passo seguinte é um `rsync` ou um `restic` do `/var/backups/lms` para outro sítio — uma Storage Box da Hetzner é o óbvio, já que o servidor lá está.

## Testes

Os testes do backend correm contra uma base de dados Postgres real e dedicada (`lms_db_test`), não contra mocks do Prisma. As regras que interessam (acesso ao vídeo, RBAC, ownership, idempotência de webhooks, agregações) vivem em queries, e mockar o ORM não as testaria.

Criar a base de teste, uma vez:

```bash
docker compose exec lms-postgres psql -U lms_user -d lms_db -c "CREATE DATABASE lms_db_test OWNER lms_user;"
```

Aplicar as migrations nela (repetir sempre que houver migrations novas):

```bash
docker compose exec -e DATABASE_URL="postgresql://lms_user:lms_password@lms-postgres:5432/lms_db_test?schema=public" lms-backend ./node_modules/.bin/prisma migrate deploy
```

Correr a suite:

```bash
docker compose exec lms-backend npm test
```

Cobertura actual, 289 testes: autenticação, 2FA e rate limiting, recuperação de password, cursos/módulos/aulas (CRUD e ownership), materiais de aula (upload, allowlist, download com acesso verificado), avaliações de módulo (correcção, tentativas, e o gabarito que nunca chega ao aluno), inscrições, pagamentos (checkout, webhooks, captura PayPal), playback assinado, vídeo local (streaming com Range e validação do ficheiro), progresso de aulas (manual e por posição do player) e analytics.

Os gateways de pagamento (PaySuite, PayPal) são substituídos por um mock **apenas na fronteira do adaptador**. Tudo abaixo disso corre a sério: criação da linha de pagamento, desbloqueio da inscrição, idempotência de entregas repetidas, rejeição de assinatura inválida.

O `src/test/setup.ts` esvazia todas as tabelas antes de cada teste e recusa-se a arrancar se o `DATABASE_URL` não apontar para uma base cujo nome termine em `_test`.

## Verificação de tipos

```bash
docker compose exec lms-backend npm run typecheck
```

Verifica `src/` e os testes. O `npm run build` exclui os testes do `dist/`.
