import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthShell } from "@/components/layout/auth-shell";
import { SignupForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create an account" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const session = await getSessionUser();
  if (session) redirect("/dashboard");

  return (
    <AuthShell
      title="Create a passenger account"
      description="New accounts are passengers by default. Operator and admin access is granted by an administrator."
      footer={
        <p className="text-[11px] leading-relaxed text-ink-muted">
          By creating an account you acknowledge this is an independent
          educational demonstration, not an official railway service. Do not enter
          real payment card details anywhere in RAILVYN.
        </p>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
