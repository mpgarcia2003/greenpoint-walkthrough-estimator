"use client";

import { FormEvent, useState } from "react";
import { Building2, LockKeyhole, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccessGate() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitPasscode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(passcode)) {
      setError("Enter the 6 digit passcode.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/passcode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ passcode }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      if (!response.ok) {
        setError(result.message ?? "Could not verify passcode.");
        return;
      }

      window.location.reload();
    } catch {
      setError("Could not verify passcode. Check the connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#07110f] px-4 py-6 text-foreground">
      <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <section className="rounded-lg border border-border bg-[#0d1714] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-6">
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
                Protected estimating workspace for janitorial labor, staffing,
                and contract pricing.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="flex min-h-12 items-center gap-2 rounded-md border border-border bg-[#0a1210] px-3 text-sm font-medium text-[#d6e3da]">
              <ShieldCheck className="size-4 text-primary" />
              Server checked access
            </div>
            <div className="flex min-h-12 items-center gap-2 rounded-md border border-border bg-[#0a1210] px-3 text-sm font-medium text-[#d6e3da]">
              <LockKeyhole className="size-4 text-primary" />
              6 digit passcode
            </div>
          </div>
        </section>

        <Card className="border-[#2a3a35] bg-[#101816]">
          <CardHeader>
            <CardTitle>Enter Passcode</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={submitPasscode}>
              <div className="grid gap-2">
                <Label htmlFor="passcode">6 Digit Passcode</Label>
                <Input
                  id="passcode"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  type="password"
                  value={passcode}
                  onChange={(event) =>
                    setPasscode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  autoComplete="one-time-code"
                />
              </div>

              {error ? (
                <div className="rounded-md border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm font-medium text-[#ffd0d0]">
                  {error}
                </div>
              ) : null}

              <Button className="h-14 text-base" type="submit" disabled={isSubmitting}>
                <LockKeyhole className="size-5" />
                {isSubmitting ? "Checking" : "Unlock Estimator"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
