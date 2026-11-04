import { and, eq } from "drizzle-orm";
import { getDb, type DbExecutor } from "@/db";
import { fares, type TravelClass } from "@/db/schema";
import { ValidationError } from "@/lib/errors";

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
