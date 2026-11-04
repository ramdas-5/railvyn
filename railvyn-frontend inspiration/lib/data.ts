export const kpis = [
  { label: "Active Trains", value: "128", delta: "+4.9%", up: true, icon: "train" },
  { label: "Occupancy Rate", value: "87.4%", delta: "+2.3 pp", up: true, icon: "ring" },
  { label: "Confirmed Bookings", value: "56,842", delta: "+6.8%", up: true, icon: "ticket" },
  { label: "Waitlist Count", value: "8,936", delta: "-4.1%", up: false, icon: "users" },
  { label: "On-Time Departures", value: "94.6%", delta: "+1.2 pp", up: true, icon: "clock" },
];

export const trend = [
  { d: "Jan 22", bookings: 34000, occ: 79 },
  { d: "Jan 23", bookings: 36000, occ: 82 },
  { d: "Jan 24", bookings: 41000, occ: 81 },
  { d: "Jan 25", bookings: 42000, occ: 83 },
  { d: "Jan 26", bookings: 44000, occ: 82 },
  { d: "Jan 27", bookings: 49000, occ: 86 },
  { d: "Jan 28", bookings: 53000, occ: 88 },
];

// a=available o=occupied r=reserved b=blocked w=waitlisted
export const seatRows: Record<string, string> = {
  A: "aaorooaabooa",
  B: "oowaowwoaoaa",
  C: "aaaoooaaaowa",
  D: "oaoaaoaaoaaa",
  E: "aobboabwaaaa",
  F: "aoaaoaowraaa",
};

export const alerts = [
  { type: "ok", title: "Segment conflict prevented", sub: "Seat reuse validated for S3 / Seat 42", time: "2 min ago" },
  { type: "warn", title: "Coach S3 nearing capacity", sub: "94% occupied (68 / 72 seats)", time: "8 min ago" },
  { type: "ok", title: "Waitlist converted", sub: "PNR 8723914056 confirmed (WL → CNF)", time: "12 min ago" },
];

export const stations = [
  { code: "NDLS", name: "New Delhi", time: "Dep. 06:10", km: "0 km" },
  { code: "ALD", name: "Prayagraj (Allahabad)", time: "Arr. 09:35", km: "≈ 118 km" },
  { code: "LKO", name: "Lucknow", time: "Arr. 12:50", km: "≈ 312 km" },
  { code: "CNB", name: "Kanpur Central", time: "Arr. 15:20", km: "≈ 441 km" },
];

export const bookings = [
  { pnr: "8723914056", train: "12451", coach: "S3", seat: 42, from: "NDLS", to: "ALD", time: "Jan 28, 2025, 10:24", status: "Confirmed" },
  { pnr: "8723914098", train: "12451", coach: "S3", seat: 42, from: "ALD", to: "CNB", time: "Jan 28, 2025, 10:31", status: "Confirmed" },
  { pnr: "8723914107", train: "12451", coach: "S3", seat: 37, from: "NDLS", to: "LKO", time: "Jan 28, 2025, 10:36", status: "Confirmed" },
  { pnr: "8723914120", train: "12451", coach: "S3", seat: 39, from: "LKO", to: "CNB", time: "Jan 28, 2025, 10:41", status: "Waitlist (WL-3)" },
  { pnr: "8723914135", train: "12451", coach: "S3", seat: 45, from: "NDLS", to: "CNB", time: "Jan 28, 2025, 10:47", status: "Confirmed" },
];
