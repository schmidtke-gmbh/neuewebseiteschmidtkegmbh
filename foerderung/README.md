# Fördercheck-Funnel · schmidtke-gmbh.de/foerderung/ (Unterseite der Hauptseite)

**Regeln für den Text (Stand v8):** Der Fördercheck ist eine eigene Seite `anfragen.html` (Netlify Pretty URL `/foerderung/anfragen`); alle CTA-Buttons der Landingpage sind Links dorthin, UTM-Parameter und fbclid werden per JS an den Link gehängt. Kein „Vertrag“ mehr, sondern „Angebotsabschluss“ (Antrag vor Angebotsabschluss, Angebot annehmen/abschließen). „Beratung“ sparsamer: Zusammenarbeit, Strategie, geförderter Weg, Projekt, Empfehlung. Die „3.500 € förderfähige Beratungskosten“ stehen nirgends mehr auf der Seite (nur intern in `main.js` als `MAX_KOSTEN_NETTO` für die Rechnung); nach außen geht es nur um 50–80 % Zuschuss und bis zu 2.800 € netto je Beratung, kein Eigenanteil. Sie-Form durchgehend (Ausnahme: wörtliche Kundenzitate). Kein „Beratertag“ mehr, sondern „Beratung“ (der Auftraggeber will nicht den Eindruck „ein Tag und fertig“); Kernsatz: „Wir arbeiten mit Ihnen daran, wie Ihr Unternehmen sichtbar wird und planbar Anfragen gewinnt.“ Der Satz „Der Antrag muss vor Vertragsabschluss stehen“ steht nicht mehr im Hero (nur noch in Ablauf und FAQ). Nichts versprechen, was nur im Umsetzungsangebot steckt (kein „wir übernehmen Dreh und Schnitt“, kein „60 Minuten pro Woche“); die Agenturleistungen werden als Kompetenznachweis gezeigt, nicht als Bestandteil der Beratung. Das Wort „BAFA“ darf nirgends auf der Seite stehen (auch nicht im Title, in der Meta-Description oder im FAQ-Schema); stattdessen „Förderstelle“, „staatliche Beratungsförderung“, „der Bund“. Keine Berater-ID. Auf der Startseite steht nicht, welche Regionen 80 % und welche 50 % bekommen, nur „bis zu 80 %, je nach Standort“; den Satz zeigt erst der Fördercheck. Wiederkehrender Aufhänger: „Sind Sie förderfähig?“

Handcodierte Einzelseite mit Fragebogen, Rechenschritt, unscharfem Ergebnis, Netlify-Formular und Cal.com-Kalender. Kein Framework, kein Build.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Landingpage. Alle „Jetzt Förderfähigkeit prüfen“-Buttons sind Links auf `anfragen.html`. |
| `anfragen.html` | Fördercheck als eigene Seite: Fragebogen, Rechenschritt, unscharfes Ergebnis, Lead-Formular, Rückruf-Zweitformular, Cal.com. Alle Formularfelder statisch, damit Netlify Forms sie kennt. Schließen-Kreuz führt zurück auf die Landingpage, Escape ist dort abgeschaltet. `main.js` erkennt die Seite an `data-standalone` und startet den Check sofort. |
| `assets/css/style.css` | Stylesheet. CI ausschließlich im `:root`-Block. |
| `assets/js/main.js` | Animationen, Fragebogen, Rechenlogik, Rechenschritt, Formular per `fetch`, Kalender, Tracking. Konfiguration oben im `CONFIG`-Block. |
| `assets/img/` | Bilder (WebP): Sektion „Staatlich gefördert“ mit `illu-telefon` (Erstgespräch), `illu-siegel` (Zugelassener Berater, Band in Schwarz-Rot-Gold), `illu-schild` (Geprüfte Qualität), `illu-karte` (Deutschlandweit), `illu-2016` (Seit 2016), dazu Foto-Motiv für die Bildsektion, Münzen (breit + Stapel), Dokument, Uhr, Werkstatt, `hero-bg.webp` (Poster) sowie die vier Themen-Illustrationen `illu-ziel`, `illu-content`, `illu-webseite`, `illu-ki` (Zielscheibe, Smartphone mit Play-Button, Browser mit Umschlag, KI-Würfel). Erzeugt mit Higgsfield (GPT Image 2.5, transparenter Hintergrund) in Weiß/Navy/Rot/Gold. |
| `assets/img/hero-loop.mp4`, `hero-loop-sm.mp4` | Motiongrafik für den Hero (Higgsfield Kling 3.0 aus dem Hero-Bild, mit ffmpeg zum nahtlosen Vor-und-zurück-Loop geschnitten, 13 s, 1280 px ≈ 2 MB und 854 px ≈ 1 MB). JS wählt die kleine Datei bis 640 px Breite; ohne JS oder bei `prefers-reduced-motion` bleibt das Poster stehen. |
| `assets/beratung-loop.mp4`, `beratung-loop-sm.mp4`, `beratung-poster.jpg` | Stummer 10-s-Loop aus dem Hero der Hauptseite (`assets/cta-hintergrund.mp4`), mit ffmpeg ohne Tonspur auf 1280 px (1,3 MB) und 960 px (0,7 MB) gerechnet; läuft in „Die Beratung“ statt des Bürofotos, wird erst geladen, wenn die Sektion in Sicht kommt (`.lazy-video` in main.js), kleine Datei bis 640 px Breite, bei `prefers-reduced-motion` bleibt das Poster. |
| `assets/logos/` | Die 20 Kundenlogos (Kopie aus `/assets/logos/` der Hauptseite) für Laufband und Logo-Raster. `hellriegel.svg` hat hier eine breitere viewBox, damit der Schriftzug nicht abgeschnitten wird. |
| `assets/kunden/`, `assets/*.jpg`, `assets/deutschland-karte.svg` | Kundenfotos (Barwig, Zotzmann, Börner, Fischer, Vogt, Rossegger, Curator, Emrich, Just Brides, Bentivegna, Hellriegel, alesi), Agenturfotos (Fabian am Podcast-Mikro, Studio, Dreh, Büro, Gebäude) und die Deutschlandkarte, Kopien von der Hauptseite. Nicht mehr verwendet, können gelöscht werden: `fabian-profil.jpg`, `jasmin-profil.jpg`, `team-kamera-check.jpg`. |
| `assets/js/agenturmarkt-responsive.js` | Kopie des Widget-Laders der Hauptseite: lädt auf dem Desktop das echte AgenturMarkt-Widget (`widget.trustmarkt.de`), zeigt auf dem Handy oder wenn das Widget nach 6 s nicht erscheint eine statische Score-Karte (4,9 · 76 Bewertungen). |
| Zweitformular `foerdercheck-rueckruf` | Statisch im Markup (versteckt), wird per `fetch` abgeschickt, wenn jemand „Lieber Rückruf“ wählt. |
| `../robots.txt` | Sperrt `/foerderung/` und `/danke` (neu angelegt, lag vorher nicht im Deploy-Ordner) |

