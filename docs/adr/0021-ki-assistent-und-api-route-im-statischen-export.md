# ADR 0021 — KI-Assistent und `/api/chat` im statischen Export

**Status:** vorgeschlagen (Entscheidung offen) · **Datum:** 2026-09-09 ·
**Bezug:** ADR 0001, ARCH-001 (KNOWN-PROBLEMS)

## Kontext

ADR 0001 entschied: kein Backend, `output: 'export'`, keine `/api/*`-Routen.
Tatsächlich liegen im Baum:

| Datei                                     | Befund                                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `app/api/chat/route.ts` (422 Zeilen)      | Route Handler; der Build weist sie als **`ƒ` (Dynamic, server-rendered on demand)** aus — sie wird beim Export **nicht** erzeugt |
| `out/api`                                 | **existiert nicht** (nach `npm run build` geprüft)                                                                               |
| `app/ki-assistent/page.tsx`               | wird statisch gebaut (`○`) und rendert `<Chat defaultOpen />`                                                                    |
| `components/Chat.tsx`                     | postet gegen `process.env.NEXT_PUBLIC_CHAT_API_URL \|\| '/api/chat'`                                                             |
| `lib/db.ts`                               | `new Pool()` aus `pg`; `DATABASE_URL` optional — ohne Wert greifen die `pg`-Defaults (lokaler Socket)                            |
| `.env.example`                            | „No environment variables are required for the static export“ — `NEXT_PUBLIC_CHAT_API_URL` ist **nicht** dokumentiert            |
| `app/api/chat/route.test.ts` (578 Zeilen) | vollständig gemockt (`pg`, AI-SDK) — grün, aber ohne Bezug zum ausgelieferten Artefakt                                           |

Der Kommentar in `components/Chat.tsx` sagt es selbst: ein externer Endpunkt ist
„erforderlich, wenn die App per `output: 'export'` statisch gehostet wird“.
Ohne gesetzte Variable läuft die Seite `/ki-assistent` im Produkt ins Leere
(404 auf `/api/chat`) — sie sieht funktionsfähig aus und ist es nicht.

## Problem

1. **Widerspruch zu ADR 0001:** Server-Code (Route + Postgres-Pool) in einem Baum,
   der als statisches Artefakt ausgeliefert wird.
2. **Scheinbare Sicherheit:** 578 Testzeilen gegen Mocks beweisen nicht, dass der
   Assistent im Produkt funktioniert — sie können einen toten Pfad dauerhaft grün halten.
3. **Abhängigkeit ohne Dokumentation:** `pg` und AI-SDK im Dependency-Baum, aber
   `.env.example` behauptet, es werde keine Konfiguration benötigt.

## Entscheidung (Vorschlag)

1. **ADR 0001 bleibt gültig.** Im exportierten Baum liegt kein Server-Code. Die
   Route `app/api/chat/route.ts` und `lib/db.ts` (Postgres) gehören nicht in dieses
   Repository, es sei denn, es gibt ein separates, nicht-statisch gebautes Deployment,
   das sie hält — dann in ein eigenes Verzeichnis mit eigener README.
2. **Der Chat-Client ist ein optionaler externer Dienst.** `NEXT_PUBLIC_CHAT_API_URL`
   ist die einzige unterstützte Konfiguration. Fehlt der Wert, zeigt `/ki-assistent`
   einen klaren Hinweis („kein Assistent konfiguriert“) statt eines Eingabefelds,
   das ins Leere sendet.
3. **`.env.example` dokumentiert die Variable** (optional, nur für den Assistenten) —
   damit die Aussage „keine Env nötig“ nicht länger im Widerspruch zum Code steht.

Die Umsetzung von 1. und 2. ist eine Produktentscheidung und braucht Freigabe;
Punkt 3 ist Dokumentation und wird mit diesem ADR mitgeliefert.

## Konsequenzen

**Gut**

- Der Widerspruch zwischen ADR 0001 und dem Baum ist benannt und entscheidbar.
- `pg` und die AI-SDK-Abhängigkeit können entfallen, wenn die Route entfernt wird
  (kleineres Bundle, weniger Angriffsfläche).
- Der Nutzer sieht im Produkt ehrlich, ob ein Assistent verfügbar ist.

**Schlecht / Preis**

- Ohne externen Endpunkt verliert `/ki-assistent` seine Funktion — die Seite muss
  dann entweder entfallen oder zum Hinweis werden.
- `app/api/chat/route.test.ts` (578 Zeilen) würde mit der Route entfallen; das ist
  kein Testverlust im Sinne der Projektregeln (die Tests prüfen Mock-Verhalten,
  kein ausgeliefertes Verhalten), muss aber bewusst entschieden werden.

## Alternativen

- **Route behalten, Deployment zweigleisig** (Pages-Export + separate Node-Instanz
  für `/api/chat`, angebunden über `NEXT_PUBLIC_CHAT_API_URL`): funktional, aber
  zwei Betriebsarten und eine Dokumentationspflicht, die heute fehlt.
- **Alles beim Alten lassen:** der Widerspruch bleibt; Agenten und Mitarbeitende
  behandeln den Assistenten weiter als vorhandenes Feature. Abgelehnt als
  Dauerzustand — aber als Übergang zulässig, solange Punkt 3 dokumentiert ist.
- **Assistent clientseitig ohne Server** (z. B. rein lokale Heuristik): widerspricht
  dem Zweck (Modellaufruf) und würde Nutzern eine Antwortkompetenz vortäuschen,
  die das Werkzeug nicht hat.

## Offene Punkte (Entscheidung durch den Nutzer)

- [ ] Soll der KI-Assistent Produktbestandteil bleiben? Wenn ja: externer Endpunkt
      benennen und `NEXT_PUBLIC_CHAT_API_URL` setzen.
- [ ] Wenn nein: `app/ki-assistent/`, `components/Chat.tsx`, `app/api/chat/`,
      `lib/db.ts` und die zugehörigen Tests entfernen (eigener PR).
