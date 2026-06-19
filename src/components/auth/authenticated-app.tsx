"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Building2,
  LogIn,
  LogOut,
  Mail,
  Plus,
  ShieldCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EstimatorApp } from "@/components/estimator/estimator-app";
import {
  createBrowserSupabaseClient,
  hasSupabaseBrowserConfig,
} from "@/lib/supabase-browser";
import type { OrganizationSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

type AuthMode = "sign-in" | "sign-up";

export function AuthenticatedApp() {
  const isConfigured = hasSupabaseBrowserConfig();
  const supabase = useMemo(
    () => (isConfigured ? createBrowserSupabaseClient() : undefined),
    [isConfigured],
  );
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(isConfigured);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [organizationLoading, setOrganizationLoading] = useState(false);
  const [organizationError, setOrganizationError] = useState("");

  const loadOrganizations = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setOrganizationLoading(true);
    setOrganizationError("");

    const { data, error } = await supabase
      .from("organizations")
      .select("id,name,created_at")
      .order("created_at", { ascending: true });

    if (error) {
      setOrganizationError(error.message);
      setOrganizations([]);
      setOrganizationLoading(false);
      return;
    }

    const nextOrganizations = (data ?? []).map((organization) => ({
      id: String(organization.id),
      name: String(organization.name),
      createdAt:
        typeof organization.created_at === "string"
          ? organization.created_at
          : undefined,
    }));
    const storedOrganizationId = window.localStorage.getItem(
      "greenpoint:selected-organization",
    );
    const nextSelectedOrganization =
      nextOrganizations.find(
        (organization) => organization.id === storedOrganizationId,
      ) ?? nextOrganizations[0];

    setOrganizations(nextOrganizations);
    setSelectedOrganizationId(nextSelectedOrganization?.id ?? "");
    setOrganizationLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session);
      setSessionLoading(false);

      if (data.session) {
        void loadOrganizations();
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setSessionLoading(false);

        if (nextSession) {
          void loadOrganizations();
        } else {
          setOrganizations([]);
          setSelectedOrganizationId("");
        }
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadOrganizations, supabase]);

  async function createOrganization(name: string) {
    if (!supabase) {
      return;
    }

    setOrganizationLoading(true);
    setOrganizationError("");

    const { data, error } = await supabase.rpc("create_organization", {
      organization_name: name,
    });

    if (error) {
      setOrganizationError(error.message);
      setOrganizationLoading(false);
      return;
    }

    if (typeof data === "string") {
      window.localStorage.setItem("greenpoint:selected-organization", data);
      setSelectedOrganizationId(data);
    }

    await loadOrganizations();
  }

  function selectOrganization(id: string) {
    setSelectedOrganizationId(id);
    window.localStorage.setItem("greenpoint:selected-organization", id);
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setOrganizations([]);
    setSelectedOrganizationId("");
  }

  if (!isConfigured) {
    return <SupabaseSetupScreen />;
  }

  if (sessionLoading) {
    return <AuthLoadingScreen />;
  }

  if (!session || !supabase) {
    return <AuthScreen />;
  }

  if (organizationLoading && organizations.length === 0) {
    return <AuthLoadingScreen label="Loading organization" />;
  }

  if (organizations.length === 0) {
    return (
      <OrganizationSetupScreen
        error={organizationError}
        isSubmitting={organizationLoading}
        userEmail={session.user.email ?? ""}
        onCreate={createOrganization}
        onSignOut={signOut}
      />
    );
  }

  const selectedOrganization =
    organizations.find(
      (organization) => organization.id === selectedOrganizationId,
    ) ?? organizations[0];

  return (
    <EstimatorApp
      key={selectedOrganization.id}
      organization={selectedOrganization}
      organizations={organizations}
      userEmail={session.user.email ?? ""}
      userId={session.user.id}
      onChangeOrganization={selectOrganization}
      onSignOut={signOut}
    />
  );
}

