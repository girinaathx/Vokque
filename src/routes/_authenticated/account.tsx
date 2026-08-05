import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { PageContainer, PageHeader } from "@/components/app/PageHeader";

import { supabase } from "@/integrations/supabase/client";
import {
  LogOut,
  KeyRound,
  UserCog,
  Sparkles,
  Mail,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Account · Avenxa" },
      { name: "description", content: "Manage your Avenxa account, plan, and security." },
    ],
  }),
  component: AccountPage,
});

type Profile = {
  email: string;
  name: string;
  avatarUrl?: string | null;
  provider: string;
  isEmailPassword: boolean;
};

function providerLabel(id?: string) {
  if (!id) return "Email";
  if (id === "google") return "Google";
  if (id === "apple") return "Apple";
  if (id === "email") return "Email";
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function AccountPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const meta = u.user_metadata ?? {};
      const name =
        (meta.full_name as string | undefined) ||
        (meta.name as string | undefined) ||
        u.email?.split("@")[0] ||
        "Friend";
      const providers = (u.app_metadata?.providers as string[] | undefined) ??
        (u.app_metadata?.provider ? [u.app_metadata.provider as string] : []);
      const primary = providers[0] ?? "email";
      setProfile({
        email: u.email ?? "",
        name,
        avatarUrl: (meta.avatar_url as string | undefined) ?? null,
        provider: providerLabel(primary),
        isEmailPassword: primary === "email",
      });
    });
  }, []);

  const initial = (profile?.name || "F").trim().charAt(0).toUpperCase();

  const signOut = async () => {
    setBusy(true);
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth", replace: true });
    toast.success("Signed out");
  };

  const changePassword = async () => {
    if (!profile?.email) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setBusy(false);
    if (error) toast.error("Couldn't send reset email");
    else toast.success("Password reset email sent");
  };

  return (
    <AppShell>
      <PageContainer className="max-w-2xl">
        <PageHeader title="Account" />

        {/* Identity */}
        <div className="animate-fade-up glass-strong mt-6 rounded-3xl p-6 text-center">
          <div className="text-foreground mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-foreground/8 text-3xl font-semibold">
            {initial}
          </div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            {profile?.name ?? "…"}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">{profile?.email}</p>
        </div>


        {/* Info rows */}
        <div className="animate-fade-up mt-4 space-y-2 [animation-delay:80ms]">
          <InfoRow
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Signed in with"
            value={profile?.provider ?? "—"}
          />
          <InfoRow
            icon={<Sparkles className="h-4 w-4" />}
            label="Plan"
            value="Free"
          />
          <InfoRow
            icon={<Mail className="h-4 w-4" />}
            label="Email"
            value={profile?.email ?? "—"}
          />
        </div>

        {/* Actions */}
        <div className="animate-fade-up mt-4 space-y-2 [animation-delay:160ms]">
          <ActionButton
            icon={<UserCog className="h-4 w-4" />}
            label="Manage Account"
            onClick={() =>
              toast("Account management opens soon", {
                description: "Contact support@o1platforms.com for changes.",
              })
            }
          />
          {profile?.isEmailPassword && (
            <ActionButton
              icon={<KeyRound className="h-4 w-4" />}
              label="Change Password"
              onClick={changePassword}
              disabled={busy}
            />
          )}
          <ActionButton
            icon={<LogOut className="h-4 w-4" />}
            label="Sign Out"
            onClick={signOut}
            disabled={busy}
            destructive
          />
        </div>
      </PageContainer>

    </AppShell>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="glass flex items-center justify-between rounded-2xl px-4 py-3">
      <div className="text-muted-foreground flex items-center gap-3 text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <span className="max-w-[55%] truncate text-sm font-medium">{value}</span>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        "glass flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-sm font-medium transition hover:-translate-y-px active:translate-y-0 disabled:opacity-50 " +
        (destructive ? "text-destructive" : "")
      }
    >
      {icon}
      {label}
    </button>
  );
}
