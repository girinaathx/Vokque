## Backend note (blocker on your first request)

Lovable Cloud can't be removed from an existing project. In-place migration to your own Supabase isn't possible for this project — the only way to end up on self-hosted Supabase is to recreate the project fresh without Cloud enabled. Everything below is done on the current stack, which already uses Supabase Auth under the hood; email/password + session persistence already work correctly.

## 1. FeynCloud branding

- Upload your `h` mark via `lovable-assets` → `src/assets/feyncloud-logo.png.asset.json`.
- Rewrite `src/components/brand/Logo.tsx` to use the new asset. Keep `dark:invert` so the white mark inverts to black on Pure White theme.
- Replace every "Open Intelligence" string across:
  - `src/routes/__root.tsx` (title, meta, OG, twitter)
  - `src/routes/auth.tsx` (titles + subtitle)
  - `src/routes/index.tsx` (landing copy)
  - `src/components/app/AppShell.tsx` (sidebar + mobile bar wordmark, "Your everyday AI" → "FeynCloud")
  - `src/routes/_authenticated/dashboard.tsx`, `settings.tsx`, `memory.tsx`, `privacy.tsx`, `chat.$threadId.tsx`
  - Toast messages, empty states, error page copy
- App title / favicon / apple-touch-icon all switch to the new logo via `logoUrl`.
- About section in Settings → single line: **"FeynCloud is created by FeynCloud Technology."**

## 2. Auth — remove Google, keep email/password

- Delete the Google button, `handleGoogle`, `oauthLoading`, and `GoogleIcon` from `src/routes/auth.tsx`; drop the `import { lovable }`.
- Keep `supabase.auth.signInWithPassword` / `signUp` flow as-is.
- Add a "Forgot password?" link → new public route `src/routes/reset-password.tsx` (session-hash handler that calls `supabase.auth.updateUser({ password })`). Add a `/forgot-password` route that calls `resetPasswordForEmail` with `redirectTo: origin + "/reset-password"`.

## 3. i18n — 21 languages, full UI strings

- Add deps: `i18next`, `react-i18next`, `i18next-browser-languagedetector`.
- New `src/lib/i18n.ts` initializing i18next with resources for all 21 languages (en, ta, hi, te, ml, kn, bn, mr, gu, pa, ur, ar, fr, de, es, pt, it, ru, ja, ko, zh). Persist choice in `localStorage` key `feyncloud:lang`. Set `<html lang>` + `dir="rtl"` for `ar`, `ur`.
- Create `src/locales/<lang>/common.json` files. English is fully authored; the other 20 files ship with the same key structure so the switcher works instantly — untranslated keys fall back to English via i18next's `fallbackLng: "en"`. Priority translations filled by hand: Hindi, Tamil, Spanish, Arabic. Others start as English copies (safe fallback) and can be filled incrementally without another code change.
- Replace hard-coded UI strings with `t("…")` across: `AppShell`, `auth`, `settings`, `dashboard`, `memory`, `privacy`, `ChatWindow` empty state / composer placeholder / toasts, root 404 + error boundary, About.
- Wrap `<Outlet />` in `__root.tsx` with `<I18nextProvider>`. Import `i18n.ts` for its side-effect init.
- Add a language `<select>` in Settings → General → Language listing all 21 languages with native names.

## 4. Themes — System / AMOLED Dark / Pure White

- `src/lib/theme.tsx` already supports `light | dark | system`. Keep the API, relabel "Light" → "Pure White" and "Dark" → "AMOLED Dark" in the Appearance section.
- `src/styles.css`:
  - Confirm `.dark` uses `#000` background + `#fff` foreground (already true).
  - Remove the light-mode `body::before` aurora and any pastel gradients so Pure White stays truly white (`#FFFFFF`, no tint). Keep `.dark body::before { display:none }`.
  - `--glass` in light becomes solid `rgba(255,255,255,1)` for the Pure White look; borders `rgba(0,0,0,0.06)`. `.dark` keeps matte black.
  - Remove residual reflective utilities (`glass-bubble-user`, `glass-bubble-ai`, `liquid-shine*`) that aren't used after the chat rework.
- `Logo.tsx`: keep `dark:invert` so the white `h` inverts to black on Pure White.

## 5. Chat — remove bubbles, typography only

