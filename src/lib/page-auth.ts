import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/auth";

/**
 * Admin pages are rendered in parallel with their route-group layout in the App
 * Router, so a layout-only redirect can still let a page's database queries run
 * and serialize privileged data into the response. This guard runs first inside
 * every admin page and stops the render before any query executes.
 */
export async function requireAdminPage(next = "/admin"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!user.isAdmin) redirect("/dashboard");
  return user;
}
