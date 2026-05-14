import { ChatShell } from "@/components/chat/chat-shell";

export default function WorkspacePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,_rgba(255,190,92,0.14),_transparent_24%),radial-gradient(circle_at_88%_12%,_rgba(120,182,255,0.1),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.22),_transparent_26%)]" />
      <ChatShell />
    </main>
  );
}
