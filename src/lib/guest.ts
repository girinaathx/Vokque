import type { UIMessage } from "ai";

export const GUEST_CHAT_LIMIT = 10;
const KEY = "avenxa:guest";
const FLAG = "avenxa:guest-active";

export type GuestChat = {
  id: string;
  title: string;
  createdAt: string;
  messages: UIMessage[];
};

function read(): GuestChat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as GuestChat[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(chats: GuestChat[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(chats));
  } catch {
    /* quota / private mode — guest data is best-effort */
  }
}

export const guestStore = {
  list: read,
  get(id: string) {
    return read().find((c) => c.id === id) ?? null;
  },
  create(title = "New conversation"): GuestChat | null {
    const chats = read();
    if (chats.length >= GUEST_CHAT_LIMIT) return null;
    const chat: GuestChat = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `g-${Date.now()}`,
      title,
      createdAt: new Date().toISOString(),
      messages: [],
    };
    write([chat, ...chats]);
    return chat;
  },
  save(id: string, messages: UIMessage[]) {
    const chats = read();
    const idx = chats.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const firstUser = messages.find((m) => m.role === "user");
    const text =
      firstUser?.parts.map((p) => (p.type === "text" ? p.text : "")).join("") ??
      "";
    chats[idx] = {
      ...chats[idx],
      messages,
      title:
        chats[idx].title === "New conversation" && text
          ? text.slice(0, 60)
          : chats[idx].title,
    };
    write(chats);
  },
  remove(id: string) {
    write(read().filter((c) => c.id !== id));
  },
  clear() {
    try {
      window.localStorage.removeItem(KEY);
      window.localStorage.removeItem(FLAG);
    } catch {
      /* noop */
    }
  },
  activate() {
    try {
      window.localStorage.setItem(FLAG, "1");
    } catch {
      /* noop */
    }
  },
  isActive() {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(FLAG) === "1";
    } catch {
      return false;
    }
  },
  remaining() {
    return Math.max(0, GUEST_CHAT_LIMIT - read().length);
  },
};
