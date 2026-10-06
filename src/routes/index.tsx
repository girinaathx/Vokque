import { createFileRoute } from "@tanstack/react-router";
import { GuestChatExperience } from "@/components/app/GuestChatExperience";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vokque — Your Everyday AI Assistant" },
      {
        name: "description",
        content:
          "Vokque is a premium AI assistant by Vokque Technology for study, work, math, code, and everyday questions.",
      },
      { property: "og:title", content: "Vokque — Your Everyday AI Assistant" },
      {
        property: "og:description",
        content:
          "A premium AI assistant for study, work, math, code, and everyday questions.",
      },
      { property: "og:url", content: "https://feyncloud.lovable.app/" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://feyncloud.lovable.app/" }],
  }),
  component: GuestChatExperience,
});
