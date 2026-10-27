#!/usr/bin/env bash

# Installationsskript für den Raspberry Pi (Raspberry Pi OS Lite, frisch aufgesetzt)
# Das Skript soll mehrfach ausführbar sein (idempotent): vor jedem Schritt prüfen, ob er schon erledigt ist.

# --- 0. Grundeinstellungen ---
# - Skript bei Fehlern, nicht gesetzten Variablen und fehlschlagenden Pipes abbrechen lassen
# - Variablen festlegen (Repo-URL, Zielordner, Benutzer)
# - Prüfen, ob das Skript mit den nötigen Rechten läuft (root / sudo)

set -euo pipefail

# Gelbe Meldung mit einer Leerzeile davor und danach
log() {
    printf '\n\033[33m%s\033[0m\n\n' "$1"
}

TARGET_USER="${SUDO_USER:-$USER}"
TARGET_UID="$(id -u "$TARGET_USER")"
REPO_URL="https://github.com/Magnus-90/Raspberry-Pi-Projekt-NL-MHA.git"
PROJECT_DIR="/home/$TARGET_USER/Raspberry-Pi-Projekt-NL-MHA"

# --- 1. System aktualisieren ---
log "System aktualisieren"

sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y git curl

# --- 2. Docker installieren ---
log "Docker installieren"

if command -v docker > /dev/null; then
    log "Docker ist bereits installiert, überspringe die Installation."
else
    # Das Convenience-Skript installiert auch das Compose-Plugin
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sudo sh /tmp/get-docker.sh
    rm /tmp/get-docker.sh
fi

sudo usermod -aG docker "$TARGET_USER"
sudo systemctl enable --now docker
sudo docker compose version

# --- 3. Repo klonen ---
log "Repo klonen"

if [ -d "$PROJECT_DIR/.git" ]; then
    log "Repo existiert bereits, hole Änderungen."
    sudo -u "$TARGET_USER" git -C "$PROJECT_DIR" pull
else
    sudo -u "$TARGET_USER" git clone "$REPO_URL" "$PROJECT_DIR"
fi

# --- 4. Container starten (als systemd-Dienst, startet auch bei jedem Boot) ---
log "Container starten"

SERVICE_NAME_CONTAINER="raspberry-pi-projekt.service"

sed -e "s|@USER@|$TARGET_USER|g" \
    -e "s|@PROJECT_DIR@|$PROJECT_DIR|g" \
    "$PROJECT_DIR/systemd/$SERVICE_NAME_CONTAINER" \
    | sudo tee "/etc/systemd/system/$SERVICE_NAME_CONTAINER" > /dev/null

sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME_CONTAINER"

# --- 5. Kiosk-Browser einrichten (Pi OS Lite, also ohne Desktop) ---
# - Minimale grafische Umgebung installieren (z. B. cage oder Xorg + openbox)
# - Chromium installieren
# - Benutzer die nötigen Gruppen geben (video, render, input)
# - systemd-Dienst für den Kiosk anlegen (Chromium im Vollbild mit der Frontend-URL)
# - Dienst so konfigurieren, dass er erst nach Docker und erreichbarem Frontend startet
# - Dienst beim Booten aktivieren
log "Kiosk-Browser einrichten"

SERVICE_NAME_KIOSK="kiosk.service"

sudo apt-get install -y --no-install-recommends cage chromium seatd
sudo systemctl enable --now seatd

KIOSK_GROUPS="video,input,render"
if getent group seat > /dev/null; then
    KIOSK_GROUPS="$KIOSK_GROUPS,seat"
fi
sudo usermod -aG "$KIOSK_GROUPS" "$TARGET_USER"

sed -e "s|@USER@|$TARGET_USER|g" \
    -e "s|@UID@|$TARGET_UID|g" \
    "$PROJECT_DIR/systemd/$SERVICE_NAME_KIOSK" \
    | sudo tee "/etc/systemd/system/$SERVICE_NAME_KIOSK" > /dev/null

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME_KIOSK"


# --- 6. Helfer-Dienst für Update und Neustart ---
# - Flask für das System-Python installieren (der Helfer läuft auf dem Host, nicht im Container)
# - systemd-Dienst anlegen, aktivieren und starten
log "Helfer-Dienst für Update und Neustart"
SERVICE_NAME_HELPER="admin.service"

sudo apt-get install -y python3-flask

SUDOERS_FILE="/etc/sudoers.d/raspberry-pi-projekt-helper"

