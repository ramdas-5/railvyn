export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6" role="status" aria-live="polite">
      <span className="sr-only">Loading RAILVYN</span>
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-32 rounded bg-raised" />
        <div className="h-10 w-2/3 rounded-chip bg-raised" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-32 rounded-card bg-raised" />
          <div className="h-32 rounded-card bg-raised" />
          <div className="h-32 rounded-card bg-raised" />
        </div>
      </div>
    </div>
  );
}
