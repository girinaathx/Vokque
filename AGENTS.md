# Project Rules

- Shared guest chat UI lives in `src/components/app/GuestChatExperience.tsx` so `/` and `/guest` stay behaviorally identical without importing route modules.
- Express shared surface colors and glass treatments through global semantic tokens so all existing screens inherit the same palette.
- Keep theme selection in a shared browser-store hook and apply the saved class before hydration to prevent flashes across routes.
