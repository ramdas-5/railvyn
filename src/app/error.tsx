"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[railvyn] page error", error);
  }, [error]);

  return (
    <main id="main-content" className="grid min-h-[70vh] place-items-center px-4">
      <div className="max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          Service interruption
        </p>
        <h1 className="mt-3 text-3xl font-semibold">We could not complete that view.</h1>
        <p className="mt-3 text-sm text-fg-muted">
          No booking or inventory change was silently applied. Retry the page; if
          the problem continues, check the database configuration and server logs.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-[11px] text-fg-muted">Reference: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={reset}>
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Try again
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">Return home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
