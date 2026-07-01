import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app/AppShell";
import { ChatWindow } from "@/components/app/ChatWindow";
import { getThreadMessages } from "@/lib/threads.functions";
import type { UIMessage } from "ai";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Chat · FeynCloud" },
      {
        name: "description",
        content: "Chat with your premium AI companion.",
      },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { threadId } = Route.useParams();
  const fetchMsgs = useServerFn(getThreadMessages);

  const { data, isLoading } = useQuery({
    queryKey: ["messages", threadId],
    queryFn: () => fetchMsgs({ data: { threadId } }),
  });

  return (
    <AppShell activeThreadId={threadId}>
      {isLoading ? (
        <div className="flex h-[100dvh] items-center justify-center">
          <div className="animate-pulse-glow">
            <Logo size={40} glow />
          </div>
        </div>
      ) : (
        <ChatWindow
          key={threadId}
          threadId={threadId}
          initialMessages={(data ?? []) as unknown as UIMessage[]}
        />
      )}
    </AppShell>
  );
}
