import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { signOutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Badge, DemoNotice } from "@/components/ui/surfaces";
import { primaryNavigation } from "@/lib/navigation";
import { HeaderNav } from "./header-nav";
import { Wordmark } from "./wordmark";

export async function SiteHeader() {
  const user = await getSessionUser();
  const links = primaryNavigation(
    user ? { isAdmin: user.isAdmin, isOperator: user.isOperator } : null,
  );

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="RAILVYN home">
          <Wordmark />
        </Link>
        <HeaderNav links={links} />
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-right text-xs sm:block">
                <span className="block font-semibold text-fg">{user.name}</span>
                <span className="block text-fg-muted">{user.email}</span>
              </span>
              <form action={signOutAction}>
                <Button variant="secondary" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-chip px-3 py-2 text-sm text-fg-muted hover:text-fg"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-9 items-center gap-1.5 rounded-chip bg-accent px-3.5 text-xs font-semibold text-accent-ink hover:bg-[#e7ffa8]"
              >
                Create account
                <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </div>
      </div>
      <div className="border-t border-line/60 md:hidden">
        <HeaderNav links={links} variant="mobile" />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-canvas px-4 py-10 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-fg-muted">
            An independent educational railway reservation and operations
            demonstration. Journey-aware seat reuse, timed holds, waitlists and
            operator tooling built on PostgreSQL.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="dark">Demo database</Badge>
            <Badge tone="dark">Demo payments</Badge>
            <Badge tone="dark">No official PNR</Badge>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-fg-muted">
            Passenger
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/search" className="text-fg-muted hover:text-fg">
                Search trains
              </Link>
            </li>
            <li>
              <Link href="/my-bookings" className="text-fg-muted hover:text-fg">
                Passenger bookings
              </Link>
            </li>
            <li>
              <Link href="/dashboard" className="text-fg-muted hover:text-fg">
                Passenger dashboard
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-fg-muted">
            Operations
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/operator" className="text-fg-muted hover:text-fg">
                Operator cockpit
              </Link>
            </li>
            <li>
              <Link href="/admin" className="text-fg-muted hover:text-fg">
                Administration
              </Link>
            </li>
            <li>
              <Link href="/login" className="text-fg-muted hover:text-fg">
                Sign in
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-8 max-w-6xl border-t border-line/70 pt-5">
        <DemoNotice className="text-fg-muted" />
        <p className="mt-2 text-xs text-fg-muted/80">
          RAILVYN is not affiliated with Indian Railways or IRCTC. Train names,
          stations and availability are seeded demonstration data. Generated
          references are internal RAILVYN booking references, never official PNRs.
        </p>
      </div>
    </footer>
  );
}
