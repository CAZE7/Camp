import Chat from "@/components/Chat";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function KiAssistent() {
  return (
    <main className="h-screen w-full flex flex-col relative">
      <div className="p-4 border-b border-border">
        <Link href="/">
          <Button variant="outline">← Zurück</Button>
        </Link>
      </div>
      <Chat defaultOpen />
    </main>
  );
}
