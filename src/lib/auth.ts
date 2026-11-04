import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getDb, schema, isDatabaseConfigured } from "@/db";
import { roleAssignments } from "@/db/schema";
import type { AppRole } from "@/db/schema";

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    secret:
      process.env.BETTER_AUTH_SECRET ??
      "railvyn-insecure-development-secret-do-not-use-in-production",
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
    },
    plugins: [nextCookies()],
  });
}

type AuthInstance = ReturnType<typeof createAuth>;

let cachedAuth: AuthInstance | null = null;

/**
 * Better Auth is created lazily so pages can still render when the database is
 * not configured (for example during a first Vercel build). Every call site is
 * server-only; the adapter and connection never enter a client bundle.
 */
export function getAuth(): AuthInstance {
  if (!cachedAuth) cachedAuth = createAuth();
  return cachedAuth;
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  roles: AppRole[];
  isAdmin: boolean;
  isOperator: boolean;
};

/** Roles are stored in role_assignments; every signed-in user is a passenger. */
export async function getUserRoles(userId: string): Promise<AppRole[]> {
  const rows = await getDb()
    .select({ role: roleAssignments.role })
    .from(roleAssignments)
    .where(eq(roleAssignments.userId, userId));
  const roles = new Set<AppRole>(["passenger"]);
  for (const row of rows) roles.add(row.role);
  return [...roles];
}

/**
 * Returns the authenticated user with server-verified roles, or null.
 * Never trusts a role claim from the client.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const session = await getAuth().api.getSession({ headers: await headers() });
    if (!session?.user?.id) return null;
    const roles = await getUserRoles(session.user.id);
    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      emailVerified: Boolean(session.user.emailVerified),
      roles,
      isAdmin: roles.includes("admin"),
      isOperator: roles.includes("operator") || roles.includes("admin"),
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[railvyn] session lookup failed", error);
    }
    return null;
  }
}

export async function hasRole(userId: string, role: AppRole): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: roleAssignments.id })
    .from(roleAssignments)
    .where(and(eq(roleAssignments.userId, userId), eq(roleAssignments.role, role)))
    .limit(1);
  return Boolean(row);
}
