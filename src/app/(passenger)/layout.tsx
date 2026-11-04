import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { PortalChrome } from "@/components/layout/portal-chrome";

export const dynamic = "force-dynamic";

export default async function PassengerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard");
  return (
    <div className="min-h-screen bg-canvas lg:pl-64">
      <PortalChrome
        portal="passenger"
        user={{ name: user.name, email: user.email, roles: user.roles }}
      />
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