echo "$TARGET_USER ALL=(root) NOPASSWD: /usr/bin/systemctl reboot" | sudo tee "$SUDOERS_FILE.tmp" > /dev/null
sudo chmod 0440 "$SUDOERS_FILE.tmp"
if sudo visudo -cf "$SUDOERS_FILE.tmp" > /dev/null; then
    sudo mv "$SUDOERS_FILE.tmp" "$SUDOERS_FILE"
else
    sudo rm -f "$SUDOERS_FILE.tmp"
    echo "Die sudoers-Regel ist ungültig, Abbruch." >&2
    exit 1
fi

sed -e "s|@USER@|$TARGET_USER|g" \
    -e "s|@PROJECT_DIR@|$PROJECT_DIR|g" \
    "$PROJECT_DIR/systemd/$SERVICE_NAME_HELPER" \
    | sudo tee "/etc/systemd/system/$SERVICE_NAME_HELPER" > /dev/null

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME_HELPER"
sudo systemctl restart "$SERVICE_NAME_HELPER"

# --- 7. GitHub Actions Runner für das automatische Deployment ---
# - Der Runner verbindet sich von sich aus mit GitHub, es muss nichts zum Pi geöffnet werden
# - Das Registrierungs-Token ist nur kurz gültig und kommt aus GitHub (Settings > Actions > Runners > New self-hosted runner)
# - Das Skript fragt nach dem Token. Alternativ ohne Rückfrage: RUNNER_TOKEN=<token> bash install.sh
log "GitHub Actions Runner einrichten"

RUNNER_DIR="/home/$TARGET_USER/actions-runner"
RUNNER_REPO_URL="https://github.com/Magnus-90/Raspberry-Pi-Projekt-NL-MHA"

# Ist kein Token übergeben und der Runner noch nicht eingerichtet, fragt das Skript danach.
# Die Eingabe bleibt unsichtbar (-s), und mit einer leeren Eingabe wird der Schritt übersprungen.
RUNNER_TOKEN="${RUNNER_TOKEN:-}"
if [ ! -f "$RUNNER_DIR/.runner" ] && [ -z "$RUNNER_TOKEN" ] && [ -t 0 ]; then
    log "Für den Runner wird ein Token aus GitHub gebraucht (Settings > Actions > Runners > New self-hosted runner). Leer lassen zum Überspringen."
    read -r -s -p "Runner-Token: " RUNNER_TOKEN || true
    echo
fi

if [ -f "$RUNNER_DIR/.runner" ]; then
    log "Der Runner ist bereits eingerichtet, überspringe die Einrichtung."
elif [ -z "${RUNNER_TOKEN:-}" ]; then
    log "RUNNER_TOKEN ist nicht gesetzt, überspringe die Einrichtung des Runners."
else
    case "$(uname -m)" in
        aarch64) RUNNER_ARCH="arm64" ;;
        armv7l)  RUNNER_ARCH="arm" ;;
        x86_64)  RUNNER_ARCH="x64" ;;
        *)
            echo "Unbekannte Architektur: $(uname -m)" >&2
            exit 1
            ;;
    esac

    # Neueste Version des Runners von GitHub lesen
    RUNNER_VERSION="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest | grep -m1 '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')"

    sudo -u "$TARGET_USER" mkdir -p "$RUNNER_DIR"
    curl -fsSL -o /tmp/actions-runner.tar.gz \
        "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
    sudo -u "$TARGET_USER" tar xzf /tmp/actions-runner.tar.gz -C "$RUNNER_DIR"
    rm /tmp/actions-runner.tar.gz

    sudo "$RUNNER_DIR/bin/installdependencies.sh"

    # config.sh darf nicht als root laufen und muss im Runner-Ordner gestartet werden
    (cd "$RUNNER_DIR" && sudo -u "$TARGET_USER" ./config.sh --unattended \
        --url "$RUNNER_REPO_URL" \
        --token "$RUNNER_TOKEN" \
        --name "$(hostname)" \
        --labels raspi \
        --replace)

    # Als Dienst installieren, damit der Runner beim Booten startet und als normaler Benutzer läuft
    (cd "$RUNNER_DIR" && sudo ./svc.sh install "$TARGET_USER" && sudo ./svc.sh start)
fi

# --- 8. Abschluss ---
# - Zusammenfassung ausgeben (was wurde installiert, welche URL, wie geht es weiter)
# - Optional: Neustart anbieten

log "Installation abgeschlossen"

log "Damit die Änderungen wirksam werden muss das Gerät neugestartet werden"

read -r -p "Neustarten? (ja/nein): " REBOOT || true
if [ "$REBOOT" = "ja" ] && [ -t 0 ]; then
    sudo reboot
fi