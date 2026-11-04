import { Database } from "lucide-react";
import { Alert } from "@/components/ui/surfaces";

export function DatabaseNotice() {
  return (
    <Alert tone="warning" title="Database not configured">
      Set <code className="font-mono text-xs">NEON_DATABASE_URL</code> in{" "}
      <code className="font-mono text-xs">.env.local</code>, then run{" "}
      <code className="font-mono text-xs">pnpm db:migrate</code> and{" "}
      <code className="font-mono text-xs">pnpm db:seed</code>. See README.md for
      Neon and local embedded PostgreSQL setup.
      <span className="mt-2 flex items-center gap-1.5 text-xs">
        <Database aria-hidden="true" className="h-3.5 w-3.5" />
        Public layout renders without credentials; live inventory does not.
      </span>
    </Alert>
  );
}
