# Security-Testfälle

Testfälle für Backend (Port 5000), Host-Helfer (Port 5001) und Frontend. "Erwartung" ist der Soll-Zustand. Den Stand der Umsetzung und des Testens zeigt die Checkliste unten.

## Authentifizierung und Autorisierung

| # | Testfall | Vorgehen | Erwartung |
| --- | --- | --- | --- |
| 1 | `/restart` ohne Login | `curl -X POST http://<pi>:5000/restart` | 401/403 |
| 2 | `/update` ohne Login | `curl -X POST http://<pi>:5000/update` | 401/403 |
| 3 | `POST /settings` ohne Login | `curl -X POST -H "Content-Type: application/json" -d '{"weatherlocation":"x"}' http://<pi>:5000/settings` | 401/403 |
| 4 | Admin-Route im Frontend | `/admin` direkt im Browser öffnen | Login oder Sperre |
| 5 | Host-Helfer direkt erreichbar | `curl -X POST http://<pi>:5001/restart` aus dem LAN | Nur von localhost oder dem Docker-Netz erreichbar |
| 6 | CORS | `curl -H "Origin: http://evil.example" -i http://<pi>:5000/settings` | Kein `Access-Control-Allow-Origin` für fremde Origins |

## IDOR / Zugriffskontrolle

| # | Testfall | Vorgehen | Erwartung |
| --- | --- | --- | --- |
| 7 | Fremde Firestore-Dokumente überschreiben | `POST /settings` mit `{"../other":"x"}` und mit `{"__name__":"x"}` | 400 "Unbekannte Parameter" |
| 8 | Mass Assignment | `POST /settings` mit `{"weatherlocation":"Bern","admin":true}` | 400, und es wird nichts gespeichert (auch `weatherlocation` nicht) |
| 9 | Direkter Firestore-Zugriff | Ohne Backend per REST/SDK auf `settings/general` zugreifen (Firestore Security Rules prüfen) | Lesen und Schreiben ohne Login verweigert |

Das System hat keine Objekt-IDs in URLs und keine Nutzer, und es gibt genau ein Settings-Dokument. Klassisches IDOR ist deshalb kaum möglich. Relevant ist hier die fehlende Zugriffskontrolle, also die Fälle 1–5 und 9.

## XSS und Injection

| # | Testfall | Vorgehen | Erwartung |
| --- | --- | --- | --- |
| 10 | Stored XSS über Settings | `{"weatherlocation":"<img src=x onerror=alert(1)>"}` speichern, danach `/` und `/weather` öffnen | Kein Script läuft, der Text wird escaped angezeigt |
| 11 | XSS über API-Antworten | Stationsnamen oder Fehlermeldungen mit `<script>` simulieren (Mock von transport.opendata.ch) | Wird als Text gerendert |
| 12 | Parameter-Injection in externe URLs | `weatherlocation` = `Bern&count=100` oder `%26format=xml` | Wird per `encodeURIComponent` als ein Wert behandelt |
| 13 | Eingabevalidierung | `POST /settings` mit Zahl, Array, `null`, 101 Zeichen, nur Leerzeichen, kein JSON, falschem Content-Type | 400 |

## Checkliste

Ein Haken heisst: Der Testfall wurde ausgeführt und das Ergebnis entspricht der Erwartung. Hinter jedem Fall steht, ob die Behebung im Code schon umgesetzt ist.

### Authentifizierung und Autorisierung

- [ x ] **1** `/restart` ohne Login liefert 401.
- [ x ] **2** `/update` ohne Login liefert 401.
- [ x ] **3** `POST /settings` ohne Login liefert 401.
- [ x ] **4** `/admin` zeigt ohne Anmeldung nur das Login.
- [ x ] **5** Host-Helfer (Port 5001) ist aus dem LAN nicht erreichbar.
- [ ] **6** CORS erlaubt keine fremden Origins.

### IDOR / Zugriffskontrolle

- [ ] **7** Unbekannte Schlüssel in `POST /settings` liefern 400.
- [ ] **8** Zusatzfeld (`admin: true`) liefert 400, und es wird nichts gespeichert.
- [ ] **9** Direkter Firestore-Zugriff ist durch Security Rules gesperrt.

### XSS und Injection

- [ ] **10** Stored XSS über die Einstellungen führt kein Script aus.
- [ ] **11** Fremde API-Antworten und Fehlermeldungen werden als Text gerendert.
- [ ] **12** `&` und `%26` im Ortsnamen ändern die externe URL nicht.
- [ ] **13** Ungültige Eingaben liefern 400.

## Fazit

Der grösste Befund ist, dass es keine Authentifizierung gibt, nirgends. Dazu kommen der offene Host-Helfer auf Port 5001 und CORS `*`. Der Helfer ist der kritischste Punkt, weil er Reboot und `git pull` auf dem Host ausführt. Gegen XSS ist das Frontend durch Angular gut geschützt.
