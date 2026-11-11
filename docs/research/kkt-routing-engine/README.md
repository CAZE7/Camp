# KKT-Routing-Engine für 12-V-Bordnetze

Forschungsartefakt zu zwei Teilen. Beide Teile werden von **derselben** Engine gespeist; die
Zahlen in Teil A sind aus dem Lauf von Teil B abgeschrieben (keine hartkodierten Ergebnisse).

| Teil | Datei | Inhalt |
|---|---|---|
| **A** | [`WHITEPAPER.md`](./WHITEPAPER.md) | Mathematische Spezifikation: KKT-Relaxation + duale Koordinaten-Aszension, Branch-and-Bound über $\mathcal{A}_{\text{norm}}$, elektro-thermischer Banach-Fixpunkt mit Kontaktwiderständen und CP-Lasten, Schleifenimpedanz-Tensor mit $I_{k,\max}/I_{k,\min}$, Sicherungs-Eskalation, adiabatische $k^2A^2$- und I²t-Selektivitätskaskade, Sugiyama-/Barycenter-Layout mit Intervallgraph-Kanalrouting — plus durchgerechneter Vergleich „Stamm + vier Zweige“ gegen naive Einzelstrang-Bemessung, Greedy-Reparatur und proportionale Budgetaufteilung. |
| **B** | [`index.html`](./index.html) | Interaktive Referenzimplementierung: **eine** Datei, HTML5 + Tailwind (CDN) + Vanilla ES6+ + SVG, kein Build-Schritt. Lädt beim Start ein mehrstufiges Referenznetz (Batterie → Haupt-Busbar → Sub-Verteiler → Lasten), löst und routet live; zeigt Konvergenz-Iterationen, $U_v$ auf 3 Dezimalen, $Z_{\text{loop}}$ in mΩ, $I_k$ in kA, I²t-Reserve in %, Kupfermasse und Ersparnis. |

## Bedienung

`index.html` direkt im Browser öffnen (Doppelklick genügt, kein Server). Drei Szenarien im
Umschalter: *Kastenwagen · 4-stufig*, *Tiefe Kette · 5 Stufen*, *Papierbeispiel · Stamm + 4
Zweige*. Regler für Spannungsfall-Budget, Umgebungstemperatur, Längen- und Kontaktskalierung
sowie Isolierklasse lösen das Netz neu.

## Nachweisstand

| Prüfung | Ergebnis |
|---|---|
| B&B gegen $12^{m}$-Brute-Force (100 Zufallsnetze) | 100/100 exakt, alle Optima bewiesen |
| KKT-Residuum $c_e a_e^2/(b_e\Lambda_e)$ | $1{,}000$ auf allen Kanten |
| Schattenpreis gegen Finite Differenzen | Abweichung $0{,}26\,\%$ |
| Thermischer Fixpunkt | Restfehler $<10^{-4}$ K, Kontraktion $\approx0{,}30$ |
| Gekoppelte Politur (1-opt **und** 2-opt) | Radius 2 in allen Szenarien erschöpft, 42/42 Läufe im Betriebsbereich zulässig |
| Sicherungskoordination nach Politur | $I_{\mathrm n}\le I_{z,\mathrm{eff}}$ für jede Kante geprüft |
| Geometrie (Kartenkollision, kollineare Überlappung) | 0 / 0 in allen drei Szenarien |
| DOM-Assertions (KPIs, Tabellen, Flags, Status, Konsole) | alle bestanden, 0 Konsolenfehler |

## Deklarationen

Modellwerte, die **nicht** aus einer Norm stammen, sind im UI als `MODEL`/`UNVERIFIED`
markiert und in Teil A §9 aufgeführt (u. a. Belastbarkeit 95/120 mm², Abschaltzeiten $t_{2x}$
der Sicherungsbauformen, I²t-Aufschlag 1,25). Es gibt keine stillen Fallbacks und keine
Platzhalter.
