import ChatWindow from './ChatWindow';
import ChatUnavailable from './ChatUnavailable';

/** Small static-export fallback; avoids loading the AI SDK without an endpoint. */
export default function ChatUnavailablePanel() {
  return (
    <ChatWindow defaultOpen>
      <ChatUnavailable />
    </ChatWindow>
  );
}
