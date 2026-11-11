# Kupfermasse, Kopplung und Selektivität

## Mathematische Spezifikation einer KKT-optimalen Querschnittsbemessung mit elektro-thermischem Fixpunkt, Kurzschluss-/I²t-Kaskade und orthogonalem E-CAD-Routing für 12-V-Bordnetze

**Teil A der Arbeit — Referenzimplementierung: [`index.html`](./index.html)**

**Status:** verifiziert · Build `2026-11-11` · Branch `arena/bbf610a1-camp`

---

## Abstract

Die Bemessung eines 12-V-Bordnetzes ist kein eindimensionales Tabellenproblem. Vier Phänomene
sind simultan wirksam und **nicht** separierbar:

1. **Kupfermasse** wächst linear mit dem Querschnitt, der Spannungsabfall fällt hyperbolisch —
   die Optimierung ist konvex, aber über eine **nicht-konvexe, diskrete** Normreihe zu projizieren.
2. **Leitungswiderstand** ist temperaturabhängig, die Temperatur hängt vom Strom ab, der Strom
   hängt über leistungskonstante Lasten von der Spannung ab, die Spannung hängt vom Widerstand ab:
   ein **gekoppelter Fixpunkt** aus zwei nichtlinearen Gleichungssystemen.
3. **Kurzschluss- und Schutzdimensionierung** verlangen eine gegenläufige Bewertung: kleine
   Querschnitte senken die Masse, erhöhen aber den Spannungsfall, die Verlustleistung und die
   thermische Belastung im Fehlerfall.
4. **Topologie** (Baum, Trunk, Zweige) bestimmt, welche Kanten die Masse tragen: der Trunk wird
   von **allen** Lastströmen durchflossen, ein Zweig nur von seiner eigenen.

Diese Arbeit spezifiziert ein vierstufiges Verfahren, das die vier Phänomene in einer
**hierarchisch verschachtelten Fixpunkt-Iteration** behandelt und für jede Stufe einen eigenen
Gültigkeitsnachweis führt:

| Säule | Gegenstand | Mathematischer Kern | Nachweis |
|---|---|---|---|
| **1** | Querschnittsoptimierung | konvexe Relaxation, KKT-System, duale Koordinaten-Aszension, Branch-and-Bound über $\mathcal{A}_{\text{norm}}$ | 100/100 Zufallsnetze gegen $12^{m}$-Brute-Force exakt |
| **2** | Elektro-Thermik | Banach-Fixpunkt $T \mapsto \Phi(T)$, Newton-/MNA-Innenschritt, Kontaktwiderstände, CP-Lasten | Kontraktionsfaktor $\approx 0{,}30$, Restfehler $<10^{-4}$ K |
| **3** | Schutz | Schleifenimpedanz-Tensor, $I_{k,\max}/I_{k,\min}$, Sicherungs-Eskalation, adiabatische $k^2A^2$-Bedingung, I²t-Selektivitätskaskade | Residuum $c_eA_e^2/(b_e\Lambda_e)=1{,}000$, Schattenpreis gegen Finite Differenzen |
| **4** | Layout | planare Ebenenordnung durch DFS-Intervallschlüssel, VCG-Kanalrouting, Zwei-Pass-Höhenlayout | 0 Kreuzungen in 3/3 Referenznetzen und 144/144 Zufallsbäumen; $T=\omega$ (beweisbar spurenminimal) |

Kernaussage: **Die diskrete B&B-Lösung des linearisierten Problems ist am gekoppelten Modell
nicht ohne Nachbesserung zulässig.** Der äußere Fixpunkt muß Querschnitte anheben
(Temperaturrückkopplung), und eine anschließende *Politur* mit exakter Verifikation senkt die
Masse wieder, bis keine zulässige Einzelschritt-Reduktion mehr existiert. Der Preis der
Kopplung ist meßbar: $+17{,}6\,\%$ gegenüber dem B&B-Optimum bei eingefrorenen Temperaturen
(Kastenwagen), $+8{,}3\,\%$ im Papierbeispiel. Diese Zahl ist **kein** Solver-Fehler, sondern
der physikalische Preis der Selbstaufheizung — sie wird in §6.6 explizit ausgewiesen und nicht
wegdefiniert.

---

## 1 Modell und Nomenklatur

### 1.1 Netz, Baumstruktur, Notation

Das Bordnetz sei ein zusammenhängender, gerichteter Baum
$\mathcal{N}=(\mathcal{V},\mathcal{E})$ mit Wurzel $r\in\mathcal{V}$ (Batteriepol) und
Kantenmenge $\mathcal{E}$, $|\mathcal{E}|=m$, $|\mathcal{V}|=n$. Jede Kante $e=(u\to v)$ hat
Länge $l_e>0$ (einfache Strecke in Metern; der Stromkreis benötigt Hin- und Rückleiter), einen
Querschnitt $a_e$ und einen Bündelfaktor $n_e\in\mathbb{N}$ (Anzahl parallel geführter Leiter
gleichen Querschnitts).

Für jeden Knoten $v$ sei $P(v)\subseteq\mathcal{E}$ der eindeutige Wurzelpfad
$r\rightsquigarrow v$. Die **Blätter** $\mathcal{S}\subseteq\mathcal{V}$ seien die Knoten mit
Last; sie definieren die Nebenbedingungen. Der Trunk ist $P(v)\cap P(w)$ für alle Blätter, d.h.
die Kanten mit Vielfachheit $>1$ in der Pfadfamilie.

Für eine Kante $e$ definieren wir die **Pfad-Vielfachheit**

$$
\Lambda_e \;=\; \sum_{v\in\mathcal{S}} \lambda_v \,\mathbb{1}\!\left[e\in P(v)\right],
\qquad \lambda_v\ge 0 ,
$$

wobei $\lambda_v$ der KKT-Multiplikator der Spannungsfall-Restriktion des Blattes $v$ ist
(§2.3). $\Lambda_e$ ist das mathematische Maß dafür, „wie oft“ eine Kante zur Versorgung
beiträgt — die zentrale Größe für die Massenverteilung.

### 1.2 Lastmodell und Batterie

**Batterie.** Norton-Äquivalent mit Quellenspannung $U_{\mathrm{oc}}$, Innenwiderstand
$R_i$ und Shunt $R_{\mathrm{sh}}$:

$$
I_r=\frac{U_{\mathrm{oc}}-u_r}{R_i+R_{\mathrm{sh}}},
\qquad
G_{rr}\mathrel{+}=\frac{1}{R_i+R_{\mathrm{sh}}},
\quad
b_r\mathrel{+}=\frac{U_{\mathrm{oc}}}{R_i+R_{\mathrm{sh}}} .
$$

**Lasten.** Zwei Modelle, beide implementiert:

* **CC** (constant current): $I_v=P_v/(\eta_v U_{\mathrm{nom}})$ mit $U_{\mathrm{nom}}=12$ V.
* **CP** (constant power): $I_v=P_v/(\eta_v\,\tilde u_v)$ mit $\tilde u_v=\max(u_v,0{,}5\,\mathrm{V})$.

Im MNA-System wird CP als spannungsabhängige Konduktanz $g_v=I_v/\tilde u_v=P_v/(\eta_v\tilde u_v^2)$
eingebracht; das ist die Standard-DC-Power-Flow-Linearisierung und wird in §3.1 als
Fixpunktiteration gerechtfertigt.

### 1.3 Normreihe und Belastbarkeit

$$
\mathcal{A}_{\text{norm}}=\{1{,}5,\,2{,}5,\,4,\,6,\,10,\,16,\,25,\,35,\,50,\,70,\,95,\,120\}\ \mathrm{mm}^2 .
$$

Belastbarkeit $I_z(a)$ aus der VDE-Tabelle (10 verifizierte Werte $1{,}5\ldots70\,\mathrm{mm}^2$;
$95$ und $120\,\mathrm{mm}^2$ sind **Modellwerte** und im UI als `MODEL` markiert). Effektive
Belastbarkeit:

$$
I_{z,\mathrm{eff}}(a,e)=I_z(a)\cdot f_H(n_e)\cdot f_T(\vartheta_{\mathrm{amb}},\text{Isolation}),
$$

mit Bündelfaktoren $f_H\in\{1{,}0;0{,}8;0{,}7;0{,}65;0{,}6;0{,}57;0{,}54;0{,}52;0{,}5\}$ und

$$
f_T=\sqrt{\frac{T_{\max}-\vartheta_{\mathrm{amb}}}{T_{\max}-30\,^\circ\mathrm{C}}},
\qquad
T_{\max}=\begin{cases}70\,^\circ\mathrm{C}&\text{PVC}\\90\,^\circ\mathrm{C}&\text{XLPE}\end{cases}.
$$

### 1.4 Konstanten

| Größe | Symbol | Wert | Quelle |
|---|---|---|---|
| spez. Widerstand Kupfer | $\rho_{20}$ | $0{,}0175\ \Omega\,\mathrm{mm}^2/\mathrm{m}$ | `lib/materials.ts` |
| Leitfähigkeit | $\kappa_{20}=1/\rho_{20}$ | $57{,}143\ \mathrm{m}/(\Omega\,\mathrm{mm}^2)$ | abgeleitet (Repo nutzt gerundet $58$) |
| Temperaturkoeffizient | $\alpha_{20}$ | $3{,}93\cdot10^{-3}\ \mathrm{K}^{-1}$ | `lib/materials.ts` |
| Dichte Kupfer | $\delta_{\mathrm{Cu}}$ | $8{,}96\ \mathrm{g}/\mathrm{cm}^3$ | `lib/materials.ts` |
| Bezugstemperatur Belastbarkeit | $T_{\mathrm{ref}}$ | $30\,^\circ\mathrm{C}$ | VDE-Tabellenfußnote |
| Adiabatische Konstante | $k$ | $115$ (PVC) / $143$ (XLPE) $\mathrm{A}\sqrt{\mathrm{s}}/\mathrm{mm}^2$ | `lib/shortCircuit.ts` |

