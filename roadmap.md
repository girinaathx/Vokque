# Vokque production cleanup roadmap

## Current focused sakura refresh
- [x] Update shared palette, glass controls, and brand contrast without changing backend behavior.
- [x] Add writing, image-prompt, and file shortcuts to empty chats.
- [x] Verify home shortcuts and mobile layout: writing/image drafts, file chooser, drawer, no overflow or browser errors.

- [ ] Enforce one permanent black-and-white dark theme and remove all theme controls/code.
- [ ] Make `/` open directly into the guest-capable chat experience with no splash delay.
- [ ] Keep one responsive slide-out menu on desktop and mobile; remove the persistent sidebar.
- [ ] Harden conversation ownership, optimistic management, persistence, and streaming failure handling.
- [ ] Repair and verify email/Google authentication, redirects, sessions, and logout behavior.
- [ ] Audit every route, menu destination, image-generation state, and user-facing error.
- [ ] Validate desktop, tablet, and small-mobile layouts plus console/network health.
