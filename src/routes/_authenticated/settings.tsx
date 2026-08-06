import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { AppShell } from "@/components/app/AppShell";
import { PageContainer, PageHeader } from "@/components/app/PageHeader";

import { useTheme, type ThemePref } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";

import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  Palette,
  Brain,
  ShieldCheck,
  Info,
  Sun,
  Moon,
  Monitor,
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
      { title: "Settings · Avenxa" },
      {
        name: "description",
        content: "Manage appearance, memory, chats, account, and more.",
      },
    ],
  }),
  component: SettingsPage,
});

type SectionId =
  | "profile"
  | "appearance"
  | "model"
  | "memory"
  | "privacy"
  | "terms"
  | "about"
  | "account";

const NAV: Array<{ id: SectionId; label: string; icon: typeof Palette }> = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "model", label: "AI Model", icon: Brain },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "privacy", label: "Privacy Policy", icon: ShieldCheck },
  { id: "terms", label: "Terms of Service", icon: Info },
  { id: "about", label: "About", icon: Info },
  { id: "account", label: "Sign Out", icon: LogOut },
];



function SettingsPage() {
  const [active, setActive] = useState<SectionId>("appearance");

  return (
    <AppShell>
      <PageContainer className="max-w-5xl">
        <PageHeader
          title="Settings"
          subtitle="Everything Avenxa can do — in one place."
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
            {active === "appearance" && <AppearanceSection />}
            {active === "model" && <PlaceholderSection title="AI Model" description="Choose which model powers Avenxa responses — coming soon." />}
            {active === "memory" && <LinkSection to="/memory" label="Open Memory" description="View, edit, search, export, and delete your AI memories." />}
            {active === "privacy" && <LinkSection to="/privacy" label="Open Privacy Policy" description="Read how Avenxa handles your data, chats, and account." />}
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
      <SectionTitle title="Appearance" sub="Choose how Avenxa looks." />
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
      <SectionTitle title="About Avenxa" />
      <div className="space-y-3 text-sm">
        <p>Avenxa is created by Avenxa Technology.</p>
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
        sub="By using Avenxa you agree to the following terms."
      />
      <div className="text-muted-foreground space-y-3 text-sm leading-relaxed">
        <p>
          Avenxa is provided by O1 Platforms. You are responsible for the
          content you submit and for complying with applicable laws.
        </p>
        <p>
          Avenxa may use third-party AI models to generate responses. Outputs
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