**Masserechnung.** Mit $l_e$ in Metern und $a_e$ in $\mathrm{mm}^2$:

$$
m_e \;=\; 2\,l_e\,a_e\,\delta_{\mathrm{Cu}} \quad [\mathrm{g}],
\qquad
c_e \;:=\; 2\,l_e\,\delta_{\mathrm{Cu}} \quad [\mathrm{g}/\mathrm{mm}^2],
$$

denn $2\,l_e\,[m]\cdot10^{3}\,\mathrm{mm/m}\cdot a_e\,[\mathrm{mm}^2]\cdot 8{,}96\cdot10^{-3}\,\mathrm{g/mm}^3
= 2\,l_e\,a_e\cdot 8{,}96\ \mathrm{g}$.

**Widerstand.** Hin- und Rückleiter:

$$
R_e(T_e)=\frac{2\,\rho_{20}\,l_e\,(1+\alpha_{20}(T_e-20\,^\circ\mathrm{C}))}{a_e}\;+\;R_{c,e},
$$

mit dem Kontaktwiderstand $R_{c,e}=(R_{\mathrm{contact}}(u)+R_{\mathrm{contact}}(v))/1000$ in $\Omega$.

---

## 2 Säule 1 — KKT-Querschnittsoptimierung und diskretes Branch-and-Bound

### 2.1 Problemformulierung

Bei **festen** Strömen $I_e$ und **festen** Temperaturen $T_e$ ist der Spannungsabfall auf dem
Pfad $P(v)$ linear in $1/a_e$:

$$
\Delta U_v(a)\;=\;\sum_{e\in P(v)} I_e R_e(a_e)
\;=\;\sum_{e\in P(v)} \underbrace{\frac{2\,l_e\,I_e\,(1+\alpha_{20}(T_e-20\,^\circ\mathrm{C}))}{\kappa_{20}}}_{=:\,b_e}\; \frac{1}{a_e}
\;+\;\underbrace{\sum_{e\in P(v)} I_e R_{c,e}}_{=:\,\Delta U^{\mathrm{c}}_v}.
$$

Mit dem zulässigen Gesamtabfall $\Delta U_{\mathrm{zul}}=\varepsilon\,U_{\mathrm{nom}}$,
$\varepsilon=$ `dropPct`$/100$ (Planungswert $3\,\%$ $\Rightarrow 0{,}36$ V), lautet das
**Budget** je Blatt

$$
B_v \;=\; \Delta U_{\mathrm{zul}}-\Delta U^{\mathrm{c}}_v .
$$

Damit entsteht das **gemischt-ganzzahlige konvexe Programm**

$$
\boxed{
\begin{aligned}
\min_{a}\quad & \sum_{e\in\mathcal{E}} c_e\,a_e \\
\text{s.t.}\quad & \sum_{e\in P(v)} \frac{b_e}{a_e}\;\le\; B_v, && \forall v\in\mathcal{S},\\
& a_e\in\mathcal{A}_{\text{norm}}, && \forall e\in\mathcal{E},\\
& a_e\;\ge\; \underline a_e, && \forall e\in\mathcal{E}.
\end{aligned}}
\tag{P}
$$

Die **Untergrenze** $\underline a_e$ ist keine Konstante, sondern folgt aus der
Sicherungskoordination: Der Nennstrom der gewählten Sicherung darf die effektive Belastbarkeit
nicht überschreiten, also

$$
\underline a_e \;=\; \min\left\{a\in\mathcal{A}_{\text{norm}} : I_{z,\mathrm{eff}}(a,e)\ \ge\ I_{\mathrm{n}}\!\left(\left|I_e\right|\right)\right\},
\qquad
I_{\mathrm{n}}(I)=\text{nextFuse}(I),
$$

wobei `nextFuse` die kleinste Norm-Sicherungsgröße $\ge I$ liefert. Diese Kopplung ist
**nicht** optional: Ein 70-A-Strom auf 10 mm² wäre physikalisch unzulässig, auch wenn der
Spannungsfall es erlaubte.

### 2.2 Konvexe Relaxation und KKT-System

Ersetzt man $a_e\in\mathcal{A}_{\text{norm}}$ durch $a_e\in[\underline a_e,120]$, so ist (P)
ein **konvexes** Problem: die Zielfunktion ist linear, jede Restriktion ist eine Summe konvexer
Funktionen $b_e/a_e$. Die Slater-Bedingung ist erfüllt (für $a_e\to120$ werden alle
Restriktionen strikt erfüllt, sofern $B_v>0$), also gilt **starke Dualität**.

**Satz 1 (KKT-System).** Sei $a^\star$ optimal für die Relaxation und $\lambda^\star\ge0$ ein
Multiplikatorvektor. Dann gilt:

$$
\begin{aligned}
&\text{(i)} && \frac{\partial}{\partial a_e}\Big[c_ea_e+\Lambda_e\frac{b_e}{a_e}\Big]=0
\;\Longrightarrow\;
a_e^\star=\sqrt{\frac{\Lambda_e\,b_e}{c_e}},
\qquad
\Lambda_e=\sum_{v:\,e\in P(v)}\lambda_v ,\\[4pt]
&\text{(ii)} && \lambda_v\left(B_v-\sum_{e\in P(v)}\frac{b_e}{a_e^\star}\right)=0
\qquad\text{(komplementärer Schlupf)},\\[4pt]
&\text{(iii)} && a_e^\star\ \ge\ \underline a_e,\qquad
\lambda_v\ \ge\ 0 .
\end{aligned}
$$

Aktive Querschnittsuntergrenzen erzeugen die projizierte Stationarität

$$
a_e^\star=\max\!\left(\underline a_e,\ \sqrt{\frac{\Lambda_e b_e}{c_e}}\right),
$$

d.h. die Untergrenze wirkt als **Box-Projektion**, nicht als Strafterm — die KKT-Bedingung
bleibt exakt.

### 2.3 Interpretation der Schattenpreise

$\lambda_v$ ist der Grenznutzen einer Budgeterweiterung: $\mathrm{d}M^\star/\mathrm{d}B_v=-\lambda_v$
(Masse in g pro Volt). Für das Papierbeispiel (§6) liefert die Relaxation

$$
\lambda=(\lambda_A,\lambda_B,\lambda_C,\lambda_D)=(4958{,}1;\ 2460{,}0;\ 3698{,}9;\ 3698{,}9)\ \mathrm{g/V},
\qquad \sum_v\lambda_v=14815{,}9\ \mathrm{g/V}.
$$

Der numerische Differenzenquotient der Relaxationsmasse nach dem Budget,
$\big(M(B+h)-M(B-h)\big)/2h$, ergibt $-14777{,}1\ \mathrm{g/V}$ gegenüber $-\sum_v\lambda_v=-14815{,}9$
— Abweichung $0{,}26\,\%$, verursacht durch die endliche Schrittweite $h$ und die
Bisektionsgenauigkeit. Das ist der **Gültigkeitstest der Dualität**, nicht nur eine Plausibilität.

Daß $\lambda_B$ kleiner ist als $\lambda_A$, obwohl beide dasselbe Budget haben, folgt aus
$b_1/b_2$: Blatt B hat den halben Strom und damit den halben Koeffizienten; eine Budgeterweiterung
„kauft“ dort weniger Masse.

### 2.4 Duale Koordinaten-Aszension

Das duale Funktions

$$
g(\lambda)=\sum_{e\in\mathcal{E}}\ \min_{a_e\in[\underline a_e,120]}\left(c_ea_e+\Lambda_e\frac{b_e}{a_e}\right)\;-\;\sum_{v\in\mathcal{S}}\lambda_v B_v
\tag{D}
$$

ist **konkav** in $\lambda$ und liefert für **jedes** $\lambda\ge0$ eine untere Schranke
$g(\lambda)\le \min(\mathrm{P})$. Wir maximieren $g$ durch Koordinaten-Aszension. Für feste
$\lambda_{-v}$ ist der Pfadabfall von Blatt $v$

$$
\Delta U_v(\lambda_v)=\text{const}+\sum_{e\in P(v)}\frac{b_e}{\max\!\left(\underline a_e,\sqrt{b_e(\lambda_v+M_e)/c_e}\right)}
\tag{2.1}
$$

**streng monoton fallend** in $\lambda_v$ (jeder Summand fällt monoton, die Wurzel wächst),
also ist die Optimalitätsbedingung $\Delta U_v(\lambda_v)=B_v$ eindeutig lösbar. Wir lösen sie
per **Bisektion** auf $[0,\lambda_{\max}]$; 40 bis 64 Halbierungen ergeben eine relative
Genauigkeit $<10^{-12}$.

```
Algorithmus 1: duale Koordinaten-Aszension
  λ ← 0
  for sweep = 1..maxSweeps:
     for v ∈ S:                     # Gauß-Seidel
        λ_v ← bisect( ΔU_v(·) = B_v )   # 64 Schritte
     if dual gap ≤ tol: break       # exaktes Konvergenzkriterium
  return (a*(λ), g(λ))
```

Bemerkenswert ist, daß **(D) auch bei nicht konvergierter Aszension eine gültige untere
Schranke** ist. Wir nutzen das im B&B: als Verzweigungsschranke dient $g(\lambda)$, nicht der
Primalwert der Relaxation. Damit ist die Schranke **konstruktiv beweisbar** unabhängig von der
Sweep-Zahl — der klassische Fehler „nicht konvergierte Relaxation als Schranke“ ist
ausgeschlossen.

### 2.5 Diskretes Problem und Branch-and-Bound

