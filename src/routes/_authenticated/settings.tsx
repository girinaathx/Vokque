import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { AppShell } from "@/components/app/AppShell";
import { PageContainer, PageHeader } from "@/components/app/PageHeader";

import { supabase } from "@/integrations/supabase/client";

import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  Brain,
  ShieldCheck,
  Info,
  LogOut,
  ChevronRight,
  User as UserIcon,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";



export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Vokque" },
      {
        name: "description",
        content: "Manage your Vokque profile, memory, privacy, and account.",
      },
      { property: "og:title", content: "Settings · Vokque" },
      { property: "og:description", content: "Manage your Vokque profile, memory, privacy, and account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

type SectionId =
  | "profile"
  | "model"
  | "memory"
  | "privacy"
  | "terms"
  | "about"
  | "account";

const NAV: Array<{ id: SectionId; label: string; icon: typeof Brain }> = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "model", label: "AI Model", icon: Brain },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "privacy", label: "Privacy Policy", icon: ShieldCheck },
  { id: "terms", label: "Terms of Service", icon: Info },
  { id: "about", label: "About", icon: Info },
  { id: "account", label: "Sign Out", icon: LogOut },
];



function SettingsPage() {
  const [active, setActive] = useState<SectionId>("profile");

  return (
    <AppShell>
      <PageContainer className="max-w-5xl">
        <PageHeader
          title="Settings"
          subtitle="Everything Vokque can do — in one place."
        />
        <div className="h-6" />


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
            {active === "profile" && <ProfileSection />}
            {active === "model" && <PlaceholderSection title="AI Model" description="Choose which model powers Vokque responses — coming soon." />}
            {active === "memory" && <LinkSection to="/memory" label="Open Memory" description="View, edit, search, export, and delete your AI memories." />}
            {active === "privacy" && <LinkSection to="/privacy" label="Open Privacy Policy" description="Read how Vokque handles your data, chats, and account." />}
            {active === "terms" && <TermsSection />}
            {active === "about" && <AboutSection />}
            {active === "account" && <AccountSection />}


          </div>
        </div>
      </PageContainer>

    </AppShell>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="p-1 sm:p-2">{children}</div>;
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
      {sub && <p className="text-muted-foreground mt-1 text-sm">{sub}</p>}
    </div>
  );
}

function ProfileSection() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["profile-settings"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .eq("id", user.id)
        .maybeSingle();
      return {
        id: user.id,
        email: user.email ?? "",
        username: profile?.username ?? "",
        display_name: profile?.display_name ?? "",
      };
    },
  });

  useEffect(() => {
    if (!data) return;
    setUsername(data.username);
    setDisplayName(data.display_name);
  }, [data]);

  const normalized = username.trim().toLowerCase();
  const validUsername = /^[a-z0-9_]{3,20}$/.test(normalized);
  const dirty =
    !!data && (normalized !== data.username || displayName.trim() !== data.display_name);

  const save = async () => {
    if (!data) return;
    if (username && !validUsername) {
      toast.error("Username must be 3–20 characters: letters, numbers, underscore");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert(
      {
        id: data.id,
        username: normalized || null,
        display_name: displayName.trim() || null,
      },
      { onConflict: "id" },
    );
    setSaving(false);
    if (error) {
      toast.error(
        error.code === "23505" ? "That username is already taken" : "Couldn't save profile",
      );
      return;
    }
    toast.success("Profile updated");
    void refetch();
  };

  const previewName = displayName.trim() || data?.display_name || "Your name";
  const initial = (previewName[0] ?? "A").toUpperCase();

  return (
    <Card>
      <SectionTitle title="Profile" sub="Your name and username on Vokque." />

      {/* Preview */}
      <div className="glass mb-5 flex items-center gap-3 rounded-2xl p-4">
        <div className="bg-foreground/10 flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{previewName}</div>
          <div className="text-muted-foreground truncate text-xs">
            {normalized ? `@${normalized}` : data?.email}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Display name">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={40}
              className="glass w-full rounded-2xl px-4 py-2.5 text-sm outline-none"
            />
          </Field>

          <Field label="Username">
            <div className="glass flex items-center rounded-2xl px-4">
              <span className="text-muted-foreground text-sm">@</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                placeholder="username"
                maxLength={20}
                autoCapitalize="none"
                spellCheck={false}
                className="w-full bg-transparent px-1 py-2.5 text-sm outline-none"
              />
            </div>
            <p className="text-muted-foreground mt-1.5 text-xs">
              3–20 characters. Letters, numbers and underscores. Must be unique.
            </p>
          </Field>

          <button
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:opacity-40"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </button>
        </div>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-muted-foreground mb-1.5 block text-xs font-medium">
        {label}
      </label>
      {children}
    </div>
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
      <SectionTitle title="About Vokque" />
      <div className="space-y-3 text-sm">
        <p>Vokque is created by Vokque Technology.</p>
        <p className="text-muted-foreground text-xs">Version 1.0</p>
      </div>
    </Card>
  );
}

function TermsSection() {
  return (
    <Card>
      <SectionTitle
        title="Terms of Service"
        sub="By using Vokque you agree to the following terms."
      />
      <div className="text-muted-foreground space-y-3 text-sm leading-relaxed">
        <p>
          Vokque is provided by O1 Platforms. You are responsible for the
          content you submit and for complying with applicable laws.
        </p>
        <p>
          Vokque may use third-party AI models to generate responses. Outputs
          can be inaccurate — verify important information independently.
        </p>
        <p>
          We may update these terms at any time. Continued use of the service
          means you accept the latest version.
        </p>
        <p>Contact: support@o1platforms.com</p>
      </div>
    </Card>
  );
}


