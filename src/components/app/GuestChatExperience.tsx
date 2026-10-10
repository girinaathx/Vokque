import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { UIMessage } from "ai";
import { Menu, MessageSquare, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ChatWindow } from "@/components/app/ChatWindow";
import { Logo } from "@/components/brand/Logo";
import { guestStore, GUEST_CHAT_LIMIT, type GuestChat } from "@/lib/guest";
import { cn } from "@/lib/utils";

export function GuestChatExperience() {
  const [chats, setChats] = useState<GuestChat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    guestStore.activate();
    let list = guestStore.list();
    if (list.length === 0) {
      guestStore.create();
      list = guestStore.list();
    }
    setChats(list);
    setActiveId(list[0]?.id ?? null);
  }, []);

  const newChat = () => {
    const created = guestStore.create();
    if (!created) {
      toast.error(`Guest mode is limited to ${GUEST_CHAT_LIMIT} conversations. Sign in to continue.`);
      return;
    }
    setChats(guestStore.list());
    setActiveId(created.id);
    setMenuOpen(false);
  };

  const removeChat = (id: string) => {
    if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
    guestStore.remove(id);
    const list = guestStore.list();
    setChats(list);
    if (activeId === id) setActiveId(list[0]?.id ?? null);
  };

  const handleMessages = useCallback((messages: UIMessage[]) => {
    if (!activeId) return;
    guestStore.save(activeId, messages);
    setChats(guestStore.list());
  }, [activeId]);

  const active = chats.find((chat) => chat.id === activeId) ?? null;

  return (
    <div className="relative flex h-[100dvh] min-w-0 overflow-hidden bg-background">
      {menuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-background/70"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[min(86vw,340px)] flex-col border-r border-border bg-background p-4 transition-transform duration-200", menuOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center gap-2 border-b border-border pb-4">
          <Logo size={24} />
          <span className="text-sm font-semibold">Vokque</span>
          <button type="button" onClick={newChat} className="ml-auto flex h-10 w-10 items-center justify-center rounded-full border border-border" aria-label="New chat"><Plus className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          <p className="px-2 text-[11px] font-medium uppercase text-muted-foreground">Chat history</p>
          <div className="mt-2 space-y-1">
            {chats.map((chat) => (
              <div key={chat.id} className={cn("flex items-center rounded-md", chat.id === activeId && "bg-secondary")}>
                <button type="button" onClick={() => { setActiveId(chat.id); setMenuOpen(false); }} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-left text-sm"><MessageSquare className="h-4 w-4 shrink-0" /><span className="truncate">{chat.title}</span></button>
                <button type="button" onClick={() => removeChat(chat.id)} className="mr-1 flex h-10 w-10 items-center justify-center" aria-label="Delete chat"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
        <Link to="/auth" className="mt-4 flex min-h-11 items-center justify-center rounded-md border border-foreground bg-foreground px-4 text-sm font-medium text-background">Sign in to save across devices</Link>
      </aside>

      <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex h-16 items-center px-3 [padding-top:env(safe-area-inset-top,0px)]">
        <button type="button" onClick={() => setMenuOpen(true)} className="glass pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2"><Logo size={26} /><span className="text-sm font-semibold">Vokque</span></div>
        <button type="button" onClick={newChat} aria-label="New chat" className="glass pointer-events-auto ml-auto flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium"><Plus className="h-4 w-4" /><span className="hidden sm:inline">New Chat</span></button>
      </header>

      <main className="min-w-0 flex-1">
        {active ? <ChatWindow key={active.id} threadId={active.id} initialMessages={active.messages} guest onMessagesChange={handleMessages} /> : <div className="flex h-full items-center justify-center px-6 text-center"><div><Logo className="mx-auto" size={40} /><p className="mt-4 text-sm text-muted-foreground">Sign in to continue chatting.</p><Link to="/auth" className="mt-4 inline-flex min-h-11 items-center rounded-full border border-foreground bg-foreground px-5 text-sm text-background">Sign in</Link></div></div>}
      </main>
    </div>
  );
}