Das diskrete Problem entsteht durch $a_e\in\mathcal{A}_{\text{norm}}$. Es ist NP-schwer
(Rucksack-artige Kopplung über gemeinsame Kanten), bei $m\le12$ und $|\mathcal{A}_{\text{norm}}|=12$
aber mit exakter B&B-Methode beherrschbar.

**Schranke.** Für eine partielle Belegung $F$ (fixierte Kanten) und die freie Menge
$U=\mathcal{E}\setminus F$ wird (D) auf dem reduzierten Budget gelöst:

$$
B_v^{(F)}=B_v-\sum_{e\in P(v)\cap F}\frac{b_e}{a_e},
$$

und die Relaxation liefert $g_F(\lambda)\le \min\{(\mathrm{P})\mid a_e \text{ fixiert}\}$.
**Diese Schranke ist gültig, weil sie exakt das relaxierte Teilproblem löst** — inklusive der
Box-Schranken $\underline a_e$.

**Verzweigung.** Tiefensuche über die Kanten in absteigender Massenordnung
$c_ea_e$: die massekritischsten Kanten werden zuerst fixiert, was die Schranke früh schärft.

**Kandidatenmenge.** Für eine Kante werden **alle** $a\in\mathcal{A}_{\text{norm}}$ mit
$a\ge\underline a_e$ verzweigt — **nicht** nur $a\le a^{\text{incumbent}}_e$. Der Grund ist
substantiell: eine Kante darf wachsen, damit mehrere andere schrumpfen können (Bündelung im
Trunk). Eine Beschränkung auf „nicht schlechter als der Incumbent“ ist **nicht** gültig und
war in einer früheren Version die Ursache für falsch bewiesene Optima.

**Incumbent.** Greedy-Rundung der Relaxation + lokale Suche über 1- und 2-Kanten-Züge. Der
Incumbent ist stets zulässig; nach Abbruch wird er als Ergebnis zurückgegeben und
`proven=false` gesetzt.

**Korrektheit.** Ein Knoten wird nur verworfen, wenn $g_F(\lambda)\ge M^{\text{inc}}-10^{-9}$.
Da $g_F$ eine untere Schranke des jeweiligen Teilproblems ist, kann dort keine bessere zulässige
Lösung existieren. Bei vollständiger Exploration ohne Abbruch ist der Incumbent optimal:
`proven=true`.

### 2.6 Komplexität

Sei $k=|\mathcal{A}_{\text{norm}}|=12$, $s=|\mathcal{S}|$ die Blattzahl.

* Relaxation: $s$ Bisektionen pro Sweep, jede mit $\mathcal{O}(\log 1/\epsilon)$ Schritten und
  $\mathcal{O}(|P(v)|)$ Aufwand → $\mathcal{O}(s\,|P|\log\epsilon^{-1})$ pro Sweep.
* B&B: $\mathcal{O}(k^{m})$ im worst case; praktisch dominiert die Schranke. Gemessen:
  $39\ldots94$ Knoten, $144\ldots953$ Prüfungen, $33\ldots326$ Relaxationen für $m=5\ldots9$.
* Gesamtlaufzeit inkl. Elektro-Thermik: **12–150 ms** je Szenario (Browser, single thread).

### 2.7 Validierung gegen Brute-Force

Der B&B wurde gegen erschöpfende Enumeration über $12^{m}$ Querschnittskombinationen geprüft
(5 Kanten $\Rightarrow 248\,832$ Kombinationen je Problem), mit **100 zufälligen Netzen**
(Zufallsgenerator mit festem Seed, Längen $0{,}5\ldots12$ m, Lasten $20\ldots400$ W, Budgets
$2\ldots6\,\%$, Ambianten $15\ldots45\,^\circ$C):

$$
\text{Übereinstimmung: } 100/100, \qquad \text{alle Läufe } \texttt{proven=true},\qquad
\text{Laufzeit } 5\ldots160\ \text{Knoten}.
$$

Die ersten Fassungen des B&B lieferten **vier** Abweichungen. Drei echte Optimalitätsfehler
wurden identifiziert und behoben (unzulässige Kandidatenkappung, doppelt subtrahiertes Budget in
der Relaxation, veraltete Incumbent-Seedierung); die vierte Abweichung war ein Artefakt des
Testtreibers (Budget nicht skaliert). Diese Fehlerhistorie ist Teil des Nachweises: **ein
Optimalitätsbeweis ohne Brute-Force-Gegenprobe ist wertlos.**

---

## 3 Säule 2 — Elektro-thermischer Fixpunkt

### 3.1 Elektrisches Gleichgewicht

Bei festen Temperaturen $T$ und Querschnitten $a$ lösen wir das knotenbasierte
MNA-System

$$
\mathbf{G}(u)\,u=\mathbf{b},
\qquad
G_{ij}=\begin{cases}
\sum_{e\ni i}\dfrac{1}{R_e(T_e)}+\dfrac{1}{R_i+R_{\mathrm{sh}}}+g_i(u_i) & i=j,\\[6pt]
-\dfrac{1}{R_{ij}} & i\sim j,
\end{cases}
\tag{3.1}
$$

mit $g_i(u_i)=P_i/(\eta_i\max(u_i,0{,}5)^2)$ für CP-Lasten und $g_i=0$ für CC-Lasten (dort
steht der Strom auf der rechten Seite). Das System ist **symmetrisch positiv definit**
(Laplace-artig plus diagonale Last- und Quellenterme), also eindeutig lösbar; wir verwenden
Gauß-Elimination mit Spaltenpivotisierung.

**Fixpunktargument.** Die CP-Konduktanz hängt von $u_i$ ab; die Iteration

$$
u^{(k+1)}=\mathbf{G}\!\left(u^{(k)}\right)^{-1}\mathbf{b}
$$

ist eine Fixpunktiteration. Da $g_i(u)=P_i/(\eta_i u^2)$ für $u\ge0{,}5$ Lipschitz-stetig mit
$|g_i'|\le 2P_i/\eta_i u^3$ ist, ist die Abbildung für realistische Lasten kontraktiv; wir
begrenzen auf 400 Iterationen und brechen bei $\|u^{(k+1)}-u^{(k)}\|_\infty<10^{-9}$ V ab.
Die Konvergenz wird im UI als Iterationszahl ausgewiesen.

### 3.2 Thermisches Gleichgewicht

Die Temperatur einer Kante folgt dem quadratischen Lastmodell

$$
T_e \;=\; \vartheta_{\mathrm{amb}} \;+\; \left(T_{\max}-\vartheta_{\mathrm{amb}}\right)
\left(\frac{|I_e|}{I_z(a_e)\,f_H(n_e)}\right)^{2}.
\tag{3.2}
$$

Das ist die algebraische Form des stationären Wärmebilanzmodells (Wärmeabgabe proportional zur
Übertemperatur, Verluste $\propto I^2R$). Sie ist an der Stelle $I=I_z f_H$ exakt auf
$T_{\max}$ kalibriert; da die Belastbarkeitsprüfung zusätzlich $f_T$ fordert, gilt im zulässigen
Bereich stets $T_e\le T_{\max}$ — die Karte ist damit **konservativ** gegenüber der
Umgebungstemperatur-Korrektur.

**Banach-Fixpunkt.** Mit $\Phi:\mathbb{R}^{m}\to\mathbb{R}^{m}$,
$\Phi(T)_e=\vartheta_{\mathrm{amb}}+(T_{\max}-\vartheta_{\mathrm{amb}})(|I_e(T)|/I_z f_H)^2$,
lösen wir $T=\Phi(T)$ durch die gedämpfte Iteration

$$
T^{(k+1)}=(1-\omega)T^{(k)}+\omega\,\Phi\!\left(T^{(k)}\right),
\qquad \omega=0{,}7 .
\tag{3.3}
$$

Gemessene Kontraktionsfaktoren $\|\Delta T^{(k+1)}\|/\|\Delta T^{(k)}\|$:

| Szenario | Iterationen | Restfehler $\|\Delta T\|_\infty$ | Kontraktion |
|---|---|---|---|
| Kastenwagen | 12 | $5{,}61\cdot10^{-5}$ K | $0{,}302$ |
| Tiefe Kette | 11 | $7{,}25\cdot10^{-5}$ K | $0{,}301$ |
| Papierbeispiel | 11 | $7{,}76\cdot10^{-5}$ K | $0{,}300$ |

Der Faktor $\approx0{,}30$ bestätigt die Kontraktivität **empirisch** (hinreichend, nicht
notwendig: die Abbildung ist auf dem betrachteten Bereich Lipschitz mit $L<1$).

### 3.3 Verschachtelung der beiden Fixpunkte



Der gekoppelte Zustand ist ein Fixpunkt auf **drei** Ebenen:

$$
\underbrace{a}_{\text{diskret}}
\;\longleftrightarrow\;
\underbrace{T}_{\text{thermisch}}
\;\longleftrightarrow\;
\underbrace{u,I}_{\text{elektrisch}} .
$$

Wir lösen hierarchisch:

