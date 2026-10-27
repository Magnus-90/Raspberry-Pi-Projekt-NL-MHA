# CLAUDE.md

Informationsdisplay für einen Raspberry Pi: Chromium im Kiosk-Modus zeigt ein Dashboard mit Uhrzeit, Wetter und ÖV-Abfahrten. Ein Admin Panel ändert Einstellungen (Firestore), aktualisiert und startet den Pi neu. Ausführliche Installations- und Betriebsdoku steht in [README.md](README.md), hier nur, was man zum Arbeiten am Code braucht.

Sprache im Projekt: Deutsch (UI-Texte, Kommentare, Commits, Doku). Code-Bezeichner sind gemischt.

## Architektur

| Teil | Ordner | Technik | Läuft | Port |
|---|---|---|---|---|
| Frontend | `frontend/` | Angular 21 + CDK, nginx | Docker | 80 |
| Backend | `backend/` | Flask, firebase-admin, psutil | Docker | 5000 |
| Host-Helfer | `host-helper/` | Flask | direkt auf dem Pi (systemd) | 5001 |
| Kiosk | `systemd/kiosk.service` | `cage` + Chromium | direkt auf dem Pi | – |
| Einstellungen | – | Firebase Firestore (`settings/general`) | Cloud | – |

Datenfluss:
- Frontend ruft das Backend direkt per `fetch` auf `http://${window.location.hostname}:5000` (kein Proxy in nginx, kein HttpClient).
- Wetter und ÖV holen ihren Ort über `GET /settings` vom Backend und rufen danach externe APIs direkt aus dem Browser auf: Open-Meteo (Geocoding + Forecast) und transport.opendata.ch.
- Update/Neustart: Admin Panel → Backend (`POST /update`, `/restart`) → Host-Helfer über `host.docker.internal:5001`. Der Helfer läuft bewusst außerhalb von Docker, weil er `git pull`, `docker compose` und `systemctl reboot` auf dem Host ausführt.

## Ordnerstruktur

```
├── frontend/                  Angular-App
│   ├── src/app/
│   │   ├── app.routes.ts      Routen: '' Overview, /clock, /weather, /publictransport, /admin
│   │   ├── app.config.ts      provideRouter mit withViewTransitions()
│   │   ├── overview/          Dashboard (2×2 Drag & Drop Grid), Startseite
│   │   ├── shared/panel/      Kachel-Hülle um ein Modul (CDK Drag, Klick öffnet Vollbild)
│   │   ├── shared/interfaces.ts  (aktuell ungenutzt)
│   │   └── modules/           Ein Ordner pro Modul
│   │       ├── time/          Uhrzeit + Datum (selector app-time, Klasse TimeConponent)
│   │       ├── weather/       Open-Meteo, WMO-Code → Icon in public/icons/
│   │       ├── public-transport/  Abfahrten, Polling bis zur nächsten Abfahrt (10–60 s)
│   │       └── admin/         Settings, Systemwerte (/health), Update, Neustart
│   ├── src/styles.scss        Globale Styles: Vollbild-Module, view-transition-names
│   ├── public/icons/          Wetter-SVGs (~120 Dateien)
│   ├── dockerfile, nginx.conf Build mit node:22, Auslieferung mit nginx (SPA-Fallback)
├── backend/
│   ├── backend.py             Flask-Routen
│   ├── db_methods.py          Firestore-Zugriff, KEY_PATH, SETTINGS_KEYS
│   ├── db/                    Firebase-Schlüssel (gitignored, read-only in den Container gemountet)
│   └── requirements.txt       ACHTUNG: UTF-16-kodiert
├── host-helper/helper.py      /health, /update, /restart
├── systemd/                   Service-Vorlagen mit @USER@/@PROJECT_DIR@/@UID@, von install.sh befüllt
├── install.sh                 Idempotente Einrichtung des Pi
├── deploy.sh                  git pull --ff-only + docker compose up -d --build
├── docker-compose.yml
└── .github/workflows/deploy.yml  Self-hosted Runner auf dem Pi, nur bei push auf main
```

## Backend-API (Port 5000)

| Route | Methode | Zweck |
|---|---|---|
| `/settings` | GET | `{ weatherlocation, publictransportlocation }` aus Firestore |
| `/settings` | POST | Nur Schlüssel aus `SETTINGS_KEYS`, Strings ≤ 100 Zeichen, merge in Firestore |
| `/health` | GET | Temperatur, CPU, RAM des Pi |
| `/update`, `/restart` | POST | Leitet an den Host-Helfer weiter (202 bei Erfolg, 502 wenn nicht erreichbar) |

Eine neue Einstellung braucht: Eintrag in `SETTINGS_KEYS` (`db_methods.py`), Feld im Admin Panel, Nutzung im Modul.

## Frontend: Dashboard und Panels

