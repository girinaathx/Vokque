# Vokque premium refinement

## Goal
Refine the existing Vokque app in place, preserving its current authentication, AI, files, images, voice, storage, and conversation data.

## Implementation
1. **Themes and visual system**
   - Remove the city wallpaper and replace the global color system with exactly two semantic themes: clean white light mode and midnight/near-black dark mode.
   - Restore a system-aware first visit, saved preference thereafter, and an inline startup script that applies the theme before the page paints.
   - Add a compact accessible theme control in Settings and the existing menu, then make controls, dialogs, menus, sidebars, chat, and pages use semantic theme colors consistently.
   - Rework existing glass utilities into restrained, theme-aware surfaces used only on interactive controls and overlays.

2. **Home and motion identity**
   - Keep the existing Vokque logo asset as the single centered home brand signal and remove any competing large wordmark.
   - Add a lightweight CSS/SVG blue atmospheric animation only in the empty home state, with a restrained light-mode version, reduced-motion fallback, and visibility-aware pausing.
   - Preserve the existing composer, voice, attachment, file, and navigation behavior while tightening spacing and responsive sizing.

3. **Sidebar and conversation management**
   - Repair desktop/sidebar geometry and mobile drawer behavior so the conversation area never overlaps or scrolls horizontally.
   - Keep the virtualized list and restore a visible, touch-friendly three-dot menu per chat with rename, pin/unpin, archive, and confirmed delete.
   - Add scroll-safe mobile long-press to open the same menu, with correct stacking and outside-click dismissal.
   - Use optimistic cache updates with rollback for pin, rename, archive, and delete, while keeping the backend as source of truth.

4. **Authentication and persistence**
   - Keep the managed Google provider and public callback target; remove duplicate-request/redirect-loop opportunities and improve cancelled/failed sign-in states.
   - Verify provider configuration and callback logs once the hosted backend is active; do not weaken auth or expose credentials.
   - Tighten thread/message cache invalidation, save ordering, idempotency, immediate sidebar updates, and network/session failure handling without changing schemas unless evidence requires it.

5. **AI responsiveness**
   - Preserve the current model, system prompt, tools, image generation, and file pipeline.
   - Confirm progressive streaming and stop-generation behavior, prevent duplicate sends, reduce avoidable rerenders, and retain virtualization/lazy behavior for long histories.
   - Keep clear loading, rate-limit, network, and save-failure feedback without leaking internal errors.

6. **Verification**
   - Check build diagnostics and browser console/network output.
   - Exercise signed-out and authenticated flows on phone, tablet, and desktop: themes, home logo/motion, Google login, create/send/refresh, rename, pin/unpin, delete/refresh, long-press, file/image presentation, and stop generation.
   - The hosted backend is currently paused, so authenticated end-to-end verification will resume after it becomes active; any provider-side blocker will be reported precisely rather than called fixed.

## Technical details
- Continue using the existing TanStack routes, React Query cache, protected server functions, managed auth helper, AI SDK streaming transport, and current database policies.
- No new visual or animation dependency is planned; use semantic CSS tokens and lightweight CSS/SVG animation.
- No API, provider, schema, storage bucket, account, or conversation migration will be replaced.
