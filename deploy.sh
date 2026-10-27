#!/usr/bin/env bash

set -euo pipefail

log() {
    printf '\n\033[33m%s\033[0m\n\n' "$1"
}

main() {
    cd "$(dirname "${BASH_SOURCE[0]}")"

    log "Neue Änderungen aus GitHub holen"
    git pull --ff-only

    log "Docker Build starten"
    docker compose up -d --build
}

main "$@"
exit