Kernlogik in `overview/overview.ts`:
- `cells`: Ankerfeld je Modul (0 = oben links, 1 = oben rechts, 2 = unten links, 3 = unten rechts). Die Größe wird nicht gespeichert, sondern von `areaOf()` berechnet: Ein Modul wächst in freie Nachbarfelder.
- `vertical`: Füllrichtung (false = zuerst Zeile, true = zuerst Spalte). Es gilt immer nur eine Richtung, sonst überlappen bei 3 Modulen zwei Panels.
- `dragging`: Während des Drags belegt das gezogene Panel nur das Viertel unter der Maus.
- `drop()`: Ermittelt das Modul, das das Zielfeld sichtbar belegt (über `covers()`, nicht über den Anker). Belegt es mehrere Felder, behält es den Rest, sonst tauschen beide. Danach wird `vertical` so gesetzt, dass das verdrängte Modul wachsen kann.
- Persistenz: localStorage `dashboard-cells` und `dashboard-vertical` (vorläufig, Firestore geplant).
- `open(id)` navigiert über `MODULE_ROUTES` ins Vollbild.

`shared/panel/`: Freier CDK-Drag (`cdkDrag` ohne DropList) nur an der Kopfzeile (`cdkDragHandle`). Beim Loslassen `dropPoint` nach oben melden und `reset()`, die Position kommt ausschließlich aus dem CSS Grid. Ein Klick öffnet das Modul nur, wenn sich die Maus seit `pointerdown` um weniger als 5 px bewegt hat.

Ein neues Modul ins Dashboard aufnehmen: Komponente unter `modules/`, Route in `app.routes.ts`, `<app-panel>` in `overview.html`, Eintrag in `DEFAULT_CELLS` und `MODULE_ROUTES`, `view-transition-name`-Regel in `styles.scss`. Bisher ist das Layout auf 3 Module und 4 Felder ausgelegt.

## Konventionen

- Standalone-Komponenten, Signals (`signal`, `input`, `output`, `viewChild`), Control Flow `@if`/`@for`. Kein NgModule, kein RxJS im App-Code.
- HTTP mit `fetch` + async/await, kein HttpClient.
- Module sind eigenständig und wissen nichts vom Dashboard, sie laufen in der Kachel und als eigene Route.
- Größen in Modulen in Container-Einheiten (`cqw`, `cqh`, `min(...)`) und Layoutwechsel per `@container`, nie `vw`. `.panel-body` ist der Size-Container. Im Vollbild ohne Container fallen `cq*` auf den Viewport zurück.
- Modul-Hosts brauchen `:host { display: block; height: 100%; }`.
- Prettier: printWidth 100, single quotes. Einrückung 2 Leerzeichen (manche SCSS-Dateien nutzen 4).

## Befehle

```bash
# Node: In WSL ist das System-Node v12. Vor jedem npm/ng-Befehl:
source ~/.nvm/nvm.sh

cd frontend
npm start                                  # ng serve, http://localhost:4200
npx ng build --configuration development   # schneller Compile-Check
npm test                                   # Vitest über @angular/build:unit-test

docker compose up -d --build               # Gesamtsystem lokal (Backend braucht den Firebase-Schlüssel in backend/db/)
```

Backend lokal: venv unter `backend/.venv`, `python backend.py`. Ohne Schlüsseldatei startet es trotzdem, nur `/settings` liefert 500.

## Fallstricke

- **Push auf `main` deployt sofort auf den Pi** (self-hosted Runner). Nicht direkt auf `main` committen, sondern über Feature-Branches mit PR arbeiten.
- **Kiosk läuft mit `--incognito`**: localStorage ist nach jedem Neustart des Browsers leer, das Dashboard-Layout geht dort also verloren.
- **Angular-Event-Handler, die `false` zurückgeben, lösen `preventDefault()` aus.** Ein `(pointerdown)="x = false"` im Template unterdrückt `mousedown`, und der CDK-Drag startet nie. Zuweisungen gehören in Methoden.
- **`view-transition-name` erzeugt einen Stacking Context** auf jedem `<app-panel>`. Ein `z-index` muss deshalb auf den Host (`:host:has(.cdk-drag-dragging)`), nicht auf innere Elemente. Doppelte Namen brechen die Transition ab, darum gelten die Namen im Vollbild nur für `.content > app-…`.
- Während einer View Transition (auch beim ersten Laden, ca. 400 ms) nimmt die Seite keine Klicks an.
- Textauswahl und natives Bild-Drag kollidieren mit dem CDK-Drag. Abgefangen über `user-select: none`, `(selectstart)` auf dem Dashboard und `-webkit-user-drag: none` (nur Chromium).
- `backend/requirements.txt` ist UTF-16: Beim Bearbeiten die Kodierung beibehalten oder bewusst auf UTF-8 umstellen.
- `KEY_PATH` in `db_methods.py` enthält den konkreten Dateinamen des Firebase-Schlüssels. Den Schlüssel selbst nie committen.
- Bekannt kaputt: `modules/time/time.spec.ts` importiert `./time-conponent` (existiert nicht mehr). `AdminComponent` räumt sein `setInterval` nicht auf.
- `install.sh` und die systemd-Vorlagen erwarten das Projekt unter `~/Raspberry-Pi-Projekt-NL-MHA`.