In `src/components/app/ChatWindow.tsx`:
- Drop the `chat-bubble` / `chat-bubble-user` / `chat-bubble-ai` classes on messages. Render user text right-aligned, AI text left-aligned, both directly on background — no bg, no border, no shadow, no radius.
- Keep only the fade-up animation. Remove chat-appearance-driven bubble variables (still leave `ChatAppearanceProvider` in the tree; just stop using bubble classes so nothing breaks).
- Remove `src/components/settings/ChatAppearanceSection.tsx` bubble-color controls (or reduce it to font-size + density) — since we're going bubble-less, remove the entire section from Settings → General.
- Ensure markdown renderer keeps code blocks, tables, lists, headings, math (already via `react-markdown`; verify `remark-gfm` + `rehype-katex`; add if missing).

## 6. Composer — ChatGPT-style, fixed to bottom

Rework the composer inside `ChatWindow.tsx`:
- Container: `position: fixed; bottom: 0; left: 0; right: 0;` with `padding-bottom: env(safe-area-inset-bottom)`. On desktop it stays inside the flex column at max-width 3xl and pinned via `sticky bottom-0`.
- Textarea:
  - `rows={1}` initial slim height.
  - Auto-grow via `useLayoutEffect`: reset `height = 'auto'`, then `height = min(scrollHeight, 8 lines)`.
  - `overflow-y: auto` only when the 8-line cap is hit.
  - `white-space: pre-wrap; overflow-x: hidden; resize: none;` so text always wraps, cursor stays visible, no horizontal scroll.
- Buttons (attach, image, mic, send) stay bottom-aligned with `items-end` and don't jump when the textarea grows.
- Transcript container gets `padding-bottom` equal to composer height + safe-area (measure with a `ResizeObserver` and set a CSS var) so the last message is never covered when the keyboard opens.
- Mobile keyboard stability: use `100dvh`, avoid layout jumps by keeping the composer in the fixed layer (not inside the scrolling transcript).

## 7. Settings shell — professional layout

Extend `src/routes/_authenticated/settings.tsx` with the full section tree:

**Account**: Profile, Edit Profile (username display name via `profiles` table), Email (read-only from `auth.users`), Change Password (`supabase.auth.updateUser({ password })`), Two-Factor Auth (link to Supabase MFA flow), Linked Accounts, Export My Data (JSON download via server fn), Download Chat History (JSON of threads+messages), Logout, Delete Account (double-confirm dialog → server fn calling admin `deleteUser`).

**General**: Language (switcher from §3), Notifications, Chat Settings (font size, density), Voice Settings (dictation language), Accessibility (reduce motion, larger text), Privacy (link to policy), Security (session list), Data Controls (memory retention), Storage (cache size + Clear Cache), Auto Save toggle, Clear Cache button.

Sections that need backend (Delete Account, Export, 2FA, session list) get created as `src/lib/account.functions.ts` server fns using `requireSupabaseAuth`; a matching migration adds a `profiles` table with `username`, `display_name` + auto-create trigger, GRANTs, RLS.

## 8. File list

**New**
- `src/lib/i18n.ts`
- `src/locales/{en,ta,hi,te,ml,kn,bn,mr,gu,pa,ur,ar,fr,de,es,pt,it,ru,ja,ko,zh}/common.json`
- `src/lib/account.functions.ts`
- `src/routes/reset-password.tsx`, `src/routes/forgot-password.tsx`
- `src/components/settings/{AccountSection,GeneralSection,LanguageSection,AppearanceSection,DangerZone}.tsx`
- `src/assets/feyncloud-logo.png.asset.json`
- Migration: `profiles` table + trigger

**Edited**
- `src/routes/__root.tsx` — title/meta/OG to FeynCloud, add I18nextProvider
- `src/routes/auth.tsx` — remove Google
- `src/routes/_authenticated/{settings,dashboard,memory,privacy,chat.$threadId}.tsx` — copy + t()
- `src/components/app/AppShell.tsx` — logo/wordmark + t()
- `src/components/app/ChatWindow.tsx` — bubble removal + composer rebuild + t()
- `src/components/brand/Logo.tsx` — new asset
- `src/styles.css` — Pure White pass, remove aurora, remove unused reflective utilities
- `src/components/settings/ChatAppearanceSection.tsx` — remove or reduce

**Removed usage**
- `import { lovable } from "@/integrations/lovable"` from `auth.tsx` (file itself stays; it's auto-managed)

## 9. Verification

- Playwright smoke on `/auth` (sign in), `/dashboard`, `/chat/…` in both themes at 375×812 and 1440×900.
- Confirm composer stays fixed, grows to 8 lines then scrolls, and last message is not covered on mobile.
- Toggle language to Hindi + Arabic; verify RTL flip on Arabic and native-name label.
- Sign out / sign in cycle to confirm session persistence.
