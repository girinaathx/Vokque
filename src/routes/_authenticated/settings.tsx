import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { AppShell } from "@/components/app/AppShell";
import { ChatAppearanceSection } from "@/components/settings/ChatAppearanceSection";
import { useTheme, type ThemePref } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Palette,
  Settings as SettingsIcon,
  User,
  Mic,
  Brain,
  MessageSquare,
  ShieldCheck,
  Database,
  HardDrive,
  CreditCard,
  LifeBuoy,
  Info,
  Sun,
  Moon,
  Monitor,
  LogOut,
  ChevronRight,
  Bell,
  Lock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings · FeynCloud" },
      {
        name: "description",
        content: "Manage appearance, memory, chats, account, and more.",
      },
    ],
  }),
  component: SettingsPage,
});

type SectionId =
  | "appearance"
  | "general"
  | "personalization"
  | "voice"
  | "memory"
  | "chats"
  | "language"
  | "data"
  | "security"
  | "storage"
  | "account"
  | "notifications"
  | "privacy"
  | "billing"
  | "help"
  | "about";

const NAV: Array<{ id: SectionId; label: string; icon: typeof Palette }> = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "language", label: "Language", icon: SettingsIcon },
  { id: "general", label: "General", icon: SettingsIcon },
  { id: "personalization", label: "Personalization", icon: User },
  { id: "voice", label: "Voice", icon: Mic },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "chats", label: "Chats", icon: MessageSquare },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "data", label: "Data Controls", icon: Database },
  { id: "security", label: "Security", icon: Lock },
  { id: "storage", label: "Storage", icon: HardDrive },
  { id: "account", label: "Account", icon: User },
  { id: "privacy", label: "Privacy Policy", icon: ShieldCheck },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "help", label: "Help & Support", icon: LifeBuoy },
  { id: "about", label: "About", icon: Info },
];


