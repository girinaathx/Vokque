import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { AriaVoice } from "@/components/voice/AriaVoice";

export const Route = createFileRoute("/_authenticated/voice")({
  component: VoicePage,
  head: () => ({
    meta: [
      { title: "Aria — Voice Assistant" },
      {
        name: "description",
        content:
          "Talk to Aria, your premium AI voice assistant. Speak naturally and get instant, intelligent replies.",
      },
    ],
  }),
});

function VoicePage() {
  return (
    <AppShell>
      <AriaVoice />
    </AppShell>
  );
}
