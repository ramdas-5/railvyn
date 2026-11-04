import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="This deployment does not send email, so password resets are handled by an administrator."
      footer={
        <p className="text-[11px] leading-relaxed text-ink-muted">
          Administrators can reset a password from Admin → Users. The action signs
          out existing sessions for that account. No reset link is fabricated here.
        </p>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
