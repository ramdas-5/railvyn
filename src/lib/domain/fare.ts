import { and, eq, inArray } from "drizzle-orm";
import { getDb, type DbExecutor } from "@/db";
import { fares, routeStops, type TravelClass } from "@/db/schema";
import { ValidationError } from "@/lib/errors";

/**
 * Explicit fare rows win. Dense demonstration corridors and newly created
 * routes may not ship the full stop-pair matrix, so a missing row is priced
 * from the travelled distance with the same deterministic rates the seed uses.
 */
const DISTANCE_RATES: Record<
  TravelClass,
  { basePaise: number; perKmPaise: number }
> = {
  sleeper: { basePaise: 15_000, perKmPaise: 35 },
  ac3: { basePaise: 55_000, perKmPaise: 90 },
  ac2: { basePaise: 95_000, perKmPaise: 140 },
  chair: { basePaise: 30_000, perKmPaise: 55 },
};

function distanceFare(distanceKm: number, travelClass: TravelClass): number {
  const rate = DISTANCE_RATES[travelClass];
  const raw = rate.basePaise + rate.perKmPaise * Math.max(0, distanceKm);
  return Math.max(5_000, Math.round(raw / 500) * 500);
}

/** Fares are stored per route, class and ordered stop pair (all in paise). */
export async function getFarePaise(
  routeId: string,
  travelClass: TravelClass,
  fromStopIndex: number,
  toStopIndex: number,
  executor?: DbExecutor,
): Promise<number> {
  const db = executor ?? getDb();
  const [row] = await db
    .select({ amountPaise: fares.amountPaise })
    .from(fares)
    .where(
      and(
        eq(fares.routeId, routeId),
        eq(fares.travelClass, travelClass),
        eq(fares.fromStopIndex, fromStopIndex),
        eq(fares.toStopIndex, toStopIndex),
      ),
    )
    .limit(1);
  if (!row) {
    const stopRows = await db
      .select({
        stopIndex: routeStops.stopIndex,
        distanceKm: routeStops.distanceKm,
      })
      .from(routeStops)
      .where(
        and(
          eq(routeStops.routeId, routeId),
          inArray(routeStops.stopIndex, [fromStopIndex, toStopIndex]),
        ),
      );
    const from = stopRows.find((stop) => stop.stopIndex === fromStopIndex);
    const to = stopRows.find((stop) => stop.stopIndex === toStopIndex);
    if (from && to && to.distanceKm > from.distanceKm) {
      return distanceFare(to.distanceKm - from.distanceKm, travelClass);
    }
    throw new ValidationError(
      "No fare is configured for that class and journey. Choose another class or contact operations.",
    );
  }
  return row.amountPaise;
}

export function calculateTotalFare(
  farePerPassengerPaise: number,
  passengerCount: number,
): number {
  return farePerPassengerPaise * passengerCount;
}