function SettingsPage() {
  const [active, setActive] = useState<SectionId>("appearance");

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-5 pt-6 pb-32 lg:pt-12">
        <div className="animate-fade-up mb-6 flex items-center gap-3">
          <div className="glass flex h-11 w-11 items-center justify-center rounded-2xl">
            <SettingsIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Settings
            </h1>
            <p className="text-muted-foreground text-sm">
              Everything FeynCloud can do — in one place.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          {/* Side nav */}
          <nav className="glass-strong animate-fade-up h-fit rounded-3xl p-2 [animation-delay:60ms]">
            {NAV.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm transition",
                    isActive
                      ? "bg-foreground/8 font-medium"
                      : "text-muted-foreground hover:bg-foreground/5",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
                </button>
              );
            })}
          </nav>

          {/* Panel */}
          <div className="animate-fade-up [animation-delay:120ms]">
            {active === "appearance" && <AppearanceSection />}
            {active === "language" && <LanguageSection />}
            {active === "memory" && <LinkSection to="/memory" label="Open Memory" description="View, edit, search, export, and delete your AI memories." />}
            {active === "chats" && <ChatsSection />}
            {active === "voice" && <VoiceSection />}
            {active === "account" && <AccountSection />}
            {active === "general" && <ChatAppearanceSection />}
            {active === "personalization" && <PlaceholderSection title="Personalization" description="Tone, persona, and response style — coming soon." />}
            {active === "data" && <PlaceholderSection title="Data Controls" description="Manage how FeynCloud handles your data, exports, and deletions." />}
            {active === "security" && <PlaceholderSection title="Security" description="Sessions, 2-factor authentication, and connected devices — coming soon." />}
            {active === "storage" && <PlaceholderSection title="Storage" description="Local cache, attachments, and usage stats — coming soon." />}
            {active === "notifications" && <PlaceholderSection title="Notifications" description="Push, email, and in-app notification preferences — coming soon." />}
            {active === "privacy" && <LinkSection to="/privacy" label="Open Privacy Policy" description="Read how FeynCloud handles your data, chats, and account." />}
            {active === "billing" && <PlaceholderSection title="Billing" description="Plan, invoices, and payment methods — coming soon." />}
            {active === "help" && <PlaceholderSection title="Help & Support" description="Reach out anytime at support@o1platforms.com." />}
            {active === "about" && <AboutSection />}

          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="glass-strong rounded-3xl p-5 sm:p-6">{children}</div>;
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
      {sub && <p className="text-muted-foreground mt-1 text-sm">{sub}</p>}
    </div>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const options: Array<{ id: ThemePref; label: string; desc: string; icon: typeof Sun }> = [
    { id: "system", label: "System", desc: "Follow your device", icon: Monitor },
    { id: "dark", label: "AMOLED Dark", desc: "Pure black, matte, no reflections", icon: Moon },
    { id: "light", label: "Pure White", desc: "Pure white, black ink, no tint", icon: Sun },
  ];
  return (
    <Card>
      <SectionTitle title="Appearance" sub="Choose how FeynCloud looks." />
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((o) => {
          const Icon = o.icon;
          const isActive = theme === o.id;
          return (
            <button
              key={o.id}
              onClick={() => setTheme(o.id)}
              className={cn(
                "glass flex flex-col items-start gap-2 rounded-2xl p-4 text-left transition hover:-translate-y-px",
                isActive && "ring-2 ring-foreground/40",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <Icon className="h-5 w-5" />
                {isActive && (
                  <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background">
                    Active
                  </span>
                )}
              </div>
              <div>
                <div className="text-sm font-semibold">{o.label}</div>
                <div className="text-muted-foreground text-xs">{o.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function LanguageSection() {
  const { i18n } = useTranslation();
  return (
    <Card>
      <SectionTitle title="Language" sub="Choose your preferred language. Changes apply instantly." />
      <select
        value={i18n.language?.slice(0, 2) || "en"}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="glass w-full rounded-2xl px-4 py-3 text-sm outline-none"
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native} — {l.name}
          </option>
        ))}
      </select>
      <p className="text-muted-foreground mt-3 text-xs">
        English is fully translated. Other languages will progressively fill in and safely fall back to English until then.
      </p>
    </Card>
  );
}


function LinkSection({
  to,
  label,
  description,
}: {
  to: string;
  label: string;
  description: string;
}) {
  return (
    <Card>
      <SectionTitle title={label} sub={description} />
      <Link
        to={to}
        className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition hover:opacity-90"
      >
        {label} <ChevronRight className="h-4 w-4" />
      </Link>
    </Card>
  );
}

function ChatsSection() {
  return (
    <Card>
      <SectionTitle
        title="Chats"
        sub="Manage your conversations. Use the sidebar to open, rename, or delete individual chats."
      />
      <div className="text-muted-foreground text-sm">
        Open the sidebar to view all conversations. Tap a chat to open it, or use the
        delete icon to remove it.
      </div>
    </Card>
  );
}

function VoiceSection() {
  return (
    <Card>
      <SectionTitle
        title="Voice"
        sub="Voice input uses your device's secure speech recognition."
      />
      <ul className="text-muted-foreground space-y-2 text-sm">
        <li>• Tap the mic in the composer to dictate.</li>
        <li>• No startup, connection, or notification sounds.</li>
        <li>• Audio stays on-device — only the transcript is sent.</li>
      </ul>
    </Card>
  );
}

function AccountSection() {
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth", replace: true });
    toast.success("Signed out");
  };

  const signOutEverywhere = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut({ scope: "global" });
    router.invalidate();
    navigate({ to: "/auth", replace: true });
    toast.success("Signed out on all devices");
  };

  return (
    <Card>
      <SectionTitle title="Account" sub="Manage your session and account." />
      <div className="space-y-2">
        <button
          onClick={signOut}
          className="glass flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-medium transition hover:-translate-y-px"
        >
          <LogOut className="h-4 w-4" />
          Sign out of this device
        </button>
        <button
          onClick={signOutEverywhere}
          className="glass flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-medium transition hover:-translate-y-px"
        >
          <LogOut className="h-4 w-4" />
          Sign out everywhere
        </button>
        <div className="text-muted-foreground pt-3 text-xs">
          To delete your account, contact support@o1platforms.com — full in-app deletion
          is coming soon.
        </div>
      </div>
    </Card>
  );
}

function PlaceholderSection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <SectionTitle title={title} sub={description} />
      <div className="text-muted-foreground text-sm">Coming soon.</div>
    </Card>
  );
}

function AboutSection() {
  return (
    <Card>
      <SectionTitle title="About FeynCloud" />
      <div className="space-y-3 text-sm">
        <p>FeynCloud is created by FeynCloud Technology.</p>
        <p className="text-muted-foreground text-xs">Version 1.0</p>
      </div>
    </Card>
  );
}