```
Algorithmus 2: äußere Querschnitts-Iteration mit gekoppelter Politur
  a⁰ ← Normierung des Nennstroms (12 V, η)        # entartungsfreier Start
  T⁰ ← Φ(a⁰)
  for outer = 1..5:
     (b, B, a̲) ← buildConstraintData(a, T)          # §2.1
     a ← B&B(c, b, B, a̲)                            # §2.5
     T ← Φ(a)                                        # §3.2
     protokolliere (outer, a, ΔU_max)
     if a unverändert oder Zyklus: break
  # (1) Zulässigkeit am VOLLEN Modell monoton herstellen
  while ∃v: ΔU_v > B_v:
     a_e ← nächstgrößere Norm für die Kante mit max I_e·R_e auf dem verletzten Pfad
  # (2) Politur: 1-opt, dann 2-opt, jeweils exakt verifiziert
  repeat bis 6 Runden:
     repeat: für jede Kante (Masse absteigend), jede kleinere Norm a' ≥ a̲
                wenn MNA(a') (i) und (ii) erfüllt: übernehmen
     wenn 1-opt nichts fand:
        für jedes Kantenpaar (e1,e2): beide eine Stufe kleiner
                wenn MNA(a') (i) und (ii) erfüllt: übernehmen, weiter mit 1-opt
        sonst: 2-opt-Nachbarschaft erschöpft → Ende
  # (3) Pillar-1-Auswertung am endgültigen Fixpunkt (eingefrorene Temperaturen)
  (a*, λ) ← Relaxation(a, T);  a^B&B ← B&B(a, T);  Π ← (M − M^B&B)/M
```

Der Vorfilter prüft jede Kandidatenreduktion zunächst mit **eingefrorenen** Strömen
($\mathcal{O}(E)$ statt $\mathcal{O}(E^3)$); nur Kandidaten, die den Vorfilter passieren, werden
exakt nachgerechnet. Da der Vorfilter den Strom nicht anpaßt, ist er **optimistisch** — er kann
eine zulässige Reduktion übersehen, aber keine unzulässige durchlassen. Die Gültigkeit hängt
damit allein an der exakten Prüfung.

**Warum die Nachbesserung nötig ist.** Das B&B arbeitet mit **eingefrorenen** Temperaturen.
Wird ein Querschnitt reduziert, steigt $T_e$, damit $R_e$, damit der Spannungsabfall — die
lineare Schranke ist am neuen Punkt **nicht mehr gültig**.

**Die Linearisierungsabbildung hat im diskreten Fall im allgemeinen keinen Fixpunkt.** Das ist
kein numerisches Artefakt, sondern strukturell: weil das Optimum der Relaxation auf der
Budgetschranke liegt ($\lambda_v>0$ für alle $v$), genügt eine beliebig kleine
Temperaturverschiebung, um die diskrete Projektion auf einen anderen Normquerschnitt springen
zu lassen. Die Iteration oszilliert dann zwischen zwei Vektoren. Das Protokoll des
Papierbeispiels zeigt das unverkürzt:

| Außenschritt | Querschnitte / mm² | $\Delta U_{\max}$ |
|---|---|---|
| 01 | 50 · 16 · 10 · 16 · 16 | 2,62 % |
| 02 | 50 · 16 · 10 · **10** · **10** | 3,00 % (Verletzung) |
| 03 | **35** · 16 · 10 · 16 · 16 | 2,96 % |
| 04 | 50 · 16 · 10 · 10 · 10 | 3,00 % (Zyklus erkannt) |

Zykluserkennung bricht nach Schritt 04 ab; die Reparatur hebt `b3`/`b4` auf 16 mm² an; die
**Politur** senkt den Trunk von 50 auf 35 mm², weil bei 16-mm²-Zweigen der Trunk nicht mehr der
Engpaß ist. Ergebnis: $35/16/10/16/16$, $2{,}96\,\%$.

**Politur als 2-opt-Abstieg.** Die Zulässigkeit einer Reduktion wird **exakt** am vollen
MNA-/Thermik-Zustand geprüft, mit zwei harten Nebenbedingungen:

$$
\text{(i)}\ \Delta U_v\le B_v\ \ \forall v,
\qquad
\text{(ii)}\ I_{\mathrm n}\!\left(|I_e|\right)\le I_{z,\mathrm{eff}}(a_e)\ \ \forall e .
$$

Bedingung (ii) ist die Sicherungskoordination; sie ist **nicht** durch $|I_e|\le I_z$ impliziert,
weil $I_{\mathrm n}=\text{nextFuse}(|I_e|)\ge |I_e|$ gilt (Beispiel: $I=17$ A, $I_{\mathrm n}=20$ A,
$I_z=18$ A). Nach Erschöpfung aller Einzelzüge wird zusätzlich **paarweise** reduziert
(gleichzeitige Absenkung zweier Kanten), weil eine Einzelreduktion durch die Rückkopplung
scheitern kann, während die gemeinsame zulässig ist. Das Ergebnis ist ein **2-opt-lokales
Optimum** des gekoppelten Problems: in der 1-opt- *und* 2-opt-Nachbarschaft existiert keine
zulässige Verbesserung. Für alle drei Referenznetze wird dieser Radius tatsächlich erschöpft
(`radius = 2`), ohne das Abbruchlimit zu berühren.

**Kopplungsprämie.** Der Abstand zwischen dem B&B-Optimum bei eingefrorenen Temperaturen und
dem verifizierten Entwurf ist die physikalische Kopplungsprämie:

$$
\Pi=\frac{M^{\text{Design}}-M^{\text{B\&B,fix}}}{M^{\text{Design}}}.
$$

Sie beträgt $17{,}6\,\%$ (Kastenwagen), $18{,}0\,\%$ (Kette) und $8{,}3\,\%$ (Papierbeispiel,
kürzere Zweige, geringere Erwärmung). Sie wird **nicht** als Solver-Lücke deklariert, sondern
als Modellpreis ausgewiesen.

---

## 4 Säule 3 — Kurzschluss, Schleifenimpedanz und Schutzkaskade

### 4.1 Schleifenimpedanz-Tensor

Für jeden Knoten $v$ definieren wir die Schleifenimpedanz (Kaltleiter, $20\,^\circ$C)

$$
Z_{\mathrm{loop}}(v)=R_i+R_{\mathrm{sh}}+\sum_{e\in P(v)}\left(R_e(20\,^\circ\mathrm{C})+R_{c,e}\right),
\tag{4.1}
$$

und die warme Variante mit $R_e(T_e)$. Der Tensor $Z_{\mathrm{loop}}:\mathcal{V}\to\mathbb{R}_{+}$
ist die zentrale Größe für die Fehlerstromabschätzung, weil ein Kurzschluss am Knoten $v$ genau
diesen Pfad als Rückweg nutzt.

### 4.2 Prospektiver Kurzschlussstrom

$$
I_{k,\max}(v)=\frac{U_{\max}}{Z_{\mathrm{loop}}^{\mathrm{cold}}(v)},
\qquad
I_{k,\min}(v)=\frac{U_{\min}}{Z_{\mathrm{loop}}^{\mathrm{hot}}(v)},
\tag{4.2}
$$

mit $U_{\max}$ (Ladespannung, z.B. $14{,}4$ V) und $U_{\min}$ (Entladeschluß, z.B. $11{,}0$ V).
$I_{k,\max}$ ist die Bemessungsgröße für das **Abschaltvermögen**, $I_{k,\min}$ die
Bemessungsgröße für die **Auslösesicherheit** (§4.5). Beide werden je Knoten ausgewiesen.

### 4.3 Sicherungsauswahl und Eskalation

Die Sicherung wird in einer festen Eskalationsfolge

$$
\text{ATO}\to\text{MIDI}\to\text{MEGA}\to\text{ANL}\to\text{MRBF}\to\text{Class T}
$$

gewählt: die erste Bauform, deren Nennstrombereich den nötigen Nennstrom
$I_{\mathrm n}=\text{nextFuse}(|I_e|)$ enthält **und** deren Abschaltvermögen den prospektiven
Strom deckt. Ist keine Bauform deckend, wird Class T mit `escalated=true` gesetzt und ein Flag
erzeugt — **kein stiller Fallback**.

### 4.4 Adiabatische $k^2A^2$-Bedingung und I²t-Reserve

Die Kurzschlussfestigkeit einer Leitung folgt aus der adiabatischen Erwärmung

$$
\int_0^{t_{\mathrm c}} i^2\,\mathrm{d}t \;\le\; k^2 A^2,
\tag{4.3}
$$

mit $k$ aus §1.4. Für die Sicherung setzen wir das Vorlichtbogen-I²t
$\mathrm{I^2t}_{\text{pre}}=(2I_{\mathrm n})^2\,t_{2x}$ und das Gesamt-I²t
$\mathrm{I^2t}_{\text{tot}}=1{,}25\,\mathrm{I^2t}_{\text{pre}}$. Die **Reserve** ist

$$
R_{A,e}=\frac{k^2a_e^2-\mathrm{I^2t}_{\text{tot}}}{k^2a_e^2}\cdot100\,\%.
\tag{4.4}
$$

Zusätzlich wird der Auslösestrom bei der Fehlerklärungszeit $t_a$ aus dem Vorlichtbogen-I²t
bestimmt: $I_{\text{trip}}(t_a)=\sqrt{\mathrm{I^2t}_{\text{pre}}/t_a}$.

### 4.5 Selektivitätskaskade

Für jede Eltern-Kind-Kantenbeziehung $(e_p,e_c)$ gilt die Selektivitätsbedingung

$$
\frac{\mathrm{I^2t}_{\text{pre}}(e_p)}{\mathrm{I^2t}_{\text{tot}}(e_c)}>1 .
\tag{4.5}
$$

Ist sie verletzt, kann die nachgeordnete Sicherung **vor** der übergeordneten auslösen; die
Anlage verliert die Staffelung. Die Bedingung wird paarweise geprüft und im UI als
Selektivitätsmatrix dargestellt. Zusätzlich gilt die Auslösesicherheit
$I_{k,\min}(v)\ge I_{\text{trip}}(t_a)$ für jede Sicherung.

### 4.6 Flag-Taxonomie

| Code | Bedeutung |
|---|---|
| `AIC` | Abschaltvermögen $\ge I_{k,\max}$ verletzt |
| `COORD` | Sicherungsnennstrom $>$ effektive Belastbarkeit |
| `TRIP` | $I_{k,\min}$ unter Auslösestrom bei $t_a$ |
| `I2T` | adiabatische Reserve $\le 0$ |
| `THERM` | thermischer Fixpunkt nicht konvergiert |
| `SEL` | Selektivitätskaskade verletzt |
| `SOLVER` | MNA/Relaxation numerisch nicht konvergiert |
| `REPAIR` | äußere Iteration mußte Querschnitte anheben (Kopplung) |
| `OK` | keine Auffälligkeit |

