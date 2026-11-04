"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { getAuth, getUserRoles } from "@/lib/auth";
import { requireUser } from "@/lib/permissions";
import { writeAudit } from "@/lib/domain/audit";
import { ValidationError } from "@/lib/errors";
import {
  passwordChangeSchema,
  profileSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation";
import {
  actionError,
  actionSuccess,
  zodActionError,
  type ActionState,
} from "@/lib/action-result";

function safeNext(next?: string): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

function authFailureMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  if (/invalid email or password/i.test(raw)) return "Email or password is incorrect.";
  if (/already exists|user already/i.test(raw)) {
    return "An account with that email already exists. Try signing in instead.";
  }
  if (/password/i.test(raw) && /least|short/i.test(raw)) {
    return "Choose a password with at least 8 characters.";
  }
  console.error("[railvyn] authentication error", error);
  return "We could not complete that sign-in. Check your details and try again.";
}

export async function signUpAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: formData.get("password"),
  });
  if (!parsed.success) return zodActionError(parsed.error);

  try {
    await getAuth().api.signUpEmail({
      body: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
      },
    });
  } catch (error) {
    return { status: "error", message: authFailureMessage(error) };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signInAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signInSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return zodActionError(parsed.error);

  let landing = "/dashboard";
  try {
    const result = await getAuth().api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
    });
    // Staff sign-ins land on their own portal instead of the passenger
    // dashboard. Roles are read from role_assignments on the server.
    const roles = await getUserRoles(result.user.id);
    landing = roles.includes("admin")
      ? "/admin"
      : roles.includes("operator")
        ? "/operator"
        : "/dashboard";
  } catch (error) {
    return { status: "error", message: authFailureMessage(error) };
  }

  revalidatePath("/", "layout");
  redirect(parsed.data.next ? safeNext(parsed.data.next) : landing);
}

export async function signOutAction(): Promise<void> {
  await getAuth().api.signOut({ headers: await headers() });
  revalidatePath("/", "layout");
  redirect("/");
}

export async function forgotPasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter a valid email address.",
      fieldErrors: { email: ["Enter a valid email address."] },
    };
  }
  // No email provider is configured for this demonstration deployment. We say
  // so plainly rather than pretending a reset message was sent.
  return {
    status: "success",
    message:
      "Password reset email delivery is not configured in this demonstration deployment. Ask a RAILVYN administrator to reset your password from Admin → Users.",
  };
}

export async function updateProfileAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireUser();
    const parsed = profileSchema.safeParse({ name: formData.get("name") });
    if (!parsed.success) return zodActionError(parsed.error);

    await getDb()
      .update(user)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(eq(user.id, actor.id));

    await writeAudit({
      actorUserId: actor.id,
      actorRole: "passenger",
      action: "profile.updated",
      entityType: "user",
      entityId: actor.id,
      metadata: { field: "name" },
    });

    revalidatePath("/profile");
    revalidatePath("/", "layout");
    return actionSuccess("Profile updated.");
  } catch (error) {
    return actionError(error);
  }
}

export async function changePasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireUser();
    const parsed = passwordChangeSchema.safeParse({
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });
    if (!parsed.success) return zodActionError(parsed.error);

    try {
      await getAuth().api.changePassword({
        body: {
          currentPassword: parsed.data.currentPassword,
          newPassword: parsed.data.newPassword,
          revokeOtherSessions: false,
        },
        headers: await headers(),
      });
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      if (/invalid|incorrect/i.test(raw)) {
        throw new ValidationError("Your current password is incorrect.");
      }
      throw new ValidationError(
        "The password could not be changed. Sign out and sign in again, then retry.",
      );
    }

    await writeAudit({
      actorUserId: actor.id,
      actorRole: "passenger",
      action: "profile.password_changed",
      entityType: "user",
      entityId: actor.id,
    });

    return actionSuccess("Password changed.");
  } catch (error) {
    return actionError(error);
  }
}
