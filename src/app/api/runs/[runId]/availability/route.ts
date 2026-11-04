import { NextResponse } from "next/server";
import { getSeatMapForLeg } from "@/lib/domain/availability";
import { toUserMessage } from "@/lib/errors";
import { travelClassSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const url = new URL(request.url);
  const from = Number(url.searchParams.get("from"));
  const to = Number(url.searchParams.get("to"));
  const travelClass = travelClassSchema.safeParse(url.searchParams.get("travelClass"));

  if (!Number.isInteger(from) || !Number.isInteger(to) || !travelClass.success) {
    return NextResponse.json(
      { error: "Provide from, to and a valid travel class." },
      { status: 400 },
    );
  }

  try {
    const { coaches, classAvailability } = await getSeatMapForLeg(
      runId,
      from,
      to,
      travelClass.data,
    );
    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      classAvailability,
      seats: coaches.flatMap((coach) =>
        coach.seats.map((seat) => ({
          id: seat.id,
          status: seat.status,
          bookedOnOtherLegs: seat.bookedOnOtherLegs,
        })),
      ),
    });
  } catch (error) {
    return NextResponse.json({ error: toUserMessage(error) }, { status: 400 });
  }
}
