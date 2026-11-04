import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { AuthShell } from "@/components/layout/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";
import { Badge } from "@/components/ui/surfaces";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSessionUser();
  if (session) redirect("/dashboard");
  const params = await searchParams;

  return (
    <AuthShell
      title="Sign in to RAILVYN"
      description="Access your bookings, holds and journey receipts."
      footer={
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Demonstration accounts
          </p>
          <div className="grid gap-1.5 text-xs text-ink-muted">
            <p className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">Passenger</Badge>
              passenger@railvyn.demo
            </p>
            <p className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">Operator</Badge>
              operator@railvyn.demo
            </p>
            <p className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">Admin</Badge>
              admin@railvyn.demo
            </p>
          </div>
          <p className="text-xs text-ink-muted">
            Password for all seeded accounts:{" "}
            <code className="rounded bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-ink">
              RailvynDemo#2026
            </code>
          </p>
          <p className="text-[11px] text-ink-muted">
            Demo credentials are documented in the README; replace them before any
            shared deployment.{" "}
            <Link href="/signup" className="underline underline-offset-2">
              Create your own account
            </Link>
            .
          </p>
        </div>
      }
    >
      <LoginForm next={params.next} />
    </AuthShell>
  );
}
