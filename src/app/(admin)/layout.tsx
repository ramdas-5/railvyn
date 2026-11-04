import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { PortalChrome } from "@/components/layout/portal-chrome";
import { AccessDenied } from "@/components/layout/page-heading";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (!user.isAdmin) {
    return (
      <div className="min-h-screen bg-canvas px-4 py-16">
        <AccessDenied
          title="Administrator access required"
          description="Network, pricing, user and policy administration is limited to accounts with the admin role. Every admin action re-checks your role on the server."
        />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-canvas lg:pl-64">
      <PortalChrome
        portal="admin"
        user={{ name: user.name, email: user.email, roles: user.roles }}
      />
      <main
        id="main-content"
        className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
      >
        {children}
      </main>
    </div>
  );
}
