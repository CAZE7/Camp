import { CHAT_API_URL_ENV } from './constants';

/** Ehrlicher Hinweis, wenn der statische Export keinen Chat-Endpunkt hat. */
export default function ChatUnavailable() {
  return (
    <div
      role="status"
      className="flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-6 text-center"
    >
      <p className="font-medium text-ink">Kein Assistent konfiguriert</p>
      <p className="text-sm text-muted-foreground">
        Dieser Planer läuft als statischer Export und bringt keine Server-Route mit: Es gibt hier kein{' '}
        <code>/api/chat</code>, ein Eingabefeld würde ins Leere senden.
      </p>
      <p className="text-sm text-muted-foreground">
        Für einen externen Assistenten beim Build <code>{CHAT_API_URL_ENV}</code> auf den Endpunkt setzen
        (Vorlage: <code>.env.example</code>).
      </p>
    </div>
  );
}
