# Tests

Zwei Testskripte prüfen die App direkt aus der HTML-Datei. Sie laufen aus dem Projektordner.

## Chemie (Engine)

```
node tests/engine.test.js
```

Lädt three.js, Regel-Engine, Lewis-Formel und Aufgaben aus der HTML-Datei und prüft unter anderem Ladungen, Ionen, Protonen, Konformation, Wasserstoffbrücken und die eingebauten Aufgaben. Braucht nur Node.js.

## Oberfläche (Browser)

```
node tests/ui.test.js [HTML-Datei] [Ordner für Screenshots]
```

Bedient die App in einem Headless-Chromium: Schalter, Knöpfe, Maus-Ziehen, Aufgaben, Speichern über Neuladen, Handybreite. Ohne Screenshot-Ordner werden keine Bilder gespeichert.

Benötigt [Playwright](https://playwright.dev) mit Chromium. Ist Playwright nicht normal installiert, gibt `PLAYWRIGHT_MODULE` den Pfad zum Modul an:

```
PLAYWRIGHT_MODULE=/pfad/zu/node_modules/playwright node tests/ui.test.js
```

Playwright verlangt Node.js 20 oder neuer. Mit Node.js 18 lässt sich die Versionsprüfung so umgehen (bisher ohne Probleme):

```
node -e "Object.defineProperty(process.versions,'node',{value:'20.0.0'}); process.argv.splice(1,0,'x'); require('./tests/ui.test.js')"
```

Beide Skripte geben jede Prüfung als `ok:` oder `FEHLER:` aus und enden mit Exit-Code 0, wenn alles bestanden ist.

## Bilder der Hilfe

```
node tools/hilfe-bilder.js [HTML-Datei]
```

Erzeugt die Screenshots der Hilfe („Für Lernende“, „Für Lehrende“) neu und schreibt sie als WebP in den Block `<script id="helpShots">` zwischen den Markierungen `HILFE-BILDER` in `index.html`. Nach Änderungen an der Oberfläche einmal laufen lassen. Braucht Playwright wie die UI-Tests (auch `PLAYWRIGHT_MODULE`). Der UI-Test prüft, dass zu jedem Bild der Hilfe Daten vorhanden sind.
