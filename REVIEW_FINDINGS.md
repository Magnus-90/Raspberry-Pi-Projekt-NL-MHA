# Review: Auffälligkeiten im Projekt

Review des ganzen Projekts (Stand: Arbeitskopie mit entfernter Dummy-Route `/` in `backend/backend.py`).
Jeder Befund wurde am Code nachgeprüft. Sortiert nach Schwere. Nur Beobachtungen, keine Änderungen am Code.

## Befunde

1. **Keine Authentifizierung auf `/update`, `/restart` und `POST /settings`, Host-Helfer offen im LAN**
   (`backend/backend.py` Z. 9 `CORS(app)`, `host-helper/helper.py` Z. 34 `host="0.0.0.0"`)
   Jedes Gerät im LAN kann den Pi neu starten, ein Update auslösen oder die Orte überschreiben. Der Helfer auf Port 5001 ist direkt erreichbar, das Backend muss also nicht einmal umgangen werden. `/restart` ist ein „simple request“ (POST ohne Body), deshalb reicht auch eine beliebige Webseite im Browser eines LAN-Nutzers (CSRF), CORS schützt hier nicht.

2. **ÖV-Polling läuft nach dem Verlassen der Ansicht weiter** (`public-transport.ts` Z. 58, Z. 65-67)
   `ngOnDestroy` löscht nur den aktuell gesetzten Timer. Läuft gerade ein `update()` (zwei `fetch`-Aufrufe), setzt es nach dem Destroy in Z. 44 bzw. Z. 58 einen neuen Timer, der nie mehr gelöscht wird. Jeder Wechsel Dashboard ↔ Vollbild während einer Anfrage hinterlässt so eine weitere Endlosschleife, die Backend/Firestore und transport.opendata.ch abfragt. Lösung: `destroyed`-Flag setzen und in `update()` vor dem Planen prüfen.

3. **Wetter wird nie aktualisiert** (`weather.ts` Z. 87-99)
   Die Daten werden einmal in `ngOnInit` geladen. Im Kiosk läuft die Seite tagelang, Temperatur, Icon und Tag/Nacht bleiben auf dem Stand des Starts stehen. Eine im Admin Panel geänderte Wetter-Stadt erscheint ebenfalls erst nach einem Browser-Neustart (also nach einem Reboot).

4. **Wetter-Kachel stürzt bei API-Fehler im Template ab** (`weather.ts` Z. 49, `weather.html` Z. 7)
   `getCurrentWeahterData` prüft `response.ok` nicht. Liefert Open-Meteo `{ "error": true, "reason": … }` (z. B. 400/429), wird das Objekt gesetzt, `@if (weatherdata())` ist wahr und `weather.current.weather_code` wirft einen TypeError beim Rendern.

5. **Admin Panel: TypeError, wenn die Einstellungen nicht geladen werden können** (`admin-component.ts` Z. 90-95)
   `getSettings()` gibt bei Fehler `undefined` zurück, `settings.publictransportlocation` wirft dann. Folge: `setInterval` wird nie gestartet, die Systemwerte bleiben bei „keine Daten“, obwohl `/health` ohne Firestore funktionieren würde (z. B. fehlender Schlüssel).

6. **Admin Panel: `setInterval` ohne Aufräumen, ohne Fehlerbehandlung, erster Wert erst nach 10 s** (`admin-component.ts` Z. 16-21, Z. 93)
   Kein `OnDestroy`/`clearInterval`: Jeder Besuch von `/admin` startet einen weiteren Timer, der nach dem Verlassen weiterläuft. `getsystemStats()` hat kein try/catch, bei nicht erreichbarem Backend entsteht alle 10 s eine unhandled rejection. Die erste Anzeige kommt erst nach 10 s (plus 1 s `cpu_percent(interval=1)`).

7. **Neue Frontend-Versionen erreichen das Display nicht** (`deploy.sh` Z. 16, `host-helper/helper.py` Z. 17)
   Deploy und Update bauen die Container neu, Chromium im Kiosk lädt die Seite aber nie neu. Das Display zeigt die alte App, bis der Browser oder der Pi neu startet. Das Admin-Update meldet „gestartet“, ändert am Display aber nichts. Lösung: z. B. nach dem Build `systemctl restart kiosk.service` (sudoers-Regel ergänzen) oder Versions-Polling im Frontend mit `location.reload()`.

8. **Aus dem Vollbild gibt es keinen Weg zurück** (`overview.ts` Z. 54-56, `app.html`)
   Ein Klick auf eine Kachel navigiert nach `/clock`, `/weather` oder `/publictransport`. Dort gibt es weder Zurück-Button noch Klick-Handler, und im Kiosk fehlt die Browser-Oberfläche. Auf einem Touch-Display bleibt die Anzeige nach einem versehentlichen Tippen dauerhaft im Vollbild hängen (bis zum Neustart).