---

## 5 Säule 4 — Orthogonales E-CAD-Routing

Ziel ist eine **kreuzungsfreie** orthogonale Zeichnung: kein Leitungspaar darf sich schneiden, keine
Leitung darf kollinear über eine andere laufen, keine Karte darf überdeckt werden. Das ist die
Mindestanforderung an einen Schaltplan; eine Heuristik, die Kreuzungen nur *minimiert*, erfüllt sie
nicht.

### 5.1 Planare Ebenenordnung (DFS-Intervallschlüssel)

Ein Baum ist planar. Eine geschichtete Zeichnung ist genau dann kreuzungsfrei, wenn die Knoten
jeder Ebene so geordnet sind, daß **der Teilbaum jedes Knotens ein zusammenhängendes x-Intervall
belegt**. Wir konstruieren diese Ordnung direkt:

1. Tiefensuche ab der Wurzel; die Blätter werden in DFS-Reihenfolge mit $0,1,2,\dots$ numeriert.
2. Jeder Knoten $v$ erhält das Intervall $I(v)=[\ell(v),r(v)]$ der Blattindizes seines Teilbaums:
   $$
   I(v)=\bigcup_{c\in\mathrm{children}(v)} I(c),
   \qquad
   I(\text{Blatt})=\{\ell\}.
   $$
3. Sortierschlüssel ist die Intervallmitte
   $$
   \kappa(v)=\tfrac12\big(\ell(v)+r(v)\big).
   $$
   Jede Ebene wird nach $\kappa$ sortiert, Tie-Break = Knoten-ID (Determinismus).

**Satz 2 (Planarität).** Für Geschwister $u\neq v$ gilt $I(u)\cap I(v)=\emptyset$; für Vorfahr/Nachfahr
$u\prec v$ gilt $I(v)\subseteq I(u)$. Damit sind die x-Bereiche disjunkter Teilbäume disjunkt, und
die Kinder eines Knotens erscheinen in derselben Reihenfolge wie seine Anschlüsse. Beides sind
genau die Voraussetzungen, unter denen der Kanalrouter aus §5.3 ** beweisbar** kreuzungsfrei routet.

Die früher verwendete Barycenter-Heuristik (Sugiyama) minimiert Kreuzungen nur statistisch; sie
läßt sie in Einzelfällen stehen. Sie ist hier durch die konstruktive Ordnung ersetzt.

### 5.2 Ports und Anschlüsse

Die Ausgänge eines Knotens werden in $x$ aufgefächert, damit die Stichleitungen nicht
zusammenfallen:

$$
x^{\text{port}}_e=x_v+\Big(i-\frac{k-1}{2}\Big)\cdot\min\!\Big(20,\frac{96}{k}\Big),
\qquad i=0,\dots,k-1,
\tag{5.1}
$$

geordnet nach der x-Position des jeweiligen Kindes (monoton). Anschließend läuft eine
**Kollisionsreparatur**: liegt ein Port-$x$ innerhalb von $5$ px auf der Klemme eines fremden
Netzes, wird er ausweichend verschoben; danach wird die Monotonie je Elternknoten wiederhergestellt.
Ohne diesen Schritt entstehen *vertikal kollineare* Stichleitungen (zwei Leitungen auf demselben
$x$), die keine Ordnungsbedingung des VCG erfassen kann.

### 5.3 Kanalrouting mit vertikalem Constraint-Graphen

Ein Kanal liegt zwischen zwei Ebenen. Jedes Netz $e$ habe den oberen Anschluß $x_1(e)$ und den
unteren $x_2(e)$; sein Horizontalsegment überstreicht
$\mathrm{span}(e)=[\min(x_1,x_2),\max(x_1,x_2)]$.

Reine Intervallfärbung („linke Kante“) garantiert nur, daß zwei **horizontale** Segmente auf
derselben Spur disjunkt sind. Sie übersieht die **Stichleitungen**: die obere Stichleitung von $B$
bei $x_1(B)$ durchläuft alle $y$ zwischen Oberkante und ihrer Spur und liegt daher genau dann auf
dem Horizontalsegment von $A$, wenn $x_1(B)\in\mathrm{int}(\mathrm{span}(A))$ **und** $A$ oberhalb
von $B$ liegt. Daraus folgen die beiden Ordnungsbedingungen

$$
\begin{aligned}
x_1(B)\in\mathrm{int}(\mathrm{span}(A)) &\;\Longrightarrow\; y_A>y_B &&\text{(obere Stichleitung)}\\
x_2(B)\in\mathrm{int}(\mathrm{span}(A)) &\;\Longrightarrow\; y_A<y_B &&\text{(untere Stichleitung)}
\end{aligned}
\tag{5.2}
$$

für alle geordneten Paare $(A,B)$. Der Graph dieser Bedingungen ist der **vertikale
Constraint-Graph (VCG)**; er wird topologisch sortiert (Kahn). Die Spuren werden in dieser
Reihenfolge per First-Fit vergeben:

```
Algorithmus 4: VCG-Kanalrouting
  baue Kanten aus (5.2) für alle Paare im Kanal
  topo ← Kahn(VCG)                     # Tie-Break: kleineres linkes Ende
  für j in topo:
     t ← max(Spur[v] + 1 für alle Vorgänger v)   # Ordnung einhalten
     wiederhole: wenn t mit einem bereits belegten Intervall überlappt: t ← t+1
     Spur[j] ← t
  Spurenzahl T = max(Spur) + 1
```

**Korrektheit.** Erfüllt die Zuordnung alle Bedingungen (5.2) und sind alle Paare auf derselben Spur
disjunkt, so existiert kein horizontales×vertikales Kreuzungspaar und kein kollineares Paar. Der
VCG ist für die DFS-geordnete Zeichnung nach Satz 2 **azyklisch**; Zyklen (nur bei nicht-planaren
Vorgaben möglich) werden erkannt, markiert (`doglegs`) und im Prüfbericht ausgewiesen — es gibt
keinen stillen Fallback.

### 5.4 Zwei-Pass-Layout

Das Spurenband eines Kanals braucht
$\,(T-1)\cdot d\,$ Höhe. Bei fester Ebenenhöhe $DY$ und vielen Netzen ($T>8$) sprengt es den Kanal:
die Spuren wandern über die Elternkarten, und die Stichleitungen laufen **rückwärts** (nach oben).
Genau dieser Fehler trat im Stresstest mit 19 Spuren auf.

Deshalb wird das Layout in zwei Pässen gebaut:

1. **Pass 1 (x-Richtung):** Ebenenordnung (§5.1), Ports (§5.2), VCG und Spurenzahl $T_k$ je Kanal
   — alles unabhängig von $y$.
2. **Pass 2 (y-Richtung):** Ebenenabstand aus der Spurenzahl
   $$
   \text{gap}_k=\max\!\Big(48,\;(T_k+0{,}6)\cdot 12+16\Big),
   \qquad
   d_k=\mathrm{clamp}\!\Big(\frac{\text{gap}_k}{T_k+1{,}6},\,8,\,16\Big).
   $$
   Damit gilt $(T_k-1)\,d_k<\text{gap}_k$ für alle $k$: das Spurenband bleibt **im** Kanal.

Die Gesamthöhe der Zeichnung ist $\sum_k(\text{gap}_k+NODE_H)$, also selbstadaptiv.

### 5.5 Invariantenprüfung (im Code und extern)

Der Router prüft sein eigenes Ergebnis unmittelbar nach der Konstruktion: alle Segmentpaare werden
auf Schnitt ($h\times v$), kollineare Überlappung ($h\times h$, $v\times v$) und Randberührung
getestet; die Zahl wird als `crossings` geführt und im Solver-Panel angezeigt. Zusätzlich prüft ein
**unabhängiger** Test (jsdom, gerenderte SVG-Pfade, nicht die Layout-Interna):

| Prüfung | Kastenwagen | Tiefe Kette | Papierbeispiel |
|---|---|---|---|
| Kartenkollisionen | 0 | 0 | 0 |
| Labelkollisionen | 0 | 0 | 0 |
| Leitungskreuzungen | 0 | 0 | 0 |
| Spuren (max.) | 1 | 3 | 2 |
| Jogs | 0 | 0 | 0 |

**Randomisierter Stresstest:** 200 zufällige Bäume (2–6 Ebenen, 0–3 Kinder je Knoten, bis 80
Kanten, deterministischer Seed), davon 144 mit Kanten: **144/144 kreuzungsfrei**, 0 Jogs,
Spurenzahl 1–15. Der Test läuft über den reinen Routing-Haken `window.__route(network)` ohne
Netzberechnung (< 2 s für alle Netze).

Die Prüfung umfasst seit der Rückleitererweiterung (§5.8) **drei** Klassen von Konflikten:
Zuleitung × Zuleitung, Rückleiter × Rückleiter und Rückleiter × fremde Zuleitung bzw.
× Knotenkarte. Für alle drei Referenznetze gilt 0 in allen Klassen; im Stresstest sind
**144/144** Netze auch in der Rückleiterklasse kollisionsfrei.

### 5.6 Minimalitätszertifikat für die Spurenzahl

Die Spurenzahl $T$ eines Kanals ist nach unten durch die **Cliquenzahl** $\omega$ des
Intervallgraphen beschränkt: $\omega$ ist die maximale Zahl gleichzeitig überdeckter
Intervallpunkte, und $\omega$ Intervalle, die einen gemeinsamen Punkt enthalten, benötigen
paarweise verschiedene Spuren. Also gilt stets

