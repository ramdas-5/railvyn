"use client";
import { useState } from "react";
import { LayoutDashboard, TrainFront, Bus, Armchair, Ticket, ListOrdered, User, BarChart3, Bell, Settings, Menu, X } from "lucide-react";

const nav = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Trains", icon: TrainFront },
  { label: "Coaches", icon: Bus },
  { label: "Seat Allocation", icon: Armchair },
  { label: "Bookings", icon: Ticket },
  { label: "Waitlist", icon: ListOrdered },
  { label: "Passengers", icon: User },
  { label: "Analytics", icon: BarChart3 },
  { label: "Alerts", icon: Bell },
  { label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("Dashboard");
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Open menu"
        className="fixed left-3 top-3 z-30 rounded-xl border border-line bg-panel p-2 lg:hidden">
        <Menu size={20} />
      </button>
      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto border-r border-line bg-[#0a0f0c] p-4 transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl border border-line bg-panel text-brand"><TrainFront /></div>
          <div className="flex-1">
            <div className="text-xl font-extrabold tracking-wide">RAILVYN</div>
            <div className="text-[11px] leading-tight text-muted">Railway Coach &amp; Dynamic Seat Allocation Database</div>
          </div>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <nav className="space-y-1">
          {nav.map(({ label, icon: Icon }) => (
            <button key={label} onClick={() => { setActive(label); setOpen(false); }}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition ${active === label ? "border border-brand/30 bg-brand/15 font-semibold text-white" : "text-slate-300 hover:bg-white/5"}`}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}
