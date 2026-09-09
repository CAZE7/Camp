# ADR 0021 — KI-Assistent und `/api/chat` im statischen Export

**Status:** akzeptiert · **Datum:** 2026-09-10 ·
**Bezug:** ADR 0001, ARCH-001 (KNOWN-PROBLEMS)

## Kontext

ADR 0001 entschied: kein Backend, `output: 'export'`, keine `/api/*`-Routen.
Tatsächlich liegen im Baum:

| Datei                        | Befund                                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `app/api/chat/route.ts`      | optionaler Route Handler für ein separates Server-Deployment; der Static Export erzeugt keine `/api/chat`-Datei |
| `out/api`                    | **existiert nicht** (nach `npm run build` geprüft)                                                              |
| `app/ki-assistent/page.tsx`  | wird statisch gebaut (`○`) und rendert `<Chat defaultOpen />`                                                   |
| `components/Chat.tsx`        | nutzt ausschließlich `NEXT_PUBLIC_CHAT_API_URL`; ohne Wert zeigt es einen klaren Konfigurationshinweis          |
| `lib/db.ts`                  | wird nur vom optionalen Server-Route-/Seed-Pfad verwendet und nicht in den Static Export geladen                |
| `.env.example`               | dokumentiert `NEXT_PUBLIC_CHAT_API_URL` und den optionalen Client-Token                                         |
| `app/api/chat/route.test.ts` | Unit-Tests für den optionalen Server-Handler; sie behaupten nicht, dass der Static Export eine API ausliefert   |

Der Client verlangt für einen statischen Build einen expliziten externen Endpunkt.
Ohne gesetzte Variable zeigt `/ki-assistent` einen sichtbaren Konfigurationshinweis und
kein Eingabefeld, das gegen eine nicht ausgelieferte `/api/chat`-Route sendet.

## Problem

1. **Betriebsgrenze:** Der optionale Route-Handler ist bei einem Static Export nicht Teil
   des ausgelieferten Artefakts und darf nicht als lokale API vorausgesetzt werden.
2. **Testgrenze:** Die Route-Tests prüfen den separaten Server-Handler, nicht das Static-Export-Artefakt.
3. **Konfiguration:** Ein externer Endpoint muss beim Build explizit gesetzt werden.

## Entscheidung

1. **ADR 0001 bleibt gültig.** Der Static Export enthält keinen Server-Endpunkt.
   `app/api/chat/route.ts` und `lib/db.ts` sind ausschließlich für ein separates,
   nicht-statisch gebautes Deployment vorgesehen und werden dort separat betrieben.
2. **Der Chat-Client ist ein optionaler externer Dienst.** `NEXT_PUBLIC_CHAT_API_URL`
   ist die einzige unterstützte Konfiguration. Fehlt der Wert, zeigt `/ki-assistent`
   einen klaren Hinweis („kein Assistent konfiguriert“) statt eines Eingabefelds,
   das ins Leere sendet.
3. **`.env.example` dokumentiert die Variable** (optional, nur für den Assistenten) —
   damit die Aussage „keine Env nötig“ nicht länger im Widerspruch zum Code steht.

Die Entscheidung ist umgesetzt: Static Export und optionaler externer Chat sind getrennt;
fehlende Konfiguration wird im UI ehrlich angezeigt.

## Konsequenzen

**Gut**

- Der Widerspruch zwischen ADR 0001 und dem Baum ist benannt und entscheidbar.
- Der Static Export bleibt backend-frei.
- Der Nutzer sieht im Produkt ehrlich, ob ein Assistent verfügbar ist.
- Ein separates Server-Deployment kann den vorhandenen Handler weiterhin betreiben.

**Schlecht / Preis**

- Ohne externen Endpunkt ist der Assistent bewusst nicht aktiv; die Seite bleibt als
  erklärender Konfigurationsstatus erreichbar.
- Der optionale Server-Handler benötigt weiterhin eine separat betriebene Runtime
  und seine eigenen Secrets (`OPENAI_API_KEY`, `DATABASE_URL`).

## Alternativen

- **Route separat betreiben:** akzeptierte Option; der Static Export wird über
  `NEXT_PUBLIC_CHAT_API_URL` angebunden, ohne `/api/chat` lokal vorauszusetzen.
- **Route entfernen:** bleibt eine mögliche spätere Bereinigung, falls kein separates
  Server-Deployment mehr benötigt wird.
- **Assistent clientseitig ohne Server** (z. B. rein lokale Heuristik): widerspricht
  dem Zweck (Modellaufruf) und würde Nutzern eine Antwortkompetenz vortäuschen,
  die das Werkzeug nicht hat.

## Umsetzungsstatus

- [x] Static Export bleibt backend-frei; `/api/chat` wird nicht in `out/` erzeugt.
- [x] `Chat` verlangt `NEXT_PUBLIC_CHAT_API_URL` und zeigt ohne Wert einen sichtbaren Hinweis.
- [x] `.env.example` dokumentiert Endpoint und optionalen Token.
- [ ] Optionales separates Server-Deployment muss außerhalb dieses Static Exports betrieben werden.