9. **Zeit-Modul ohne Locale: englisches Datum, ggf. 12-h-Format** (`time.ts` Z. 10-16)
   `toLocaleTimeString()` und `toDateString()` ohne Locale ergeben „Wed Oct 28 2026“ und je nach System-Locale „3:05:12 PM“. Auf Pi OS Lite ist die Locale oft `en_GB`/`en_US`. Besser `toLocaleTimeString('de-CH')` / `toLocaleDateString('de-CH', { … })`. Alle anderen UI-Texte sind deutsch.

10. **`app.spec.ts` schlägt fehl** (`frontend/src/app/app.spec.ts` Z. 21)
    Der Test erwartet ein `<h1>` mit „Hello, frontend“, `app.html` enthält aber nur `<router-outlet>`. `npm test` ist damit rot. (Das in CLAUDE.md erwähnte kaputte `time.spec.ts` ist dagegen inzwischen korrekt, siehe unten.)

## Weitere Beobachtungen (niedrig)

- **Diff:** Nach dem Entfernen der Route `/` ist `import json` in `backend/backend.py` Z. 3 ungenutzt.
- `host-helper/helper.py` Z. 16 und `systemd/raspberry-pi-projekt.service` Z. 12 nutzen `git pull` ohne `--ff-only` (anders als `deploy.sh`). Bei lokalen Änderungen entsteht ein Merge-Commit, danach scheitert `deploy.sh` mit `--ff-only` dauerhaft. Kein Lock gegen zwei parallele Updates.
- `backend.py` Z. 38/59: Fehlerantworten enthalten `str(e)` (Pfad des Schlüssels, Projektinfos).
- `backend.py` Z. 76: `except FileNotFoundError` um `psutil.cpu_percent` passt nicht zu den Fehlern, die psutil wirft.
- `weather.ts` Z. 66: Geocoding mit `count=1` ohne `countryCode=CH`, mehrdeutige Namen (z. B. „Baden“) können einen Ort außerhalb der Schweiz liefern.
- `admin-component.ts` Z. 23-43: `saveSettings` setzt einen alten Fehler nicht zurück und gibt kein Erfolgs-Feedback. Tippfehler `respone`.
- `install.sh` Z. 196-197: Es wird erst gefragt und danach `[ -t 0 ]` geprüft. Bei nicht-interaktivem Lauf erscheint die Frage, ein Neustart passiert aber nie.
- Backend-URL `http://${hostname}:5000` ist in drei Komponenten dupliziert, `/settings` wird in Wetter und ÖV separat implementiert.
- `console.log` im Produktivcode (`public-transport.ts` Z. 21, `admin-component.ts` Z. 19), viele `any`-Typen.
- Fehlende Einheiten in der Wetter-Kachel („Aktuelle Temperatur: 12.3“ ohne °C).

## Checkliste

Die Nummern verweisen auf die Befunde oben.

### Hoch

- [ ] 1: Token-Auth für `/update`, `/restart`, `POST /settings`; CORS auf die eigene Origin einschränken; Host-Helfer nur an die Docker-Bridge/localhost binden
- [ x ] 2: ÖV: `destroyed`-Flag, nach Destroy keinen neuen Timer mehr planen
- [ x ] 3: Wetter periodisch neu laden (z. B. alle 10-15 min), dabei auch den Ort neu lesen
- [ x ] 4: Wetter: `response.ok` prüfen, Template gegen fehlendes `current` absichern, Fehlermeldung anzeigen
- [ x ] 7: Nach Deploy/Update den Kiosk-Browser neu laden (Dienst neu starten oder Versions-Polling)

### Mittel

- [ x ] 5: `AdminComponent.ngOnInit` gegen `undefined` aus `getSettings()` absichern
- [ x ] 6: Admin: `OnDestroy` mit `clearInterval`, try/catch in `getsystemStats()`, Werte sofort beim Start laden
- [ ] 8: Rückweg aus dem Vollbild (Klick/Tippen oder Timeout zurück zur Übersicht)
- [ ] 9: Zeit-Modul mit Locale `de-CH`
- [ ] Helfer und Boot-Dienst: `git pull --ff-only`, Lock gegen parallele Updates
- [ ] Keine `str(e)` mehr in Fehlerantworten

### Niedrig

- [ ] 10: `app.spec.ts` an das aktuelle `app.html` anpassen
- [ ] Ungenutztes `import json` in `backend.py` entfernen
- [ ] Geocoding mit `countryCode=CH`
- [ ] Admin: Erfolgs-Feedback, alten Fehler zurücksetzen, Tippfehler `respone`
- [ ] `install.sh`: `[ -t 0 ]` vor der Neustart-Frage prüfen
- [ ] Backend-URL und Settings-Abruf zentral (Konstante/Funktion)
- [ ] `console.log` entfernen, `any` durch Interfaces ersetzen, Einheit °C anzeigen
- [ ] CLAUDE.md korrigieren (`time.spec.ts` ist nicht mehr kaputt, `shared/interfaces.ts` existiert nicht)
