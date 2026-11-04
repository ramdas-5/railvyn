"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Armchair,
  CalendarClock,
  ChartNoAxesColumn,
  Gauge,
  IndianRupee,
  LayoutDashboard,
  ListOrdered,
  Map,
  Menu,
  ScrollText,
  Search,
  SlidersHorizontal,
  Ticket,
  TicketCheck,
  TrainFront,
  TriangleAlert,
  UserRound,
  Users,
  X,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/actions/auth";
import { Badge } from "@/components/ui/surfaces";
import { Wordmark } from "./wordmark";

export type Portal = "passenger" | "operator" | "admin";

type PortalUser = {
  name: string;
  email: string;
  roles: string[];
};

const NAV: Record<
  Portal,
  Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }> }>
> = {
  passenger: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/search", label: "Search trains", icon: Search },
    { href: "/my-bookings", label: "My bookings", icon: Ticket },
    { href: "/profile", label: "Profile & security", icon: UserRound },
  ],
  operator: [
    { href: "/operator", label: "Overview", icon: Gauge },
    { href: "/operator/runs", label: "Assigned runs", icon: TrainFront },
    { href: "/operator/bookings", label: "Bookings & holds", icon: TicketCheck },
    { href: "/operator/waitlist", label: "Waitlist", icon: ListOrdered },
    { href: "/operator/disruptions", label: "Disruptions", icon: TriangleAlert },
  ],
  admin: [
    { href: "/admin", label: "System overview", icon: LayoutDashboard },
    { href: "/admin/network", label: "Network", icon: Map },
    { href: "/admin/trains", label: "Trains", icon: TrainFront },
    { href: "/admin/runs", label: "Schedules & runs", icon: CalendarClock },
    { href: "/admin/coaches", label: "Coach templates", icon: Armchair },
    { href: "/admin/users", label: "Users & roles", icon: Users },
    { href: "/admin/pricing", label: "Pricing", icon: IndianRupee },
    { href: "/admin/analytics", label: "Analytics", icon: ChartNoAxesColumn },
    { href: "/admin/audit", label: "Audit log", icon: ScrollText },
    { href: "/admin/settings", label: "Settings", icon: SlidersHorizontal },
  ],
};

function isActive(pathname: string, href: string, portal: Portal) {
  if (Portal_Home[portal] === href) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const Portal_Home: Record<Portal, string> = {
  passenger: "/dashboard",
  operator: "/operator",
  admin: "/admin",
};

function NavList({
  portal,
  pathname,
  onNavigate,
}: {
  portal: Portal;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label={`${portal} navigation`} className="space-y-1">
      {NAV[portal].map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href, portal);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-chip border px-3 py-2.5 text-sm transition-colors",
              active
                ? "border-accent/30 bg-accent/15 font-semibold text-fg"
                : "border-transparent text-fg-muted hover:border-line hover:bg-white/5 hover:text-fg",
            )}
          >
            <Icon
              aria-hidden="true"
              className={cn("h-4 w-4", active ? "text-accent" : "text-fg-muted")}
            />
            <span className="flex-1">{item.label}</span>
            {active ? (
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function UserCard({ user, portal }: { user: PortalUser; portal: Portal }) {
  return (
    <div className="rounded-small border border-line bg-canvas/50 p-3">
      <p className="truncate text-sm font-semibold text-fg">{user.name}</p>
      <p className="truncate text-xs text-fg-muted">{user.email}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {user.roles
          .filter((role) => role !== "passenger")
          .map((role) => (
            <Badge key={role} tone="dark-accent" className="capitalize">
              {role}
            </Badge>
          ))}
        <Badge tone="dark">Demo account</Badge>
      </div>
      <form action={signOutAction} className="mt-3">
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg-muted hover:text-fg"
        >
          <LogOut aria-hidden="true" className="h-3.5 w-3.5" />
          Sign out
        </button>
      </form>
      {portal === "passenger" ? (
        <Link
          href="/"
          className="mt-2 block text-xs text-fg-muted underline underline-offset-2 hover:text-fg"
        >
          Back to public site
        </Link>
      ) : null}
    </div>
  );
}

export function PortalChrome({ portal, user }: { portal: Portal; user: PortalUser }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-raised px-4 py-5 lg:flex">
        <Link href="/" aria-label="RAILVYN home" className="px-1">
          <Wordmark />
        </Link>
        <div className="mt-6 flex-1 overflow-y-auto">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
            {portal === "passenger" ? "Passenger" : portal === "operator" ? "Operations" : "Administration"}
          </p>
          <NavList portal={portal} pathname={pathname} />
        </div>
        <div className="mt-4">
          <UserCard user={user} portal={portal} />
          <p className="mt-3 px-1 text-[10px] leading-relaxed text-fg-muted/70">
            Demonstration system. No official railway data or real payments.
          </p>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-raised/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/" aria-label="RAILVYN home">
          <Wordmark compact />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={open}
          className="grid h-11 w-11 place-items-center rounded-chip border border-line text-fg"
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>
      </header>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-canvas/80"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 right-0 w-[min(20rem,88vw)] overflow-y-auto border-l border-line bg-raised p-4"
          >
            <div className="flex items-center justify-between">
              <Wordmark compact />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="grid h-10 w-10 place-items-center rounded-chip border border-line"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6">
              <NavList portal={portal} pathname={pathname} onNavigate={() => setOpen(false)} />
            </div>
            <div className="mt-6">
              <UserCard user={user} portal={portal} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
