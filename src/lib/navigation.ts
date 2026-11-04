export type NavigationLink = {
  href: string;
  label: string;
};

export type NavigationUser = {
  isAdmin: boolean;
  isOperator: boolean;
};

/**
 * Primary destinations are role-aware. Staff never see "My bookings", which
 * would read as a personal ticket wallet: they get the registry they can
 * actually search and act on. Passengers keep their own dashboard and wallet.
 */
export function primaryNavigation(
  user: NavigationUser | null,
): NavigationLink[] {
  if (!user) return [{ href: "/search", label: "Search trains" }];

  if (user.isAdmin) {
    return [
      { href: "/search", label: "Search trains" },
      { href: "/admin", label: "Admin dashboard" },
      { href: "/admin/bookings", label: "Booking registry" },
      { href: "/operator", label: "Operations" },
    ];
  }

  if (user.isOperator) {
    return [
      { href: "/search", label: "Search trains" },
      { href: "/operator", label: "Operations" },
      { href: "/operator/bookings", label: "Bookings & holds" },
    ];
  }

  return [
    { href: "/search", label: "Search trains" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/my-bookings", label: "My bookings" },
  ];
}

/**
 * The longest matching href wins, so a section home and one of its children
 * can both live in the same nav without two entries lighting up at once.
 */
export function activeNavigationHref(
  pathname: string,
  links: NavigationLink[],
): string | null {
  let match: NavigationLink | null = null;
  for (const link of links) {
    const matches =
      pathname === link.href || pathname.startsWith(`${link.href}/`);
    if (matches && (!match || link.href.length > match.href.length)) {
      match = link;
    }
  }
  return match?.href ?? null;
}
