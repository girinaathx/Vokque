import { createFileRoute } from "@tanstack/react-router";
import { GuestChatExperience } from "@/components/app/GuestChatExperience";

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
  component: GuestChatExperience,
});
