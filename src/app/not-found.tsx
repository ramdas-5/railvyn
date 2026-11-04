import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main-content" className="grid min-h-screen place-items-center bg-canvas px-4">
      <div className="max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          404 · Off the timetable
        </p>
        <h1 className="mt-3 text-3xl font-semibold">That page is not on this route.</h1>
        <p className="mt-3 text-sm text-fg-muted">
          The station, run or record may have moved. Search for a live
          demonstration departure or return to your dashboard.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/search">Search trains</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">Return home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
