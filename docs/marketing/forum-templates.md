# Forum-Vorlagen: Antworten, die nach Hilfe aussehen

**Stand: 2026-10 · Bezug: elektroplaner-camper.de**

Drei Vorlagen für Antworten in Foren, Gruppen und Frage-Antwort-Seiten. Sie
existieren, weil die häufigsten Fragen im Camper-Ausbau dieselben drei
Ursachen haben — und weil eine Antwort mit nachvollziehbarem Rechenweg mehr
hilft als eine Meinung.

## Die Regeln, die vor allen Vorlagen gelten

1. **Beziehung offenlegen.** Wer für Werft schreibt, schreibt das dazu: ein
   Satz, im ersten Absatz. Beispiel: „Ich arbeite an einem Planungswerkzeug
   für den Camper-Ausbau (werft-camper… ) — deshalb kenne ich die Rechenwege
   gut.“ Kein Link als Erster, kein Link im ersten Satz.
2. **Ein Link je Antwort**, und nur wenn er die Frage beantwortet. Keine
   Linkliste, kein „schau auch hier“.
3. **Keine erfundenen Erfahrungen.** Kein „ich habe das imitiert“, wenn es
   nicht stimmt. Aussagen über Normen nur so weit, wie die eigene Seite sie
   belegt (siehe [Über Werft](/ueber-werft/)): Formel, Annahmen und Grenzen
   nennen, statt „das ist Vorschrift“.
4. **Keine Abkürzungen bei Sicherheitsfragen.** Bei 230 V, FI-Schutz, Absicherung
   und Abnahme: klar sagen, dass das Facharbeit ist und in die Hände einer
   Elektrofachkraft gehört.
5. **Ein Vorschlag, kein Auftrag.** „So würde ich rechnen“ statt „so musst du
   machen“ — die Abmessungen vor Ort kennt nur, wer dort ist.

---

## Vorlage 1 — „Welches Kabel brauche ich für meinen Kühlschrank?“

**Typische Frage:** „Kühlschrank 60 W, Kabel 4 m, welche Stärke?“
**Ziel:** Der Thread-Betreiber soll den Spannungsfall selbst nachrechnen
können — und den Unterschied zwischen „Strom passt“ und „Spannung bleibt
stabil“ verstehen.

> **Antwort (Kühlschrank, 4 m, 12 V)**
>
> Fang beim Strom an, nicht beim Kabel: 60 W an 12 V sind 5 A. Auf 4 m
> Leitungslänge (Hin- und Rückleitung, also 8 m) fordert die Formel
> A = 2 · L · I / (κ · ΔU) bei 3 % zulässigem Spannungsfall rund 1,98 mm² —
> aufgerundet auf die Normreihe sind das 2,5 mm².
>
> Die thermische Seite passt dazu: 2,5 mm² verträgt nach der Tabelle 23 A,
> mit der Planerpauschale von 70 % sind es 16,1 A. 5 A Verbraucher passen
> also; die Sicherung darf 16 A sein, gewählt wird die nächstkleinere
> passende Stufe.
>
> Zwei Dinge dazu, die man leicht übersieht: Die Sicherung gehört an den
> Batteriepol, nicht an den Kühlschrank — sie schützt die Leitung, nicht das
> Gerät. Und: Die Länge verschiebt die Stufe. Auf 2 m oder 3 m reicht
> 1,5 mm², auf 4 m und 5 m sind es 2,5 mm², ab 6 m fordert derselbe
> Verbraucher 4 mm².
>
> (Ich arbeite an einem Planungswerkzeug für den Camper-Ausbau, deshalb
> kenne ich die Rechenwege — der Spannungsfall-Rechner dazu läuft hier:
> /camper-elektrik/kabelquerschnitt/)

**Warum diese Vorlage funktioniert:** Sie beantwortet die Frage vollständig
(Strom, Querschnitt, Sicherung, Ort), nennt die Formel und die Annahme (3 %
auf 12 V) und sagt, wann es anders aussieht. Sie endet mit der Erkenntnis,
dass die Länge den Querschnitt bestimmt — nicht der Verbraucher allein.

---

## Vorlage 2 — „Meine Sicherung ist 30 A, passt das?“

**Typische Frage:** „Ich habe eine 30-A-Sicherung auf einer 2,5-mm²-Leitung.
Ist das okay?“
**Ziel:** Die Kette I_B ≤ I_n ≤ I_z erklären und die Leitung schützen, nicht
das Gerät.

