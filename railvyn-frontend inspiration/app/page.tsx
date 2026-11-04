import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import KpiCards from "@/components/KpiCards";
import TrendChart from "@/components/TrendChart";
import SeatMap from "@/components/SeatMap";
import Schedule from "@/components/Schedule";
import Alerts from "@/components/Alerts";
import SegmentReuse from "@/components/SegmentReuse";
import Bookings from "@/components/Bookings";
import RouteOverview from "@/components/RouteOverview";

export default function Page() {
  return (
    <div className="min-h-screen lg:pl-64">
      <Sidebar />
      <main className="mx-auto max-w-[1700px] space-y-4 p-4 md:p-6">
        <Header />
        <KpiCards />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <TrendChart />
              <SeatMap />
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
              <Alerts />
              <SegmentReuse />
            </div>
            <Bookings />
          </div>
          <div className="grid content-start gap-4 md:grid-cols-2 xl:grid-cols-1">
            <Schedule />
            <RouteOverview />
          </div>
        </div>
      </main>
    </div>
  );
}
