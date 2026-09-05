import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { UIMessage } from "ai";
import { ChatWindow } from "@/components/app/ChatWindow";
import { Logo } from "@/components/brand/Logo";
import { guestStore, GUEST_CHAT_LIMIT, type GuestChat } from "@/lib/guest";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guest")({
  head: () => ({
    meta: [
      { title: "Guest mode · Vokque" },
      {
        name: "description",
        content:
          "Try Vokque without an account. Guest conversations stay on this device.",
      },
      { property: "og:title", content: "Guest mode · Vokque" },
      {
        property: "og:description",
        content: "Try Vokque without an account — up to 10 local chats.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GuestPage,
});

function GuestPage() {
  const [chats, setChats] = useState<GuestChat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    guestStore.activate();
    let list = guestStore.list();
    if (list.length === 0) {
      guestStore.create();
      list = guestStore.list();
    }
    setChats(list);
    setActiveId(list[0]?.id ?? null);
    setReady(true);
  }, []);

  const newChat = () => {
    const created = guestStore.create();
    if (!created) {
      toast.error(
        `Guest mode is limited to ${GUEST_CHAT_LIMIT} conversations. Create a free account to continue.`,
      );
      return;
    }
    setChats(guestStore.list());
    setActiveId(created.id);
  };

  const removeChat = (id: string) => {
    guestStore.remove(id);
    const list = guestStore.list();
    setChats(list);
    if (activeId === id) setActiveId(list[0]?.id ?? null);
  };

  const handleMessages = useCallback(
    (messages: UIMessage[]) => {
      if (!activeId) return;
      guestStore.save(activeId, messages);
      setChats(guestStore.list());
    },
    [activeId],
  );

  const active = chats.find((c) => c.id === activeId) ?? null;

  return (
    <div className="relative flex h-[100dvh] flex-col">
      {/* Floating glass header */}
      <header
        className="pointer-events-none absolute inset-x-0 top-0 z-40 px-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
      >
        <div className="glass pointer-events-auto mx-auto flex w-full max-w-3xl items-center gap-2 rounded-full py-1.5 pr-1.5 pl-3">
          <Logo size={22} />
          <span className="text-[13px] font-semibold tracking-tight">
            Guest
          </span>
          <span className="text-muted-foreground text-[11px]">
            {chats.length}/{GUEST_CHAT_LIMIT}
          </span>
          <div className="flex-1" />
          <button
            onClick={newChat}
            aria-label="New guest chat"
            className="hover:bg-foreground/5 flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90"
          >
            <Plus className="h-4.5 w-4.5" />
          </button>
          <Link
            to="/auth"
            className="bg-primary text-primary-foreground rounded-full px-3.5 py-2 text-[12px] font-medium transition hover:opacity-90"
          >
            Sign in
          </Link>
        </div>

        {chats.length > 1 && (
          <div className="pointer-events-auto mx-auto mt-2 flex w-full max-w-3xl gap-1.5 overflow-x-auto pb-1">
            {chats.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "glass-thin group flex shrink-0 items-center gap-1.5 rounded-full py-1.5 pr-1.5 pl-3 text-[12px] transition",
                  c.id === activeId && "bg-foreground/10",
                )}
              >
                <button
                  onClick={() => setActiveId(c.id)}
                  className="flex max-w-[160px] items-center gap-1.5 truncate"
                >
                  <MessageSquare className="h-3 w-3 shrink-0" />
                  <span className="truncate">{c.title}</span>
                </button>
                <button
                  onClick={() => removeChat(c.id)}
                  aria-label="Delete guest chat"
                  className="hover:bg-foreground/10 flex h-5 w-5 items-center justify-center rounded-full"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </header>

      {ready && active ? (
        <ChatWindow
          key={active.id}
          threadId={active.id}
          initialMessages={active.messages}
          guest
          onMessagesChange={handleMessages}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <div>
            <h1 className="font-display text-xl font-semibold">
              Guest limit reached
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              You&apos;ve used all {GUEST_CHAT_LIMIT} guest conversations.
            </p>
            <Link
              to="/auth"
              className="bg-primary text-primary-foreground mt-5 inline-flex rounded-full px-5 py-2.5 text-sm font-medium"
            >
              Create a free account
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
