import { Search, CalendarDays, ChevronDown, Bell } from "lucide-react";

export default function Header() {
  return (
    <header className="flex flex-wrap items-center gap-3 pl-12 lg:pl-0">
      <div className="min-w-[220px] flex-1">
        <h1 className="text-2xl font-bold">Operations Dashboard</h1>
        <p className="text-sm text-muted">Real-time railway reservation &amp; coach management</p>
      </div>
      <label className="order-last flex w-full items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2.5 md:order-none md:w-72 xl:w-80">
        <Search size={16} className="text-muted" />
        <input placeholder="Search train, PNR, coach, or passenger..." className="w-full bg-transparent text-sm outline-none placeholder:text-muted" />
        <kbd className="rounded border border-line px-1.5 text-xs text-muted">/</kbd>
      </label>
      <button className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2.5 text-sm">
        <CalendarDays size={16} /> Jan 28, 2025 <ChevronDown size={14} />
      </button>
      <button className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2.5 text-sm">
        <span className="h-2 w-2 rounded-full bg-brand" /> Live Operations <ChevronDown size={14} />
      </button>
      <button className="relative rounded-xl border border-line bg-panel p-2.5" aria-label="Notifications">
        <Bell size={18} /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" />
      </button>
      <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand to-emerald-800 font-bold text-black">RV</div>
    </header>
  );
}
