"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNavigationHref, type NavigationLink } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function HeaderNav({
  links,
  variant = "desktop",
}: {
  links: NavigationLink[];
  variant?: "desktop" | "mobile";
}) {
  const pathname = usePathname();
  const mobile = variant === "mobile";
  const activeHref = activeNavigationHref(pathname, links);

  return (
    <nav
      aria-label={mobile ? "Primary mobile" : "Primary"}
      className={cn(
        mobile
          ? "mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-3 py-2 text-sm"
          : "hidden items-center gap-1 md:flex",
      )}
    >
      {links.map((link) => {
        const active = activeHref === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-chip px-3 py-2 transition-colors",
              active
                ? "bg-white/10 font-semibold text-fg"
                : "text-fg-muted hover:bg-white/5 hover:text-fg",
              mobile && "py-1.5",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