Alle Bild- und Logopfade sind relativ (`assets/…`), der Ordner ist damit in sich geschlossen; nur `/favicon.svg` kommt vom Wurzelverzeichnis der Hauptseite.

## Sektionen (Reihenfolge)

Nav-Pille · Hero (Positionierung „Unternehmensberatung für Marketing & Digitalisierung“, H1 „Bis zu 80 % Zuschuss für Ihre Marketingberatung. Sind Sie förderfähig?“, animiertes Datums-Badge „Programm läuft bis 31.12.2026 · noch X Tage“ mit Countdown, Video-Hintergrund) · Logo-Laufband · **Staatlich gefördert** („Sie zahlen nur 20–50 % der Beratungskosten“, drei Schritte Erstgespräch / Antrag stellen / Geld zurück, fünf Vertrauensmerkmale inkl. Google-Partner-Badge von gstatic mit „G“-Fallback) · Für wen (Bento) · **Ergebnisse** (vier Beratungsthemen mit 3D-Illustrationen, drei große Fallstudien, drei kompakte Fallstudien: Sportakademie Chemnitz/Torsten Fischer mit Badge „Beratung mit bis zu 80 % Zuschuss genutzt“, Sportakademie Vogt, Rossegger, dazu die Kunden-Galerie „100+ Unternehmen … Ein paar Einblicke“ von der Hauptseite) · Ablauf · **Die Beratung** (was gefördert wird, sechs Bausteine) · **Warum die Schmidtke GmbH** (Kompetenznachweis: eigenes Studio, Zahlen, alle Bausteine, Beispiel-Monatsbericht) · **Über uns** (Agentur, Rottweil, DACH-Karte mit Pins, „Was wir für unsere Kunden umsetzen“) · Bild-CTA · Kunden-Logos (20 Logos im Raster) · **Ihr Berater** (nur Fabian, mit Werdegang) · **Bewertungen** (AgenturMarkt-Widget + Zeile 4,9 von 5 · 76 Bewertungen, sechs Sterne-Karten, drei Stimmen aus den Fallstudien) · FAQ · Abschluss · Footer · Sticky-CTA.

Das Datums-Badge rechnet die Resttage bis 31.12.2026 im Browser aus (`main.js`, Block „Countdown“) und zählt beim Laden herunter.

## Aufbau und Animationen (Vorlage: foerderung.de, vermessen per getComputedStyle)