$$
\omega\;\le\;T .
	ag{5.3}
$$

$\omega$ wird per Sweep bestimmt (Start-vor-Ende bei gleicher Koordinate, damit Punktintervalle
— Port exakt über der Klemme — korrekt mitzählen und nie unterschätzt werden). Gilt $T=\omega$,
ist die Zuordnung **beweisbar spurenminimal**; gilt $T>\omega$, kosten die Ordnungsbedingungen
(5.2) zusätzliche Spuren — das wird ausgewiesen, nicht verdeckt.

| Szenario | $T$ je Kanal | $\omega$ je Kanal | Zertifikat |
|---|---|---|---|
| Kastenwagen | 1, 1, 1 | 1, 1, 1 | **minimal** |
| Tiefe Kette | 1, 1, 1, 3 | 1, 1, 1, 3 | **minimal** |
| Papierbeispiel | 1, 2 | 1, 2 | **minimal** |

Im Stresstest sind 126 von 160 Netzen in allen Kanälen spurenminimal; bei den übrigen kostet die
Kreuzungsfreiheit eine Zusatzspur. Das ist der ehrliche Preis der Invariante aus §5.3 — und er
wird beziffert, nicht verschwiegen.

### 5.7 Selbsttest im Artefakt

Die Prüfung ist nicht nur externen Skripten überlassen: die Anwendung bringt einen
**Property-based Self-Test** mit (Schaltfläche „Selbsttest · 200 Zufallsbäume“ im Solver-Panel,
Haken `window.__selftest()`).

* Deterministischer Generator (LCG, fester Seed) → reproduzierbare Läufe.
* 200 zufällige Bäume, 2–6 Ebenen, 0–3 Kinder je Knoten, gemischte CP/CC-Lasten.
* Geprüft werden: Kreuzungen, Jogs, Spurenminimalität, maximale Spurenzahl und
  Rückleiterkollisionen (§5.8).
* Ergebnis (gemessen): **160/160 kreuzungsfrei**, 0 Jogs, 126/160 spurenminimal,
  **160/160 Rückleiter kollisionsfrei**, maximale Spurenzahl 16, Laufzeit **203 ms**.

Damit ist die Invariante im ausgelieferten Artefakt selbst überprüfbar — ohne Testframework,
ohne Build-Schritt.

### 5.8 Zweite Ader: Rückleitergeometrie

Jede Leitung im Artefakt ist eine **Paar-Ader** (Hin- und Rückleiter im selben Kabel). Der
Schalter „Rückleiter-Paar zeigen“ blendet die zweite Ader ein. Sie wird nicht als Freihand-Offset
gezeichnet, sondern als **versetzte Kopie desselben Pfades**: jedes Segment wird um die
rechtsläufige Normale seiner Laufrichtung verschoben ($\mathbf{n}=(-\Delta y,\Delta x)$) und an
den Knicken über **Gehrungspunkte** — den Schnitt der beiden versetzten Segmentgeraden —
verbunden. Der frühere achsenfeste Versatz (horizontal stets nach unten, vertikal stets nach
rechts) wechselte an Ecken die Seite und ließ die „parallele“ Ader die Hauptader kreuzen.

Der Versatz $\delta$ ist eine **Layout-Konstante** ($\delta=3$ px, unabhängig von der
Strichbreite), damit die Geometrie der zweiten Ader überhaupt prüfbar ist — eine von der
Querschnittsdarstellung abhängige Verschiebung wäre kein modelliertes Objekt, sondern eine
Zeicheneinstellung. Die Wahl von $\delta$ ist **gemessen**, nicht behauptet: derselbe Stresstest
(144 Netze) bei verschiedenen Versätzen.

| $\delta$ / px | kollisionsfreie Netze | Treffer gesamt | Konfliktklasse |
|---|---|---|---|
| 2 | 144/144 | 0 | — |
| **3** | **144/144** | **0** | — |
| 4 | 144/144 | 0 | — |
| 5 | 143/144 | 1 | Rückleiter × fremde Zuleitung |
| 6 | 128/144 | 25 | Rückleiter × fremde Zuleitung |
| 7 | 123/144 | 52 | Rückleiter × fremde Zuleitung |
| 9 | 117/144 | 84 | Rückleiter × fremde Zuleitung |

Der Sprung zwischen 4 px und 5 px markiert die Grenze des **port-eigenen Korridors**: innerhalb
weniger Pixel um einen Port liegt kein fremdes Segment, darüber erreicht die zweite Ader die
Horizontale einer Nachbarkante, deren Endpunkt knapp neben dem eigenen Port liegt. $\delta=3$ px
liegt mit 2 px Abstand zur gemessenen Kante dieses Bereichs und hält zugleich sichtbaren Abstand
zur Zuleitung.

Die zweite Ader wird **im Artefakt selbst mitgeprüft** (`returnCrossings` im Solver-Panel,
Fehlerflag `ROUTING` bei $>0$) und in den Reihen des Selbsttests (§5.7) geführt. Bei dicken
Querschnitten liegt die dünne Ader innerhalb der Kabelkontur — das ist die physikalisch richtige
Aussage (beide Adern liegen im selben Mantel), bei dünnen läuft sie sichtbar daneben.

**Nicht modelliert:** der Rückleiter ist *kein* eigenes Routingobjekt. Er belegt keine eigene
Spur, weil er im selben Kabel läuft; eine Variante mit getrennter Rückleitung (Karosserie oder
separater Rückleiterbaum) wäre ein zweites Routingsproblem mit eigener Kanalkapazität und ist
nicht Teil dieses Artefakts.

### 5.9 Grenzen

* Zwei Ebenen (horizontal/vertikal) ohne Vias; jede Kante verbindet benachbarte Ebenen.
* Keine Hindernisvermeidung außerhalb der Karten (Labelkästen werden geprüft, aber nicht als
  Hindernisse geroutet).
* Kanalweise Optimierung: die Spurenzahl ist je Kanal minimal *unter der Ordnungsbedingung*; ein
  globales Minimum über alle Kanäle wird nicht beansprucht.

## 6 Konkreter Vergleich: Stamm + vier Zweige

### 6.1 Netz

Batterie $U_{\mathrm{oc}}=13{,}2$ V, $R_i=2{,}0$ mΩ, $R_{\mathrm{sh}}=0{,}1$ mΩ,
$U_{\max}=14{,}4$ V, $U_{\min}=11{,}0$ V, $\vartheta_{\mathrm{amb}}=25\,^\circ$C, PVC,
Zielspannungsfall $3\,\%$ ($\Delta U_{\mathrm{zul}}=0{,}36$ V).

| Kante | von → nach | $l$ / m | Last |
|---|---|---|---|
| `t1` | Batterie → Busbar | 2,0 | — |
| `b1` | Busbar → Last A | 5,0 | 240 W (CC) |
| `b2` | Busbar → Last B | 5,0 | 120 W (CC) |
| `b3` | Busbar → Last C | 5,0 | 180 W (CC) |
| `b4` | Busbar → Last D | 5,0 | 180 W (CC) |

Ströme bei Nennspannung: $I_{t1}=60$ A, $I_{b1}=20$ A, $I_{b2}=10$ A, $I_{b3}=I_{b4}=15$ A.

### 6.2 Naive Einzelstrang-Bemessung

Die übliche „Planer“-Rechnung bemessen jede Ader **isoliert** gegen das Gesamtbudget:

$$
a_e^{\text{naiv}}=\text{nextNorm}\!\left(\frac{2\,l_e\,I_e}{\kappa\,\Delta U_{\mathrm{zul}}}\right),
\qquad \kappa=57{,}143,\ \Delta U_{\mathrm{zul}}=0{,}36\ \mathrm{V}.
\tag{6.1}
$$

| Kante | $2lI/(\kappa\Delta U)$ | naiv | $I_e$ | $\Delta U_e$ kalt | Masse |
|---|---|---|---|---|---|
| `t1` | $11{,}67$ | **16** | 60 A | 0,2625 V | 573 g |
| `b1` | $9{,}72$ | **10** | 20 A | 0,3500 V | 896 g |
| `b2` | $4{,}86$ | **6** | 10 A | 0,2917 V | 538 g |
| `b3` | $7{,}29$ | **10** | 15 A | 0,2625 V | 896 g |
| `b4` | $7{,}29$ | **10** | 15 A | 0,2625 V | 896 g |
| | | | | **Summe** | **3,799 kg** |

Der Fehler ist strukturell: (6.1) setzt voraus, daß **jede** Ader das **volle** Budget
verbrauchen darf. Im Verbund addieren sich die Pfadabfälle:

$$
\Delta U_A=0{,}2625+0{,}3500=0{,}6125\ \mathrm{V}\ (5{,}10\,\%),
\qquad
\Delta U_B=0{,}5542\ \mathrm{V}\ (4{,}62\,\%),
\qquad
\Delta U_{C,D}=0{,}5250\ \mathrm{V}\ (4{,}38\,\%).
$$

Ergebnis: **$5{,}10\,\%$ statt $3\,\%$**, vier Verstöße, Masse $3{,}799$ kg. Die naive Lösung
ist damit **unzulässig** und zugleich **zu leicht**: sie unterschätzt die benötigte Masse, weil
sie die Kopplung über den Trunk ignoriert.

### 6.3 Greedy-Reparatur

Die naheliegende Reparatur vergrößert iterativ die Kante mit dem größten Beitrag
$|I_e|R_e$ auf dem verletzten Pfad, bis alle Blätter eingehalten sind. Ergebnis:

$$
a=(25,25,10,16,16),\qquad M=6{,}899\ \mathrm{kg},\qquad \Delta U_{\max}=2{,}86\,\% .
$$

