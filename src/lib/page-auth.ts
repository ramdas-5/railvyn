import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/auth";

/**
 * Pages are rendered in parallel with their route-group layout in the App
 * Router, so a layout-only redirect can still let a page's database queries run
 * and turn an anonymous visit into a rendered 500. This guard runs first inside
 * every protected page and redirects before any query executes.
 */
export async function requireUserPage(next = "/dashboard"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** Admin-only page guard; non-admins are sent to their own dashboard. */
export async function requireAdminPage(next = "/admin"): Promise<SessionUser> {
  const user = await requireUserPage(next);
  if (!user.isAdmin) redirect("/dashboard");
  return user;
}