Typo- und Abstandstokens (`:root` in style.css, abgeglichen mit foerderung.de bei 1440 px am 23.09.2026): H1 68 px, H2 56 px (Vorlage 56, Gewicht 600 dort / 700 bei uns, SK Modernist hat nur 400/700), Sektions-Sub 18 px / 1,55 / max. 660 px, Eyebrow 14 px Versalien, Sektionsabstand `clamp(64px, 6.25vw, 90px)` (Vorlage 72–81 px), Kartentitel `--card-title` 20 px, Kartentext `--card-text` 15 px, Zwischenüberschriften `--sub-title` 24–30 px, Kartenpolster `--card-pad` 28 px, Rasterabstand `--grid-gap` 20 px, Blockabstand `--block-gap` 40–64 px, Radien 20 px Karten / 14 px Kacheln / 44 px Hero. Neue Sektionen immer über diese Tokens bauen, keine Einzelwerte.

- Schwebende Nav-Pille (fixed, 62 px, radius 999), Hero als große abgerundete Karte (44 px), Sektionen mit 72–130 px Luft, Karten 20 px Radius ohne Schatten, Buttons als Pille 52–56 px mit Pfeil.
- Überschriften: `data-anim="words"` → jedes Wort wird per JS in `<span class="w">` gesetzt und blendet mit Blur 10 px → 0, 0,25 em Versatz, 600 ms, 60 ms Stagger ein.
- Blöcke: `data-anim="up"` (20 px, 600 ms), Karten: `data-anim="card"` bzw. `data-anim-group="card"` (20 px + scale .93, Feder-Kurve, 90 ms Stagger).
- Grundverzögerung 300 ms nach Eintritt in den Viewport, optional `data-delay`. Illustrationen schweben (`.float`), Bilder mit `data-parallax` bewegen sich leicht mit dem Scroll, Logo-Laufband 40 s.
- Alle Mockups (Browserfenster, Ergebniskarten, Statusliste) sind HTML/CSS, keine Bilder.
- `prefers-reduced-motion` schaltet alles ab.

## Rechenlogik (Förderrichtlinie 14.12.2022, geändert 12.12.2024)

- 3.500 € förderfähige Kosten netto je Beratung (nur intern, steht nicht auf der Seite)
- 80 %: Brandenburg, Mecklenburg-Vorpommern, Sachsen-Anhalt, Thüringen, Sachsen ohne Region Leipzig, Landkreis Lüneburg, Region Trier
- 50 %: alle übrigen inkl. Berlin und Region Leipzig
- KMU: unter 250 Mitarbeiter und höchstens 50 Mio. € Umsatz
- Ausschluss: Branchen „Coach / Trainer“, „Berater / Consultant“ und „Anwalt / Steuerberater“ (je eigene Begründung, bei Coaches/Beratern zusätzlich der Hinweis, dass wir viele solcher Anfragen bekommen und die Richtlinie das ausschließt), 250+ Mitarbeiter, über 50 Mio. € → sofortiges Ergebnis ohne Formular
- Zusatzprogramm **Zukunft Handel 2030** (Land Baden-Württemberg): Bundesland Baden-Württemberg + Branche „Einzelhandel (Ladengeschäft)“ → im Rechenschritt erscheint die Zeile „Landesprogramm wird geprüft“, im (unscharfen) Ergebnis die grüne Karte „Intensivberatung im Wert von bis zu 12.000 €, 6–15 Beratungstage, 297 € netto Eigenanteil je Tag, bis 31.12.2026“, im Lead das Feld `handel2030=ja`. Quellen: wm.baden-wuerttemberg.de (Förderaufruf, Zuschuss 70 %, Tagessatz bis 800 €, Laufzeit bis 31.12.2026) und Anbieterseiten (297 € Eigenanteil je Tagewerk, 6–15 Tagewerke). Die Schmidtke GmbH ist im Programm zugelassen (bestätigt 23.09.2026). Das Programm darf nicht auf der Landingpage erscheinen, nur im Ergebnis des Förderchecks.
- Branchen-Frage mit zwölf Kacheln (A–L), jede Kachel hat ein Buchstaben-Badge; der Buchstabe auf der Tastatur wählt die Kachel (gilt in allen Frageschritten, A–P)
- „Drei- oder öfter“ bei Vorförderung → Hinweis auf Kontingent (5 bis 31.12.2026, 2 pro Jahr), kein Ausschluss

## Konfiguration (`main.js`, Block `CONFIG`)

| Schlüssel | Aktuell |
|---|---|
| `calLink` | `schmidtke-gmbh/20-minuten-gesprach-am-telefon` |
| `calPhoneField` | `attendeePhoneNumber` – Slug des Telefonfelds im Cal.com-Event. Fehlt das Feld, verfällt die Nummer stillschweigend. |
| `dankeUrl` | `https://schmidtke-gmbh.de/danke?von=foerdercheck` – Weiterleitung 2,5 s nach erkannter Buchung |
| Telefonnummer | `0741 94213040` (im HTML unter dem Kalender) |