Die Reparatur ist zulässig, aber **teuer**: sie vergrößert beide Zweige A und B auf 25 mm²,
obwohl der Engpaß der Trunk ist.

### 6.4 Proportionale Budgetaufteilung

Eine verbreitete Heuristik teilt das Budget proportional zu den Strömen auf die Kanten auf
und bemisst jede Ader gegen ihren Anteil. Ergebnis:

$$
a=(50,16,10,16,16),\qquad M=6{,}989\ \mathrm{kg},\qquad \Delta U_{\max}=2{,}52\,\% .
$$

Diese Lösung ist zulässig, aber ebenfalls suboptimal: sie „verschenkt“ Masse an den Trunk
(50 mm²) und läßt die Zweige auf der sicheren Seite.

### 6.5 KKT + B&B + Politur

Die Relaxation (Satz 1) liefert

$$
a^\star=(43{,}13;\ 14{,}16;\ 7{,}02;\ 10{,}56;\ 10{,}56),\qquad M^\star=5{,}3345\ \mathrm{kg},
$$

und das B&B über $\mathcal{A}_{\text{norm}}$ bei eingefrorenen Temperaturen

$$
a^{\text{B\&B}}=(50,16,10,10,10),\qquad M=5{,}9136\ \mathrm{kg},\qquad
\text{13 Knoten, 144 Prüfungen, 33 Relaxationen, bewiesen}.
$$

Am gekoppelten Modell verletzen die 10-mm²-Zweige C/D das Budget um $0{,}1$ mV
($0{,}3601$ V $>0{,}3600$ V) — die Temperaturrückkopplung. Der äußere Fixpunkt hebt
`b3`/`b4` auf 16 mm² an (2 Nachbesserungen), die **Politur** senkt anschließend den Trunk
von 50 auf 35 mm², weil bei 16-mm²-Zweigen der Trunkdurchmesser nicht mehr der Engpaß ist.

**Endentwurf:**

| Kante | $a$ / mm² | $I$ / A | $T$ / °C | $R_{20}$ / mΩ | $R(T)$ / mΩ | $\Delta U$ / V | Masse / g | Sicherung | I²t-Reserve |
|---|---|---|---|---|---|---|---|---|---|
| `t1` | **35** | 60,00 | 38,15 | 2,000 | 2,143 | 0,1286 | 1254 | MRBF 60 A | 99,89 % |
| `b1` | **16** | 20,00 | 28,78 | 10,938 | 11,315 | 0,2263 | 1434 | Class T 20 A | 99,95 % |
| `b2` | **10** | 10,00 | 26,66 | 17,500 | 17,958 | 0,1796 | 896 | Class T 10 A | 99,97 % |
| `b3` | **16** | 15,00 | 27,13 | 10,938 | 11,244 | 0,1687 | 1434 | Class T 15 A | 99,97 % |
| `b4` | **16** | 15,00 | 27,13 | 10,938 | 11,244 | 0,1687 | 1434 | Class T 15 A | 99,97 % |
| | | | | | | **6,451 kg** | | | |

**Knotenpotentiale und Fehlerströme:**

| Knoten | $u$ / V | $\Delta U$ / mV | $Z_{\mathrm{loop}}$ / mΩ | $I_{k,\max}$ / kA | $I_{k,\min}$ / A |
|---|---|---|---|---|---|
| Batterie | 13,0740 | 0,0 | 2,10 | 6,857 | 5238,1 |
| Busbar | 12,9454 | 128,6 | 4,10 | 3,512 | 2592,7 |
| Last A | 12,7191 | **354,9** | 15,04 | 0,958 | 707,1 |
| Last B | 12,7659 | 308,1 | 21,60 | 0,667 | 495,5 |
| Last C | 12,7768 | 297,2 | 15,04 | 0,958 | 710,3 |
| Last D | 12,7768 | 297,2 | 15,04 | 0,958 | 710,3 |

Schattenpreise: $\lambda=(4958{,}1;2460{,}0;3698{,}9;3698{,}9)$, $\sum\lambda=14815{,}9$ g/V.
Die KKT-Stationarität ist auf allen Kanten erfüllt:

$$
\frac{c_e a_e^{\star 2}}{b_e\Lambda_e}=1{,}000 \qquad \forall e .
$$

### 6.6 Diskussion

**Warum der Trunk die Masse trägt.** $\Lambda_e$ ist für `t1` die Summe **aller vier**
Multiplikatoren ($\Lambda=14815{,}9$), für `b1` nur $\lambda_A$ ($4958{,}1$). Da
$a^\star\propto\sqrt{\Lambda_e b_e}$, wächst der Trunkquerschnitt mit der Wurzel der
Gesamtlast — nicht linear. Das erklärt, warum 35 mm² im Trunk genügen, obwohl vier Zweige
versorgt werden.

**Warum die 10-mm²-Zweige scheitern.** Bei 10 mm² und 15 A liegt die Auslastung
$15/63=0{,}24$; die Temperatur steigt nur auf $27{,}1\,^\circ$C. Der Widerstand steigt um
$2{,}7\,\%$ — genau dieser kleine Anstieg reicht, um die Budgetgleichheit
($0{,}3600$ V) um $0{,}1$ mV zu verletzen. Das ist **keine** Modellinkonsistenz, sondern die
Eigenschaft eines aktiven Gleichheitsrestriktion: das Optimum liegt **auf** der Schranke, jede
Rückkopplung wirkt nach außen.

**Kopplungsprämie.** $M^{\text{Design}}/M^{\text{B\&B,fix}}=6{,}451/5{,}914=1{,}091$, also
$+8{,}3\,\%$ — der kleinste Wert der drei Szenarien, weil die Zweige kurz sind (5 m) und die
Erwärmung gering bleibt. Bei langen Ketten (Kastenwagen: $+17{,}6\,\%$) wächst der Preis der
Kopplung deutlich.

**Vergleichstabelle:**

| Verfahren | $a$ / mm² | Masse / kg | $\Delta U_{\max}$ | zulässig | Ersparnis vs. Verfahren |
|---|---|---|---|---|---|
| Naiv (isoliert) | 16,10,6,10,10 | 3,799 | 5,10 % | **nein** (4 Verstöße) | — |
| Greedy-Reparatur | 25,25,10,16,16 | 6,899 | 2,86 % | ja | **6,5 %** |
| Proportional | 50,16,10,16,16 | 6,989 | 2,52 % | ja | **7,7 %** |
| **KKT + B&B + Politur** | **35,16,10,16,16** | **6,451** | **2,96 %** | **ja** | — |

### 6.7 Abgrenzung zum Referenzplaner (12V-Planer)

Der Vergleichsmaßstab dieser Arbeit ist der **12V-Planer** (https://12v-planer.de/planer/,
abgerufen am 11.11.2026). Die Abgrenzung stützt sich ausschließlich auf das, was die Seite
selbst über ihr Verfahren und ihren Prüfbericht aussagt — nicht auf Vermutungen über den Code.

**Was der Referenzplaner nach eigenen Angaben tut**

* „Kabelquerschnitt berechnen aus Spannungsabfall und Strombelastbarkeit (DIN VDE 0298-4)“ —
  also eine **strangweise** Bemessung gegen das Spannungsfallbudget und die Belastbarkeit.
* „Die Sicherung folgt der Leitung, nie umgekehrt“ — die Sicherung wird nach dem gewählten
  Querschnitt gewählt, nicht als Koordinationsaufgabe behandelt.
* Das Routing ist **manuell bzw. „Automatisch verbinden“**; die Zeichnung wird anschließend
  geprüft. Der mitgelieferte Beispielplan meldet in seinem eigenen Prüfbericht
  „1 Kreuzung(en)“ auf mindestens zwei Leitungen, mehrere Abstandshinweise
  („Leitung liegt zu nah an einem Bauteil“) sowie „3 Prüfhinweise im Plan, davon 1 kritisch,
  56 im Kabelrouting“.

**Konsequenz.** Kreuzungen und Abstandsverletzungen sind dort ein **meldbares Prüfergebnis**,
kein Konstruktionsausschluss: der Plan wird gezeichnet, geprüft und ggf. beanstandet. In dieser
Arbeit ist die Kreuzungsfreiheit dagegen eine **Konstruktionsinvariante** (§5): der Router
erzeugt sie, prüft sie im selben Lauf und führt sie als Flag, wenn sie verletzt wäre.

**Gegenüberstellung**

| Dimension | 12V-Planer (nach eigenen Angaben) | diese Arbeit |
|---|---|---|
| Querschnitt | strangweise aus $\Delta U$ und Belastbarkeit | diskretes **Globaloptimum über den Baum** (KKT-Relaxation + B&B, 100/100 gegen Brute-Force) |
| Kopplung | keine Temperaturrückkopplung genannt | elektro-thermischer Fixpunkt mit Kontaktwiderständen und CP-Lasten |
| Sicherung | folgt der Leitung | Eskalationsleiter + Abschaltvermögen + I²t-**Selektivitätskaskade** |
| Kurzschluss | nicht genannt | Schleifenimpedanz-Tensor, $I_{k,\max}/I_{k,\min}$ je Knoten, adiabatische $k^2A^2$ |
| Routing | manuell/Auto-Verbinden, Kreuzungen werden **gemeldet** | planare Ordnung + VCG-Kanalrouting, **0 Kreuzungen** garantiert und geprüft |
| Nachweis | regelbasierter Prüfbericht | Beweise: Brute-Force, Dualschranke, Schattenpreis, 2-opt, 144/144-Stresstest |
| Nicht enthalten | — | 230-V-AC-Kreis, PV-Ertrag, Batteriechemie, Stückliste, Export |

