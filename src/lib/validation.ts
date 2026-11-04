import { z } from "zod";

export const travelClassSchema = z.enum(["sleeper", "ac3", "ac2", "chair"]);
export const berthTypeSchema = z.enum([
  "lower",
  "middle",
  "upper",
  "side_lower",
  "side_upper",
  "seat",
]);
export const genderSchema = z.enum(["female", "male", "other"]);

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(128, "That password is too long."),
});

export const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

export const passengerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the passenger's full name.").max(80),
  age: z.coerce
    .number({ error: "Enter a valid age." })
    .int("Age must be a whole number.")
    .min(0, "Age cannot be negative.")
    .max(120, "Enter an age of 120 or below."),
  gender: genderSchema,
});

export const passengerDetailsFormSchema = z.object({
  passengers: z.array(
    z.object({
      fullName: z.string().trim().min(2, "Enter the passenger's full name.").max(80),
      age: z
        .number({ error: "Enter a valid age." })
        .int("Age must be a whole number.")
        .min(0, "Age cannot be negative.")
        .max(120, "Enter an age of 120 or below."),
      gender: genderSchema,
    }),
  ),
  contactEmail: z.email("Enter a contact email."),
  contactPhone: z
    .string()
    .trim()
    .max(20, "That phone number is too long.")
    .optional()
    .or(z.literal("")),
});

export const passengersDraftSchema = z.object({
  passengers: z.array(passengerSchema).min(1).max(12),
  contactEmail: z.email("Enter a contact email."),
  contactPhone: z
    .string()
    .trim()
    .max(20, "That phone number is too long.")
    .optional()
    .or(z.literal("")),
});

export const createHoldSchema = z.object({
  runId: z.uuid(),
  from: z.coerce.number().int().min(0),
  to: z.coerce.number().int().min(1),
  travelClass: travelClassSchema,
  passengerCount: z.coerce.number().int().min(1).max(12),
  seatIds: z.array(z.uuid()).max(12).optional(),
  accessibleOnly: z.boolean().optional(),
  berthPreference: berthTypeSchema.or(z.literal("any")).optional(),
});

export const searchSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  date: z.string().optional(),
  travelClass: travelClassSchema.or(z.literal("any")).optional(),
  passengers: z.coerce.number().int().min(1).max(12).optional(),
});

export const joinWaitlistSchema = z.object({
  runId: z.uuid(),
  from: z.coerce.number().int().min(0),
  to: z.coerce.number().int().min(1),
  travelClass: travelClassSchema,
  passengerCount: z.coerce.number().int().min(1).max(12),
});

export const cancelSchema = z.object({
  bookingId: z.uuid(),
  reason: z.string().trim().max(240).optional().or(z.literal("")),
});

export const reassignSchema = z.object({
  bookingId: z.uuid(),
  seatIds: z.array(z.uuid()).min(1).max(12),
  reason: z.string().trim().min(4, "Describe why the seats are being moved.").max(240),
});

export const disruptionSchema = z.object({
  runId: z.uuid(),
  title: z.string().trim().min(4, "Enter a short incident title.").max(120),
  description: z.string().trim().min(8, "Describe the operational impact.").max(1200),
  severity: z.enum(["info", "warning", "critical"]),
});

export const stationSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Use a 2–8 character station code.")
    .max(8)
    .regex(/^[A-Z0-9]+$/, "Use uppercase letters and numbers only."),
  name: z.string().trim().min(3).max(120),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
});

export const routeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Use at least 3 characters.")
    .max(16)
    .regex(/^[A-Z0-9-]+$/, "Use uppercase letters, numbers and hyphens."),
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(400).optional().or(z.literal("")),
});

export const routeStopSchema = z.object({
  routeId: z.uuid(),
  stationId: z.uuid("Choose a station."),
  distanceKm: z.coerce.number().int().min(0).max(10000),
  scheduledOffsetMinutes: z.coerce.number().int().min(0).max(10080),
});

export const trainSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(12)
    .regex(/^[A-Z0-9]+$/, "Use uppercase letters and numbers."),
  name: z.string().trim().min(3).max(120),
  routeId: z.uuid("Choose a route."),
});

export const runSchema = z.object({
  trainId: z.uuid("Choose a train."),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a service date."),
  departureHour: z.coerce.number().int().min(0).max(23),
  departureMinute: z.coerce.number().int().min(0).max(59),
});

export const coachTemplateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(16)
    .regex(/^[A-Z0-9]+$/, "Use uppercase letters and numbers."),
  name: z.string().trim().min(3).max(80),
  travelClass: travelClassSchema,
  layoutStyle: z.string().trim().min(3).max(80),
  bays: z.coerce.number().int().min(1).max(30),
  berthsPerBay: z.coerce.number().int().min(2).max(10),
});

export const runCoachSchema = z.object({
  runId: z.uuid(),
  templateId: z.uuid(),
  coachCode: z
    .string()
    .trim()
    .min(1)
    .max(8)
    .regex(/^[A-Z0-9]+$/, "Use uppercase letters and numbers."),
});

export const fareSchema = z.object({
  routeId: z.uuid(),
  travelClass: travelClassSchema,
  fromStopIndex: z.coerce.number().int().min(0),
  toStopIndex: z.coerce.number().int().min(1),
  amountRupees: z.coerce.number().min(50, "Minimum fare is ₹50.").max(100000),
});

export const roleAssignmentSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["operator", "admin"]),
  action: z.enum(["grant", "revoke"]),
});

export const operatorScopeSchema = z.object({
  userId: z.string().min(1),
  trainId: z.uuid(),
  action: z.enum(["grant", "revoke"]),
});

export const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  newPassword: z.string().min(8, "Use at least 8 characters.").max(128),
});

export const settingsSchema = z.object({
  holdTtlSeconds: z.coerce.number().int().min(60).max(1800),
  waitlistOfferTtlSeconds: z.coerce.number().int().min(120).max(3600),
  maxSeatsPerBooking: z.coerce.number().int().min(1).max(12),
  allowWaitlist: z.boolean(),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z.string().min(8, "Use at least 8 characters.").max(128),
    confirmPassword: z.string().min(1, "Confirm the new password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
export type PassengerFormInput = z.infer<typeof passengerSchema>;
