#!/usr/bin/env bash

# Installationsskript für den Raspberry Pi (Raspberry Pi OS Lite, frisch aufgesetzt)
# Das Skript soll mehrfach ausführbar sein (idempotent): vor jedem Schritt prüfen, ob er schon erledigt ist.

# --- 0. Grundeinstellungen ---
# - Skript bei Fehlern, nicht gesetzten Variablen und fehlschlagenden Pipes abbrechen lassen
# - Variablen festlegen (Repo-URL, Zielordner, Benutzer)
# - Prüfen, ob das Skript mit den nötigen Rechten läuft (root / sudo)

set -euo pipefail

TARGET_USER="${SUDO_USER:-$USER}"
TARGET_UID="$(id -u "$TARGET_USER")"
REPO_URL="https://github.com/Magnus-90/Raspberry-Pi-Projekt-NL-MHA.git"
PROJECT_DIR="/home/$TARGET_USER/Raspberry-Pi-Projekt-NL-MHA"

# --- 1. System aktualisieren ---

sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y git curl

# --- 2. Docker installieren ---

if command -v docker > /dev/null; then
    echo "Docker ist bereits installiert, überspringe die Installation."
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

if [ -d "$PROJECT_DIR/.git" ]; then
    echo "Repo existiert bereits, hole Änderungen."
    sudo -u "$TARGET_USER" git -C "$PROJECT_DIR" pull
else
    sudo -u "$TARGET_USER" git clone "$REPO_URL" "$PROJECT_DIR"
fi

# --- 4. Container starten (als systemd-Dienst, startet auch bei jedem Boot) ---

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


# --- 6. Helfer-Dienst für Update und Neustart (später) ---
# - Skript für /update und /restart auf dem Host ablegen
# - Token erzeugen und sicher ablegen
# - systemd-Dienst anlegen, aktivieren und starten

# --- 7. Abschluss ---
# - Zusammenfassung ausgeben (was wurde installiert, welche URL, wie geht es weiter)
# - Optional: Neustart anbieten