Das ist **keine** Aussage „besser oder schlechter“, sondern eine Aufgabenabgrenzung: der
Referenzplaner ist ein Zeichen- und Prüfwerkzeug mit breitem Anlagenumfang (230 V, PV, Chemie,
Stückliste); diese Arbeit ist ein **Optimierungs- und Nachweiskern** für den 12-V-Gleichstromteil,
der bewusst nur das rechnet, was er beweisen kann. Die Punkte, die der Referenzplaner abdeckt und
diese Arbeit nicht, sind in §9 als Nicht-Ziele aufgeführt — sie werden nicht als „gelöst“
ausgegeben.

---

## 7 Ergebnisse der drei Referenznetze

| Szenario | $m$ | $a$ / mm² | Masse / kg | $\Delta U_{\max}$ | $I_{k,\max}$ / kA | $I_{k,\min}$ / A | I²t-Reserve | Relax. / kg | B&B / kg | Lücke | Kopplung | Laufzeit |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Kastenwagen (4-stufig) | 9 | 70,10,50,6,4,2.5,16,25,16 | **6,487** | 2,93 % | 11,08 | 113,9 | 99,78 % | 4,877 | 5,344 | 8,7 % | +17,6 % | 118 ms |
| Tiefe Kette (5-stufig) | 8 | 70,70,35,6,6,16,10,16 | **10,877** | 2,97 % | 7,58 | 194,3 | 99,76 % | 8,247 | 8,924 | 7,6 % | +18,0 % | 68 ms |
| Papierbeispiel | 5 | 35,16,10,16,16 | **6,451** | 2,96 % | 6,86 | 495,5 | 99,89 % | 5,335 | 5,914 | 9,8 % | +8,3 % | 11 ms |

Laufzeiten: Mittel aus zehn Läufen im Browser (single thread, jsdom-Vergleichsmessung);
Streuung ±30 %. Die Politur meldet in allen drei Fällen `radius = 2`.

Die Spalten „Relax.“ und „B&B“ beziehen sich auf das **eingefrorene** Problem (§2.1):
„Relax.“ ist das kontinuierliche Optimum $M^\star$, „B&B“ das diskrete Optimum bei festen
Temperaturen. Der ausgelieferte Entwurf (Spalte „Masse“) ist stets schwerer — die Differenz ist
die Kopplungsprämie $\Pi$ aus §3.3, kein Solver-Restfehler.

**Ersparnis gegenüber den Baselines:**

| Szenario | vs. Greedy-Reparatur | vs. Proportional | vs. naive Heuristik |
|---|---|---|---|
| Kastenwagen | 5,2 % | 26,8 % | — |
| Tiefe Kette | 7,3 % | 28,4 % | — |
| Papierbeispiel | 6,5 % | 7,7 % | — |

Die naive Rechnung ist in allen drei Fällen **unzulässig** (6 / 5 / 4 Verstöße); ein
Massevergleich gegen sie ist daher nur als „was kostet Zulässigkeit“ sinnvoll, nicht als
Ersparnis.

---

## 8 Validierung und Fehlerkontrolle

### 8.1 Brute-Force-Gegenprobe

100 Zufallsnetze, $12^{5}$ Enumeration, **100/100 Übereinstimmung**, alle Optima bewiesen
(§2.7).

### 8.2 Betriebsbereich (Regressionslauf)

14 Parametersätze je Szenario, 42 Läufe: Budget $1/2/3/5\,\%$, Umgebung $15/45/55\,^\circ$C,
Längenskalierung $\times1{,}5/\times2$, Kontaktskalierung $\times0{,}5/\times2$, Isolation XLPE
sowie drei Kombinationen. Geprüft wird für **jeden** Lauf:

* $\Delta U_{\max}\le$ Budget (kein zulässiger Entwurf wird verworfen),
* $I_{\mathrm n}\le I_{z,\mathrm{eff}}$ (Sicherungskoordination),
* Abschaltvermögen $\ge I_{k,\max}$, Auslösung bei $I_{k,\min}$, I²t-Reserve $\ge0$,
* Auslastung $I/I_{z,\mathrm{eff}}\le1$.

Ergebnis: **42/42 zulässig**, langsamster Lauf 158 ms. Der Test ist als
`sweep2.mjs`-Äquivalent Teil des Abnahmeprotokolls.

### 8.3 2-opt-Lokalität

Für alle drei Referenznetze meldet die Politur `radius = 2`: die 1-opt- **und** die
2-opt-Nachbarschaft wurden vollständig durchsucht, ohne eine zulässige Verbesserung zu finden.
Das ist eine **hinreichende Zulässigkeits- und Lokalitätsaussage**, keine globale Optimalität —
diese wird für das gekoppelte Problem nicht behauptet (und ist mit dem linearen B&B auch nicht
beweisbar, §3.3).

### 8.4 Duale Schranke und Schattenpreis

* KKT-Residuum $c_ea_e^2/(b_e\Lambda_e)=1{,}000$ auf allen Kanten.
* Numerischer Schattenpreis $-14777{,}1$ g/V gegen $-\sum\lambda=-14815{,}9$ g/V
  ($0{,}26\,\%$ Abweichung, endliche Differenz).

### 8.5 Numerische Restfehler

* MNA: $\|\Delta u\|_\infty<10^{-9}$ V (Abbruchkriterium), Iterationen 7–9, Restresiduum $<8{,}4\cdot10^{-10}$ V.
* Thermik: Restfehler $5{,}6\cdot10^{-5}\ldots7{,}8\cdot10^{-5}$ K, Kontraktion $0{,}300$–$0{,}302$.

### 8.6 Geometrie- und Routing-Audit

Headless (jsdom, **gerenderte SVG-Pfade** statt Layout-Interna): 0 Kartenkollisionen,
0 Labelkollisionen, 0 Leitungskreuzungen in allen drei Szenarien.

Zusätzlich randomisierter Stresstest über `window.__route(network)`:
**144/144 zufällige Bäume kreuzungsfrei** (2–6 Ebenen, bis 80 Kanten, 1–15 Spuren, 0 Jogs).
Der eingebaute Selbsttest (§5.7) meldet **160/160 kreuzungsfrei, 126/160 spurenminimal,
160/160 auch in der Rückleiterklasse kollisionsfrei** und bestätigt für alle drei Referenznetze
$T=\omega$ (§5.6). Die Rückleitergeometrie (§5.8) wird mitgeprüft; ein externer Abgleich der
gerenderten `<path class="return-line">`-Daten gegen alle Zuleitungen und Knotenkarten liefert
für alle drei Netze ebenfalls 0 Treffer.
Der Stresstest deckte zwei echte Router-Fehler auf, die im Festnetz nicht sichtbar waren:
vertikal kollineare Stichleitungen (Port auf fremder Klemme) und ein Spurenband, das bei
$T>8$ den festen Ebenenabstand sprengte und Stichleitungen rückwärts laufen ließ. Beide sind
behoben (§5.2, §5.4) — der zweite durch das Zwei-Pass-Layout.

### 8.7 DOM-Assertions

Für jedes Szenario werden geprüft: 6 KPI-Kacheln, Knoten-/Kantenzahl im SVG und in den
Tabellen, $\ge1$ Flag, 4 KKT-Karten, 10 Solver-Zellen, Status-Pill, keine Konsolenfehler.
Ergebnis: **alle Prüfungen bestanden**.

---

## 9 Grenzen und Deklarationen

**Modellwerte (UNVERIFIED, im UI markiert):**

* Belastbarkeit für 95 und 120 mm² ($207$ / $239$ A) — aus dem Trend der VDE-Reihe extrapoliert.
* Abschaltzeiten $t_{2x}$ der Bauformen (ATO 0,35 s … ANL 2,0 s) — Modellparameter, keine
  Datenblattwerte.
* Gesamt-I²t-Faktor $1{,}25$ — konservativer Aufschlag auf den Vorlichtbogenwert.

**Bewußte Vereinfachungen:**

* Stationäres thermisches Modell (keine Wärmekapazität, kein Transientenverlauf).
* Routing: zwei orthogonale Richtungen ohne Vias; Kanten verbinden benachbarte Ebenen. Die
  Kreuzungsfreiheit ist für Bäume konstruktiv garantiert (§5.1/§5.3), nicht für beliebige
  Graphen mit Zyklen oder mehrfachen Kanten zwischen zwei Ebenen.
* Labelkästen werden auf Kollision geprüft, aber nicht als Routing-Hindernisse behandelt.
* Keine Wechselstromanteile, keine Induktivitäten (12-V-DC-Netz).
* Leitungsinduktivität und EMV-Kopplung sind nicht modelliert.
* Der B&B ist bei $m>12$ nicht mehr in Echtzeit garantierbar (Knotenlimit 60 000, Zeitlimit
  500 ms, dann `proven=false`).

**Nicht-Ziele:** Kabelbaumgeometrie im 3D-Raum, Bündelungswärmestau über die reine
$f_H$-Tabelle hinaus, Batterie-Alterung, 230-V-AC-Kreise, PV-Ertragsrechnung, Batteriechemie,
Stückliste und Export — diese Punkte deckt der Referenzplaner ab (§6.7) und sie werden hier
bewußt **nicht** beansprucht.

---

## 10 Reproduzierbarkeit

Teil B öffnen: `docs/research/kkt-routing-engine/index.html` (kein Server, kein Build).

Die Referenzimplementierung ist eine **einzige** HTML-Datei ohne Build-Schritt; alle Zahlen
dieser Schrift werden zur Laufzeit aus derselben Engine erzeugt, die auch die Oberfläche
speist. Es gibt keine hartkodierten Ergebnisse — die Tabellen in §6 und §7 sind aus dem
jeweiligen Lauf abgeschrieben.

**Konsistenzregel:** Jede Zahl in dieser Schrift ist mit der Engine reproduzierbar; jede
Änderung an Modellkonstanten macht sie ungültig und erfordert eine Neuerzeugung.