## Tracking (`dataLayer`, Feld `funnel: 'foerdercheck'`)

`funnel_step` (step 1–6) · `check_completed` (quote, foerderfaehig) · `lead_submitted` (quote) · `call_booked`.
Vibetrack-Tracker und Cookie-Banner wie auf der Hauptseite eingebunden. UTM-Parameter, `fbclid`, `gclid`, Landingpage und Referrer gehen als versteckte Felder in den Lead.

## Ergebnisseite und Senden

- Nach „Ergebnis anzeigen“ wird der Lead per `fetch` als `x-www-form-urlencoded` an `/` geschickt (Netlify-Konvention), bei Fehler noch einmal an die eigene Adresse. Schlägt beides fehl oder dauert es länger als 6 s, wird das Ergebnis trotzdem freigeschaltet und ein Hinweis eingeblendet; Termin und Rückruf fangen den Kontakt dann auf. Auf `localhost`/`file://` wird nichts gesendet (Testmodus).
- Unter dem Ergebnis: Rechenweg (3.500 € × Satz = Zuschuss, Eigenanteil, × 2 pro Jahr), passende Fallstudie, dann „Wie geht es weiter?“ mit zwei Wegen: **Termin direkt wählen** (Cal.com inline) oder **Lieber Rückruf** (schickt das Zweitformular, bestätigt „Wir melden uns in den nächsten Tagen“).
- Rechenschritt: sechs Zeilen (Standort, Fördersatz, Größe, Branche, Kontingent, Zuschuss) mit Prozentanzeige und Fortschrittsbalken, rund 4 Sekunden. Die echten Zahlen bleiben dabei verdeckt (`•• %`, `•.••• €`), damit das Ergebnis erst nach dem Formular sichtbar wird.

## Netlify Forms

Formularnamen `foerdercheck` und `foerdercheck-rueckruf`. Felder: name, firma, email, telefon, datenschutz, bundesland, region, mitarbeiter, umsatz, branche, vorfoerderung, anliegen, quote, zuschuss_je_beratung, handel2030, utm_*, fbclid, gclid, landing_page, referrer, submitted_at.
Benachrichtigung in Netlify unter Forms → Notifications einrichten.

## Vor dem Livegang (Kundenseite)

1. **Cal.com-Event:** Telefonnummer als erstes Zusatzfeld anlegen, Slug in `calPhoneField` eintragen (oder Standardfeld „Telefon“ aktivieren → `attendeePhoneNumber`).
2. **Danke-Seite `/danke`:** zeigt aktuell selbst einen Cal.com-Kalender. Für Besucher aus dem Fördercheck (Parameter `?von=foerdercheck`) den Kalender ausblenden, sonst wird doppelt gebucht.
3. **Netlify Forms:** nach dem ersten Deploy unter Forms prüfen, dass `foerdercheck` und `foerdercheck-rueckruf` erkannt wurden, und die E-Mail-Benachrichtigung einrichten. Wenn „Das Senden hat nicht geklappt“ erscheint, war das Formular beim Deploy nicht erkannt (Forms-Erkennung im Netlify-Projekt aktivieren) oder die Seite lief lokal.
4. **Datenschutzerklärung:** Netlify Forms und Cal.com sind dort schon relevant, prüfen ob beide genannt sind.
5. **Fallstudienzahlen** (Barwig, Zotzmann, Börner) sind die von der Hauptseite; Freigabe der Kunden für diese Verwendung sicherstellen.
6. **Bewertungen:** Die sechs Sterne-Karten sind von agenturmarkt.de (Profil Schmidtke GmbH) übernommen, Namen, Quelle und Monat stehen dabei. Gesamtwert „4,9 von 5 · 76 Bewertungen“ ist der Stand beim Einbau und muss bei Änderung im HTML (`#kundenstimmen`, `.rating-line`) angepasst werden.
7. **Sitemap:** im Deploy-Ordner gibt es keine; falls eine angelegt wird, `/foerderung/` nicht aufnehmen.

## Test

Geprüft (Playwright, Chromium): Pfade Thüringen · Sachsen mit Leipzig · Sachsen ohne Leipzig · Baden-Württemberg · Ausschluss Berater · Ausschluss Coach · Ausschluss Anwalt · Ausschluss 250+ · Tastaturwahl · Baden-Württemberg + Einzelhandel (Handel-2030-Karte, Feld handel2030=ja); Fehlerwege (leer, falsche E-Mail, fehlender Datenschutzhaken, Haken danach sichtbar, rote Markierung weg); Zahlen vor und nach dem Freischalten identisch; keine JS-Fehler; kein waagerechtes Scrollen bei 390/900/1440 px; Kalender-Fallback bei blockiertem Cal.com-Skript.

Beim lokalen Testen einer CSS-Änderung hart neu laden (Cmd + Shift + R).