> **Antwort (Sicherung zu groß)**
>
> Nein, das ist die Kombination, die am häufigsten Ärger macht: Eine zu
> große Sicherung macht aus einem Fehler in der Leitung einen Kurzschluss.
> Die Sicherung gehört zur Leitung, nicht zum Verbraucher.
>
> Die Regel ist eine Kette: Der Betriebsstrom (I_B) muss kleiner sein als
> der Nennstrom der Sicherung (I_n), und der Nennstrom der Sicherung muss
> kleiner oder gleich der Belastbarkeit der Leitung (I_z) sein. Für 2,5 mm²
> sind das nach der Belastbarkeitstabelle 23 A, mit der üblichen
> Planerpauschale von 70 % rund 16 A. Eine 30-A-Sicherung passt auf diese
> Leitung nicht — die kleinste Querschnittsstufe, die sie trägt, ist 10 mm²
> (dort sind 32 A zulässig).
>
> Was du prüfen solltest: Steht die Sicherung direkt am Batteriepol? Und
> ist die Leitung zwischen Batterie und erster Verbraucherstelle kurz? Im
> Modell sind das 0,2 m ab der Quelle, weil ein Kurzschluss in diesem
> Abschnitt sonst zu lange steht, bis die Sicherung auslöst.
>
> (Hinweis: Ich arbeite an einem Planungswerkzeug für den Camper-Ausbau;
> die Absicherung ist dort mit Quellen und Grenzen beschrieben:
> /camper-elektrik/sicherungen/)

**Warum diese Vorlage funktioniert:** Sie sagt „nein“ mit Rechnung, nicht mit
Bauchgefühl, und zeigt die Regel, mit der man selbst weiterkommt. Sie nennt
auch die Grenze: 230 V und die Landstromseite bleiben Facharbeit.

---

## Vorlage 3 — „Wie viel Solar brauche ich im Winter?“

**Typische Frage:** „Ich habe 400 Wp auf dem Dach, reicht das im November?“
**Ziel:** Die Frage vom Ertrag wegleiten: Der Winter ist eine Flächen- und
Standortfrage, keine Panel-Frage.

> **Antwort (400 Wp, Winter)**
>
> 400 Wp ist eine Sommerangabe. Für den Winter brauchst du die Fläche, die
> dein Tagesbedarf verlangt — und die ist bei 400 Wp meist nicht da.
>
> So rechnet man es: Tagesbedarf (in Wh) geteilt durch den spezifischen
> Ertrag (kWh je kWp und Tag) ergibt die nötige kWp, mal 1,15 als
> Ladezeit-Aufschlag. Beispiel: 1 000 Wh Bedarf und 3,0 kWh/kWp/Tag führen
> im Sommer auf rund 400 Wp — das ist die Anlage, die du hast, und sie deckt
> den Bedarf im Sommer. Im Winter liegt der Ertrag bei rund 35 % des
> Sommerwerts: Aus denselben 400 Wp werden dann etwa 120 Wp effektiv, und
> die Rechnung fordert rund 1 100 Wp. Das ist mehr Dachfläche, als die
> meisten Fahrzeuge haben.
>
> Heißt: Winterautarkie ist bei Solar kein Panelproblem. Die Wege sind
> Nachladen während der Fahrt, Landstrom am Stellplatz oder weniger
> Verbrauch in der kalten Jahreszeit — die Standheizung ist dabei oft der
> größte Posten, wenn ihr Gebläse stundenlang läuft.
>
> (Ich arbeite an einem Planungswerkzeug für den Camper-Ausbau — der
> Rechner für Sommer und Winter getrennt läuft hier:
> /rechner/solaranlage/)

**Warum diese Vorlage funktioniert:** Sie rechnet mit den Zahlen des
Fragenden weiter, zeigt die Grenze der Fläche und nennt drei Auswege, von
denen zwei nichts mit dem Kauf von Modulen zu tun haben.

---

## Was in diesen Vorlagen nicht steht

- Keine Empfehlung von Marken, Modellen oder Händlern. Die Stückliste der
  Vorlagenseiten nennt Bauteilarten und Mengen, keine Produkte.
- Keine Preise, keine Verfügbarkeitsaussagen.
- Kein „zertifiziert“, „geprüft“ oder „TÜV“ für das Werkzeug. Was Werft
  prüft und was nicht, steht unter [Über Werft](/ueber-werft/).
- Keine Zusagen über die Abnahme durch Behörden oder Prüforganisationen.
