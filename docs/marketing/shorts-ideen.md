# Fünf Shorts/Reels: Einstieg, Rechnung, Quelle

**Stand: 2026-10 · Bezug: elektroplaner-camper.de**

Fünf Kurzvideo-Ideen für Shorts, Reels und TikTok. Jede Idee hat denselben
Aufbau: **Hook (die Behauptung) → Rechnung (der Beleg) → Grenze (was nicht
behauptet wird) → Ziel (eine Seite, auf der man nachrechnen kann)**. Das ist
der Ton der Seiten — und er funktioniert auch in 45 Sekunden.

## Die Regeln für alle Clips

1. **Jede Zahl aus dem Modell.** Kein gerundetes Bauchgefühl, keine Zahl aus
   dem Gedächtnis. Jede Behauptung lässt sich auf der verlinkten Seite
   nachrechnen — die Zahlen stehen dort im selben Format, in dem sie im Clip
   vorkommen.
2. **Die Annahme mitnennen.** „3 % Spannungsfall auf 12 V“, „35 % Winterertrag“,
   „90 % Entladetiefe bei LiFePO4“. Eine Zahl ohne Annahme ist eine
   Scheingenauigkeit.
3. **Kein Norm-Kitsch.** „Nach DIN VDE ist …“ nur, wenn die Seite die
   Quelle nennt — und dann so, wie sie dort steht: Verlegeart, Temperatur,
   belastete Adern. Kein „VDE-konform“ als Abkürzung für „ich habe es nicht
   nachgelesen“.
4. **Die Grenze im Clip.** Jeder Clip endet mit dem, was er nicht zeigt:
   „ohne Längenberechnung ist das nur eine Größenordnung“, „im Winter ist das
   eine Flächenfrage“.
5. **Keine Panikmache, keine Verheißung.** Die Fehler, die der Clip zeigt,
   sind reale Fehler — aber kein Mensch wird für Fehler bestraft, die er nicht
   kennen konnte.
6. **Kein Nutzer-Shaming.** Kein „typischer Fehler von Anfängern“ im Titel.

---

## Clip 1 — „Dein 2,5-mm²-Kabel ist zu dünn“

**Hook (0–3 s):** „Dein 2,5-mm²-Kabel ist zu dünn — und du merkst es erst,
wenn die Kaffeemaschine einbricht.“

**Rechnung (3–25 s):** 2 000 W Wechselrichter am 12-V-Botnetz: 2 000 W ÷ 12 V
= 166,7 A. Die Spannungsformel fordert auf 1,5 m Leitungslänge bei 3 %
zulässigem Spannungsfall 2 · 1,5 · 166,7 / (56 · 0,36) ≈ 24,8 mm², auf 3 m
sind es 49,6 mm². Die Thermik ist der härtere Teil: Die größte Normgröße der
Tabelle (70 mm²) trägt mit der Planerpauschale von 70 % noch 120,4 A — der
Strom liegt darüber. Der Planer antwortet darum mit „außerhalb der
hinterlegten Belastbarkeitstabelle“ und nennt 70 mm² als Grenze, nicht als
Lösung.

**Grenze (25–35 s):** „Am 24-V-Bordnetz sind es 83,3 A, und dieselbe Rechnung
kommt mit 50 mm² aus. Die Bordnetzspannung ist der größte Hebel, den du nicht
kaufen musst — und die ehrlichere Antwort lautet: 2 kW gehören an 24 V.“

**Ziel (35–45 s):** Wechselrichter-Seite — dort stehen Formel, Annahmen und
die Stückliste: /camper-elektrik/wechselrichter/

**Aufbau:** Bildschirmaufnahme des Rechners, Zahl für Zahl eingeblendet. Kein
B-roll von Kabelrollen.

---

## Clip 2 — „Trennrelais plus LiFePO4: der Fehler, den keiner sieht“

**Hook (0–3 s):** „LiFePO4 mit Trennrelais ist fast richtig — fast.“

**Rechnung (3–25 s):** Das Trennrelais trennt die Verbraucher, die Aufbaubatterie
hängt aber weiter am Starterkreis: Jede Laterne am Starterbatterie-Kreis
belastet die Ladeleitung des Relais und damit die Aufbaubatterie mit. Im Modell
rechnet das mit 12,8 V Systemspannung und dem Entladefaktor 0,9375 (12,8 V →
12,0 V); bei 25 A Dauerstrom sinkt die nutzbare Kapazität zusätzlich um den
Peukert-Faktor 0,955 (LiFePO4). Aus 200 Ah werden so 171,9 Ah nutzbar.