function AuthScreen() {
  const supabase = createBrowserSupabaseClient();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [status, setStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSignUp = mode === "sign-up";

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    if (!email.trim() || password.length < 6) {
      setStatus({
        tone: "error",
        message: "Enter an email and a password with at least 6 characters.",
      });
      return;
    }

    setIsSubmitting(true);

    const result = isSignUp
      ? await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        })
      : await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

    if (result.error) {
      setStatus({ tone: "error", message: result.error.message });
      setIsSubmitting(false);
      return;
    }

    if (isSignUp && !result.data.session) {
      setStatus({
        tone: "success",
        message: "Account created. Check your email to confirm your sign in.",
      });
      setIsSubmitting(false);
      return;
    }

    setStatus({
      tone: "success",
      message: isSignUp ? "Account created." : "Signed in.",
    });
    setIsSubmitting(false);
  }

  return (
    <AuthLayout>
      <section className="rounded-lg border border-border bg-[#0d1714] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-6">
        <BrandBlock />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <FeatureChip icon={ShieldCheck} label="Tenant-secured data" />
          <FeatureChip icon={Building2} label="Organization workspaces" />
        </div>
      </section>

      <Card className="border-[#2a3a35] bg-[#101816]">
        <CardHeader>
          <CardTitle>{isSignUp ? "Create Account" : "Sign In"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={submitAuth}>
            {isSignUp ? (
              <div className="grid gap-2">
                <Label htmlFor="full-name">Name</Label>
                <Input
                  id="full-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                />
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isSignUp ? "new-password" : "current-password"}
              />
            </div>

            {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}

            <Button className="h-14 text-base" type="submit" disabled={isSubmitting}>
              {isSignUp ? <UserPlus className="size-5" /> : <LogIn className="size-5" />}
              {isSubmitting
                ? isSignUp
                  ? "Creating"
                  : "Signing In"
                : isSignUp
                  ? "Create Account"
                  : "Sign In"}
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setMode(isSignUp ? "sign-in" : "sign-up");
                setStatus(null);
              }}
            >
              {isSignUp ? "Use existing account" : "Create a new account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

function OrganizationSetupScreen({
  error,
  isSubmitting,
  userEmail,
  onCreate,
  onSignOut,
}: {
  error: string;
  isSubmitting: boolean;
  userEmail: string;
  onCreate: (name: string) => void;
  onSignOut: () => void;
}) {
  const [organizationName, setOrganizationName] = useState("");

  function submitOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate(organizationName);
  }

  return (
    <AuthLayout>
      <section className="rounded-lg border border-border bg-[#0d1714] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-6">
        <BrandBlock />
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-[#0a1210] px-3 text-sm text-[#d6e3da]">
            <Mail className="size-4 text-primary" />
            {userEmail}
          </span>
          <Button variant="secondary" onClick={onSignOut}>
            <LogOut className="size-4" />
            Sign Out
          </Button>
        </div>
      </section>

      <Card className="border-[#2a3a35] bg-[#101816]">
        <CardHeader>
          <CardTitle>Create Organization</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={submitOrganization}>
            <div className="grid gap-2">
              <Label htmlFor="organization-name">Organization Name</Label>
              <Input
                id="organization-name"
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
                autoComplete="organization"
              />
            </div>

            {error ? <StatusMessage tone="error" message={error} /> : null}

            <Button className="h-14 text-base" type="submit" disabled={isSubmitting}>
              <Plus className="size-5" />
              {isSubmitting ? "Creating" : "Create Organization"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

function SupabaseSetupScreen() {
  return (
    <AuthLayout>
      <section className="rounded-lg border border-border bg-[#0d1714] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-6">
        <BrandBlock />
      </section>
      <Card className="border-[#2a3a35] bg-[#101816]">
        <CardHeader>
          <CardTitle>Supabase Required</CardTitle>
        </CardHeader>
        <CardContent>
          <StatusMessage
            tone="error"
            message="Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment variables."
          />
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

function AuthLoadingScreen({ label = "Loading secure workspace" }: { label?: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#07110f] px-4 py-6 text-foreground">
      <div className="flex min-h-24 w-full max-w-sm items-center justify-center rounded-lg border border-border bg-[#101816] p-5 text-sm font-medium text-muted-foreground">
        {label}
      </div>
    </main>
  );
}

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#07110f] px-4 py-6 text-foreground">
      <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        {children}
      </div>
    </main>
  );
}

function BrandBlock() {
  return (
    <div className="flex items-start gap-4">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Building2 className="size-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-primary">GreenPoint</p>
        <h1 className="mt-1 text-3xl font-semibold leading-10 text-foreground sm:text-4xl sm:leading-[3rem]">
          Walkthrough Estimator
        </h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
          Protected estimating workspace for janitorial labor, staffing, and
          contract pricing.
        </p>
      </div>
    </div>
  );
}

function FeatureChip({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex min-h-12 items-center gap-2 rounded-md border border-border bg-[#0a1210] px-3 text-sm font-medium text-[#d6e3da]">
      <Icon className="size-4 text-primary" />
      {label}
    </div>
  );
}

function StatusMessage({
  tone,
  message,
}: {
  tone: "success" | "error";
  message: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-sm font-medium",
        tone === "success"
          ? "border-primary/50 bg-primary/10 text-[#c7f8d9]"
          : "border-destructive/60 bg-destructive/10 text-[#ffd0d0]",
      )}
    >
      {message}
    </div>
  );
}
