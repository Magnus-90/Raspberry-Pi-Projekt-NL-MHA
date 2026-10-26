# Raspberry-Pi-Projekt-NL-MHA

Informationsdisplay für den Raspberry Pi. Ein Browser im Kiosk-Modus zeigt Uhrzeit, Wetter und öffentlichen Verkehr an. Über ein Admin Panel lassen sich Einstellungen ändern, der Pi aktualisieren und neu starten.

## Aufbau

| Teil | Technik | Läuft | Port |
|---|---|---|---|
| Frontend | Angular, ausgeliefert von nginx | Docker-Container | 80 |
| Backend | Flask (Python) | Docker-Container | 5000 |
| Helfer (`host-helper/`) | Flask (Python) | direkt auf dem Pi (systemd) | 5001 |
| Kiosk | `cage` mit Chromium | direkt auf dem Pi (systemd) | – |
| Einstellungen | Firebase Firestore | Cloud | – |

Der Helfer läuft bewusst **nicht** im Container: Er muss den Pi neu starten und das Projekt per `git pull` aktualisieren können. Das Backend ruft ihn über `host.docker.internal` auf.

Seiten des Frontends: `/clock`, `/weather`, `/publictransport`, `/admin`.

## Voraussetzungen

- Raspberry Pi mit **Raspberry Pi OS Lite**, SSH aktiviert (zum Beispiel im Raspberry Pi Imager), Internetverbindung
- Ein Benutzer mit `sudo`-Rechten (im Beispiel `admin`)
- Ein Firebase-Projekt mit angelegter **Firestore-Datenbank** und ein **Dienstkonto-Schlüssel** (JSON-Datei)

## Installation

### 1. Repository auf dem Pi klonen

Per SSH auf dem Pi:

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/Magnus-90/Raspberry-Pi-Projekt-NL-MHA.git ~/Raspberry-Pi-Projekt-NL-MHA
cd ~/Raspberry-Pi-Projekt-NL-MHA
```

Der Ordner muss `~/Raspberry-Pi-Projekt-NL-MHA` heißen, das Installationsskript erwartet ihn dort.

### 2. Firebase-Schlüssel auf den Pi kopieren

Die Schlüsseldatei liegt aus Sicherheitsgründen **nicht** im Repository (`backend/db/` steht in der `.gitignore`). Sie muss von Hand auf den Pi, zum Beispiel vom eigenen PC aus:

```bash
ssh admin@<pi-name> "mkdir -p ~/Raspberry-Pi-Projekt-NL-MHA/backend/db"
scp backend/db/<schluessel-datei>.json admin@<pi-name>:~/Raspberry-Pi-Projekt-NL-MHA/backend/db/
```

Der Dateiname muss mit `KEY_PATH` in `backend/db_methods.py` übereinstimmen.

### 3. Installationsskript ausführen

Als normaler Benutzer, **nicht** mit `sudo` (das Skript ruft `sudo` selbst auf, wo es nötig ist):

```bash
bash install.sh
```

Das Skript kann mehrfach ausgeführt werden. Es erledigt der Reihe nach:

1. System aktualisieren (`apt-get update` und `upgrade`), `git` und `curl` installieren
2. Docker installieren, falls nicht vorhanden, und den Benutzer zur Gruppe `docker` hinzufügen
3. Das Repository aktualisieren (`git pull`)
4. Den Dienst `raspberry-pi-projekt.service` anlegen und starten. Er führt bei jedem Boot `git pull` und `docker compose up -d --build` aus.
5. Den Kiosk einrichten: `cage`, `chromium` und `seatd` installieren, Benutzer in die Gruppen `video`, `input`, `render` (und `seat`) aufnehmen, `kiosk.service` anlegen und aktivieren
6. Den Helfer einrichten: `python3-flask` installieren, eine `sudoers`-Regel anlegen (nur `systemctl reboot` ohne Passwort) und `admin.service` starten

Der Docker-Build dauert beim ersten Mal auf dem Pi mehrere Minuten.

### 4. Neu starten

```bash
sudo reboot
```

Der Kiosk wird bewusst nicht vom Skript gestartet, weil er die Konsole `tty1` übernimmt. Er erscheint nach dem Neustart auf dem Display.

## Nach der Installation prüfen

```bash
systemctl status raspberry-pi-projekt.service kiosk.service admin.service
docker ps
curl http://localhost:5001/health
curl http://localhost:5000/health
```

Das Admin Panel ist im Netzwerk unter `http://<pi-name>/admin` erreichbar, zum Beispiel `http://testraspy.local/admin`.

## Aktualisieren

- Über das **Admin Panel** (Knopf "Raspberry Pi Display Updaten"): führt `git pull` und `docker compose up -d --build` aus.
- Oder per SSH: `git pull` im Projektordner und danach `bash install.sh`, falls sich Dienste oder das Skript geändert haben.

## Dienste

| Dienst | Aufgabe |
|---|---|
| `raspberry-pi-projekt.service` | Startet die Container (`git pull`, `docker compose up -d --build`) |
| `kiosk.service` | Chromium im Kiosk-Modus über `cage` auf `tty1` |
| `admin.service` | Helfer für Update und Neustart (Port 5001) |

Logs ansehen: `journalctl -u <dienst> -b`. Logs des Backends: `docker logs raspberry-pi-backend`.

## Zurück zur Konsole

Solange der Kiosk läuft, gibt es auf `tty1` keine Anmeldung. Der Zugriff erfolgt per **SSH**. Den Kiosk beenden:

```bash
sudo systemctl stop kiosk.service        # bis zum nächsten Neustart
sudo systemctl disable kiosk.service     # beim Booten nicht mehr starten
```
