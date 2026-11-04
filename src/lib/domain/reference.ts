import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * RAILVYN booking references use an unambiguous alphabet (no O/0, I/1) and are
 * always prefixed to make clear they are app-generated, never an official PNR.
 */
export function generateBookingReference(): string {
  let body = "";
  for (let i = 0; i < 8; i += 1) {
    body += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return `RVN-${body}`;
}

export const BOOKING_REFERENCE_PATTERN = /^RVN-[A-HJ-NP-Z2-9]{8}$/;

export function generateIdempotencyKey(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomInt(0, 1_000_000).toString(36)}`;
}
