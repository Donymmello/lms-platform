#!/bin/bash
# Backup da stack de produção. Corre no host da VPS, pelo cron, como root.
#
#   /home/dony/lms-platform/deploy/backup.sh
#
# Guarda três coisas, que são as três que não se reconstroem a partir do
# repositório:
#
#   db/        um dump por dia, formato custom do pg_dump (comprimido, e
#              permite restaurar uma tabela só)
#   uploads/   espelho dos vídeos, materiais e capas
#   env/       o .env, porque sem ele os segredos 2FA guardados ficam ilegíveis
#
# O espelho dos uploads é **aditivo**: copia o que falta e nunca sobrepõe nem
# apaga. Um vídeo removido por engano continua recuperável, e não se duplica
# gigabytes de vídeo todos os dias como um tar datado faria.
# bash, e não sh, por causa do `pipefail`: a cópia dos uploads é uma pipeline,
# e sem isto um `docker run` falhado ficava escondido atrás do `tar` que
# recebeu zero bytes e terminou bem.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
DEST=${BACKUP_DIR:-/var/backups/lms}
KEEP_DAYS=${BACKUP_KEEP_DAYS:-14}
MIN_FREE_MB=${BACKUP_MIN_FREE_MB:-2048}
PROJECT=${BACKUP_PROJECT:-lms-platform}

STAMP=$(date +%Y%m%d-%H%M%S)
LOG=$DEST/backup.log

mkdir -p "$DEST/db" "$DEST/uploads" "$DEST/env"
chmod 700 "$DEST"

log() { printf '%s  %s\n' "$(date +'%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG"; }
die() { log "FALHOU: $*"; printf 'backup falhou: %s\n' "$*" >&2; exit 1; }

# Encher o disco desta VPS não derrubava só esta stack: há outros sites na
# máquina. Por isso o backup desiste antes de chegar a esse ponto.
FREE_MB=$(df -Pm "$DEST" | awk 'NR==2 {print $4}')
[ "$FREE_MB" -ge "$MIN_FREE_MB" ] || die "só ${FREE_MB}MB livres em $DEST, mínimo ${MIN_FREE_MB}MB"

container() {
    docker ps -q \
        --filter "label=com.docker.compose.project=$PROJECT" \
        --filter "label=com.docker.compose.service=$1"
}

PG=$(container lms-postgres)
[ -n "$PG" ] || die "container lms-postgres não está a correr (projecto $PROJECT)"

# Credenciais do .env, com os mesmos valores por omissão do compose.
PGUSER=lms_user
PGDB=lms_db
if [ -f "$ROOT/.env" ]; then
    # shellcheck disable=SC1091
    PGUSER=$(grep -E '^POSTGRES_USER=' "$ROOT/.env" | cut -d= -f2- | tr -d '"' || true)
    PGDB=$(grep -E '^POSTGRES_DB=' "$ROOT/.env" | cut -d= -f2- | tr -d '"' || true)
    [ -n "$PGUSER" ] || PGUSER=lms_user
    [ -n "$PGDB" ] || PGDB=lms_db
fi

# --- Base de dados ---
DUMP=$DEST/db/${PGDB}-${STAMP}.dump
docker exec -i "$PG" pg_dump -U "$PGUSER" -d "$PGDB" -Fc > "$DUMP" \
    || die "pg_dump não terminou"

# Um ficheiro de tamanho não-nulo não prova nada: um dump cortado a meio
# também o tem. `pg_restore --list` lê o índice do arquivo, e falha se estiver
# truncado ou corrompido — é a diferença entre ter backups e achar que se tem.
docker exec -i "$PG" pg_restore --list > /dev/null < "$DUMP" \
    || die "o dump $DUMP não é legível pelo pg_restore"

log "db ok: $(du -h "$DUMP" | cut -f1)  $DUMP"

# --- Uploads ---
# O nome do volume é lido do container, para não ficar preso ao nome da pasta
# do projecto (que já mudou uma vez).
BE=$(container lms-backend)
[ -n "$BE" ] || die "container lms-backend não está a correr"
VOL=$(docker inspect "$BE" \
    --format '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}{{.Name}}{{end}}{{end}}')
[ -n "$VOL" ] || die "não encontrei o volume montado em /app/uploads"

# O conteúdo sai do volume por um tar em stdout e é extraído aqui, no host.
# Montar `$DEST` dentro do container seria mais directo e está errado: o
# `-v` resolve o caminho no host *do daemon*, que não é necessariamente esta
# máquina — num Docker remoto, ou no Docker Desktop sobre WSL, a cópia vai
# para um sítio que este script nunca vê, e o backup fica vazio sem dar erro.
#
# `--skip-old-files` é o que torna o espelho aditivo: traz o que falta e
# nunca sobrepõe o que já está guardado.
docker run --rm -v "$VOL":/data:ro alpine:3 tar cf - -C /data . \
    | tar xf - --skip-old-files -C "$DEST/uploads" \
    || die "a cópia dos uploads falhou"

log "uploads ok: $(du -sh "$DEST/uploads" | cut -f1) em $VOL"

# --- Segredos ---
if [ -f "$ROOT/.env" ]; then
    cp "$ROOT/.env" "$DEST/env/.env"
    chmod 600 "$DEST/env/.env"
    log "env ok"
else
    log "aviso: $ROOT/.env não existe"
fi

# --- Retenção ---
# Só os dumps são datados, logo só eles crescem sem limite.
REMOVED=$(find "$DEST/db" -name '*.dump' -type f -mtime +"$KEEP_DAYS" -print -delete | wc -l)
[ "$REMOVED" -eq 0 ] || log "apagados $REMOVED dumps com mais de $KEEP_DAYS dias"

log "concluído"