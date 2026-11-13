# Kugelwolken-Baukasten

Webapp für den Chemieunterricht: Atome der ersten drei Perioden im räumlichen Kugelwolkenmodell zu Molekülen und Ionen zusammensetzen. Man untersucht damit Elektronenpaarbindung, Ionenbindung, räumlichen Bau, Polarität und Lewis-Formel. Erweiterte Funktionen gibt es für Protonen, Wasserstoffbrücken und Konformationen.

Die ganze App steckt in **einer Datei**: [`index.html`](index.html). Sie braucht keinen Server, kein Konto und keine Internetverbindung. Die Datei herunterladen und im Browser öffnen genügt. Man kann sie auch auf einen beliebigen Webserver legen.

## Lizenz

© 2026 Hannes Sander. Mitarbeit: Birgit Lachner.

Die App mit Code, Texten, Symbolen und Aufgaben steht unter **[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.de)** (Namensnennung – Nicht kommerziell – Weitergabe unter gleichen Bedingungen). Du darfst sie nicht kommerziell nutzen, verändern und weitergeben, wenn du Urheber und Lizenz nennst. Veränderte Fassungen musst du unter derselben Lizenz weitergeben.

Diese Bestandteile sind eingebettet und behalten ihre eigenen Lizenzen:

- three.js r128: MIT-Lizenz, © three.js authors
- qrcode-generator: MIT-Lizenz, © Kazuhiko Arase. „QR Code“ ist eine eingetragene Marke von DENSO WAVE INCORPORATED.
- Schriften Atkinson Hyperlegible (© Braille Institute of America) und Lexend (© The Lexend Project Authors): beide SIL Open Font License 1.1

## Unabhängige Neuimplementierung

Die Idee zur Webapp stammt von *3D-Kugelwolkenmodell.exe* der [Didaktik der Chemie der Universität Rostock](https://www.didaktik.chemie.uni-rostock.de/forschung/chemie-fuers-leben-sek-i/das-kugelwolkenmodell/). Die App ist aber eine eigene Neuentwicklung ohne Bestandteile des Originalprogramms. Sie ist keine offizielle Webversion und steht in keiner Verbindung zur Universität Rostock.

## Datenschutz

Die App läuft vollständig im Browser. Es gibt keine Konten, keine Cookies und keine Verbindungen zu Dritten. Fläche, Einstellungen und Aufgaben speichert die App nur lokal im Browser (`localStorage`).

## Entwicklung

- Änderungen: [CHANGELOG.md](CHANGELOG.md)
- Geplante Funktionen: [Entwicklungsplan.md](Entwicklungsplan.md)
- Tests: [tests/README.md](tests/README.md). Sie laufen bei jedem Pull Request automatisch.
- Bilder der Hilfe: [tools/hilfe-bilder.js](tools/hilfe-bilder.js) erzeugt sie neu (siehe tests/README.md).

Beiträge sind willkommen, am besten als Issue oder Pull Request. Mit einem Beitrag stimmst du zu, dass er unter CC BY-NC-SA 4.0 veröffentlicht wird.