**Grenze (25–35 s):** „Das sind Modellwerte, keine Messwerte deiner Bank. Trag
das Datenblatt deiner Batterie ein — dann stimmt die Rechnung für dein
Fahrzeug.“

**Ziel (35–45 s):** Batterie-Seite — Entladetiefe, Peukert, Trennrelais:
/camper-elektrik/batterie/

---

## Clip 3 — „400 W Solar auf dem Dach ≠ 400 W im November“

**Hook (0–3 s):** „400 W Solar auf dem Dach sind nicht 400 W im November.“

**Rechnung (3–25 s):** Sommer: 1 000 Wh Tagesbedarf, 3,0 kWh/kWp/Tag Ertrag,
Ladezeit-Aufschlag 1,15 → rund 400 Wp nötig. Winter: der Ertragsfaktor 0,35
aus dem Modell → rund 1 100 Wp nötig. Aus 400 Wp werden effektiv 140 Wp.

**Grenze (25–35 s):** „Der Winterfaktor ist ein Modellwert, keine Prognose für
deinen Standort. Er zeigt die Größenordnung — und dass du die Fläche nicht
kaufst, sondern nachladen musst.“

**Ziel (35–45 s):** Solaranlage-Rechner — Sommer und Winter getrennt:
/rechner/solaranlage/

---

## Clip 4 — „Die Sicherung schützt die Leitung. Nicht das Gerät.“

**Hook (0–3 s):** „Die Sicherung schützt die Leitung — nicht deinen Kühlschrank.“

**Rechnung (3–25 s):** Kette I_B ≤ I_n ≤ I_z: 1,5 mm² verträgt 16,5 A, mit der
Planerpauschale 70 % sind es 11,5 A. Eine 16-A-Sicherung passt. Eine
25-A-Sicherung passt nicht — sie gehört auf 4 mm². Und: Das Schutzorgan sitzt
am Batteriepol, im Modell 0,2 m ab der Quelle.

**Grenze (25–35 s):** „Zu kleine Sicherung: das Gerät startet nicht. Zu große
Sicherung: aus einem Fehler wird ein Kurzschluss. Die Leitung entscheidet,
nicht das Gerät.“

**Ziel (35–45 s):** Sicherungen-Seite — Bauformen, Nennströme, die Kette:
/camper-elektrik/sicherungen/

---

## Clip 5 — „2 kW Heizung gekauft — und trotzdem friert ihr?“

**Hook (0–3 s):** „Ihr habt 2 kW Heizung gekauft und friert trotzdem. Die
Heizung ist nicht das Problem.“

**Rechnung (3–25 s):** Der Heizlast-Rechner rechnet die Wärmeverluste über die
Hülle (U-Wert je Bauteil × Fläche × Temperaturdifferenz) und die Luft (Volumen
× 0,34 Wh/(m³·K) × Luftwechsel) — beim Beispiel Ducato L1H1 mit 19 mm Dämmung,
70 % Füllgrad, 1,5 m² Fenster und 20 °C innen gegen −10 °C außen rund 2,1 kW
ohne Schnellheizung, mit Faktor 1,3 rund 2,7 kW. Ungedämmt sind es gut 4,3 kW.

**Grenze (25–35 s):** „Das Modell kennt nicht deine Heizung, ihre Leistungsaufnahme
und die Wärmeverluste über die Lüftung. Es rechnet die Hülle — der Rest bleibt
deine Erfahrung.“

**Ziel (35–45 s):** Heizlast-Rechner — Eingaben, Formel und Grenzen:
/tools/heizung/

---

## Produktion

- **Format:** 9:16, 30–60 Sekunden, ein Punkt pro Clip.
- **Ton:** ruhig, rechnend. Kein Verkaufsdruck — der Nutzer soll die Zahl
  verstehen, nicht die Marke.
- **Bildschirmaufnahmen:** aus den Rechnern der Auslieferung. Jede Zahl im
  Clip ist dort eingeblendet und damit nachprüfbar.
- **Ein Link je Clip**, im Beschreibungstext, mit dem Seitenpfad — kein
  Tracking-Parameter-Krempel, keine Linklisten.
- **Transparenz:** Im ersten Kommentar steht, dass Werft das Werkzeug
  entwickelt. Das ist dieselbe Regel wie in den Forum-Vorlagen.
