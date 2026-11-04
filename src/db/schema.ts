import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/* Enumerations                                                                */
/* -------------------------------------------------------------------------- */

export const appRoleEnum = pgEnum("app_role", ["passenger", "operator", "admin"]);
export const travelClassEnum = pgEnum("travel_class", [
  "sleeper",
  "ac3",
  "ac2",
  "chair",
]);
export const berthTypeEnum = pgEnum("berth_type", [
  "lower",
  "middle",
  "upper",
  "side_lower",
  "side_upper",
  "seat",
]);
export const runStatusEnum = pgEnum("run_status", [
  "scheduled",
  "disrupted",
  "cancelled",
  "completed",
]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "confirmed",
  "cancelled",
]);
export const holdStatusEnum = pgEnum("hold_status", [
  "active",
  "converted",
  "expired",
  "released",
]);
export const waitlistStatusEnum = pgEnum("waitlist_status", [
  "waiting",
  "offered",
  "confirmed",
  "expired",
  "cancelled",
]);
export const disruptionSeverityEnum = pgEnum("disruption_severity", [
  "info",
  "warning",
  "critical",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "succeeded",
  "refunded",
]);

/* -------------------------------------------------------------------------- */
/* Authentication (Better Auth managed tables)                                  */
/* -------------------------------------------------------------------------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

/* -------------------------------------------------------------------------- */
/* Network catalog                                                             */
/* -------------------------------------------------------------------------- */

export const stations = pgTable(
  "stations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 8 }).notNull(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    timezone: text("timezone").default("Asia/Kolkata").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("stations_code_unique").on(table.code)],
);

export const routes = pgTable(
  "routes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 16 }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("routes_code_unique").on(table.code)],
);

export const routeStops = pgTable(
  "route_stops",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    routeId: uuid("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    stationId: uuid("station_id")
      .notNull()
      .references(() => stations.id, { onDelete: "restrict" }),
    stopIndex: integer("stop_index").notNull(),
    distanceKm: integer("distance_km").notNull(),
    scheduledOffsetMinutes: integer("scheduled_offset_minutes").notNull(),
  },
  (table) => [
    uniqueIndex("route_stops_route_index_unique").on(
      table.routeId,
      table.stopIndex,
    ),
    uniqueIndex("route_stops_route_station_unique").on(
      table.routeId,
      table.stationId,
    ),
    check("route_stops_index_non_negative", sql`${table.stopIndex} >= 0`),
    check("route_stops_distance_non_negative", sql`${table.distanceKm} >= 0`),
  ],
);

export const trains = pgTable(
  "trains",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 12 }).notNull(),
    name: text("name").notNull(),
    routeId: uuid("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "restrict" }),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("trains_code_unique").on(table.code)],
);

export const trainRuns = pgTable(
  "train_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trainId: uuid("train_id")
      .notNull()
      .references(() => trains.id, { onDelete: "restrict" }),
    serviceDate: date("service_date").notNull(),
    departureAt: timestamp("departure_at", { withTimezone: true }).notNull(),
    arrivalAt: timestamp("arrival_at", { withTimezone: true }).notNull(),
    status: runStatusEnum("status").default("scheduled").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("train_runs_train_date_unique").on(
      table.trainId,
      table.serviceDate,
    ),
    index("train_runs_service_date_idx").on(table.serviceDate),
    check("train_runs_arrival_after_departure", sql`${table.arrivalAt} > ${table.departureAt}`),
  ],
);

/* -------------------------------------------------------------------------- */
/* Coach inventory                                                             */
/* -------------------------------------------------------------------------- */

export const coachTemplates = pgTable(
  "coach_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 16 }).notNull(),
    name: text("name").notNull(),
    travelClass: travelClassEnum("travel_class").notNull(),
    layoutStyle: text("layout_style").notNull(),
    totalSeats: integer("total_seats").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("coach_templates_code_unique").on(table.code),
    check("coach_templates_total_positive", sql`${table.totalSeats} > 0`),
  ],
);

export const templateSeats = pgTable(
  "template_seats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => coachTemplates.id, { onDelete: "cascade" }),
    seatNumber: integer("seat_number").notNull(),
    berthType: berthTypeEnum("berth_type").notNull(),
    deck: text("deck").default("lower").notNull(),
    rowIndex: integer("row_index").notNull(),
    positionInRow: integer("position_in_row").notNull(),
    isAccessible: boolean("is_accessible").default(false).notNull(),
  },
  (table) => [
    uniqueIndex("template_seats_template_number_unique").on(
      table.templateId,
      table.seatNumber,
    ),
    check("template_seats_number_positive", sql`${table.seatNumber} > 0`),
  ],
);

export const runCoaches = pgTable(
  "run_coaches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => trainRuns.id, { onDelete: "cascade" }),
    templateId: uuid("template_id")
      .notNull()
      .references(() => coachTemplates.id, { onDelete: "restrict" }),
    coachCode: varchar("coach_code", { length: 8 }).notNull(),
    position: integer("position").notNull(),
    travelClass: travelClassEnum("travel_class").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("run_coaches_run_code_unique").on(table.runId, table.coachCode),
    uniqueIndex("run_coaches_run_position_unique").on(
      table.runId,
      table.position,
    ),
    index("run_coaches_run_idx").on(table.runId),
  ],
);

export const runSeats = pgTable(
  "run_seats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runCoachId: uuid("run_coach_id")
      .notNull()
      .references(() => runCoaches.id, { onDelete: "cascade" }),
    seatNumber: integer("seat_number").notNull(),
    berthType: berthTypeEnum("berth_type").notNull(),
    deck: text("deck").default("lower").notNull(),
    rowIndex: integer("row_index").notNull(),
    positionInRow: integer("position_in_row").notNull(),
    isAccessible: boolean("is_accessible").default(false).notNull(),
  },
  (table) => [
    uniqueIndex("run_seats_coach_number_unique").on(
      table.runCoachId,
      table.seatNumber,
    ),
    index("run_seats_coach_idx").on(table.runCoachId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Access control                                                              */
/* -------------------------------------------------------------------------- */

export const roleAssignments = pgTable(
  "role_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: appRoleEnum("role").notNull(),
    grantedBy: text("granted_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("role_assignments_user_role_unique").on(
      table.userId,
      table.role,
    ),
    index("role_assignments_user_idx").on(table.userId),
  ],
);

export const operatorScopes = pgTable(
  "operator_scopes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    trainId: uuid("train_id")
      .notNull()
      .references(() => trains.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("operator_scopes_user_train_unique").on(
      table.userId,
      table.trainId,
    ),
    index("operator_scopes_user_idx").on(table.userId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Pricing                                                                     */
/* -------------------------------------------------------------------------- */

export const fares = pgTable(
  "fares",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    routeId: uuid("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    travelClass: travelClassEnum("travel_class").notNull(),
    fromStopIndex: integer("from_stop_index").notNull(),
    toStopIndex: integer("to_stop_index").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("fares_route_class_pair_unique").on(
      table.routeId,
      table.travelClass,
      table.fromStopIndex,
      table.toStopIndex,
    ),
    check("fares_valid_range", sql`${table.toStopIndex} > ${table.fromStopIndex}`),
    check("fares_amount_non_negative", sql`${table.amountPaise} >= 0`),
  ],
);

/* -------------------------------------------------------------------------- */
/* Reservations                                                                */
/* -------------------------------------------------------------------------- */

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reference: varchar("reference", { length: 20 }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => trainRuns.id, { onDelete: "restrict" }),
    fromStopIndex: integer("from_stop_index").notNull(),
    toStopIndex: integer("to_stop_index").notNull(),
    travelClass: travelClassEnum("travel_class").notNull(),
    passengerCount: integer("passenger_count").notNull(),
    totalFarePaise: integer("total_fare_paise").notNull(),
    status: bookingStatusEnum("status").default("confirmed").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone"),
    idempotencyKey: varchar("idempotency_key", { length: 100 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
  },
  (table) => [
    uniqueIndex("bookings_reference_unique").on(table.reference),
    uniqueIndex("bookings_idempotency_unique").on(table.idempotencyKey),
    index("bookings_user_created_idx").on(table.userId, table.createdAt),
    index("bookings_run_idx").on(table.runId),
    check("bookings_valid_range", sql`${table.toStopIndex} > ${table.fromStopIndex}`),
    check("bookings_passenger_count_positive", sql`${table.passengerCount} > 0`),
    check("bookings_fare_non_negative", sql`${table.totalFarePaise} >= 0`),
  ],
);

export const bookingPassengers = pgTable(
  "booking_passengers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    age: integer("age").notNull(),
    gender: text("gender").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    index("booking_passengers_booking_idx").on(table.bookingId),
    check("booking_passengers_age_valid", sql`${table.age} >= 0 AND ${table.age} <= 120`),
  ],
);

export const bookingSeats = pgTable(
  "booking_seats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    runSeatId: uuid("run_seat_id")
      .notNull()
      .references(() => runSeats.id, { onDelete: "restrict" }),
    passengerId: uuid("passenger_id")
      .notNull()
      .references(() => bookingPassengers.id, { onDelete: "cascade" }),
    farePaise: integer("fare_paise").notNull(),
  },
  (table) => [
    uniqueIndex("booking_seats_booking_seat_unique").on(
      table.bookingId,
      table.runSeatId,
    ),
    uniqueIndex("booking_seats_passenger_unique").on(table.passengerId),
    index("booking_seats_booking_idx").on(table.bookingId),
  ],
);

export type PassengerDraft = {
  passengers: Array<{ fullName: string; age: number; gender: string }>;
  contactEmail?: string;
  contactPhone?: string;
};

export const seatHolds = pgTable(
  "seat_holds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => trainRuns.id, { onDelete: "cascade" }),
    fromStopIndex: integer("from_stop_index").notNull(),
    toStopIndex: integer("to_stop_index").notNull(),
    travelClass: travelClassEnum("travel_class").notNull(),
    passengerCount: integer("passenger_count").notNull(),
    status: holdStatusEnum("status").default("active").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 100 }).notNull(),
    convertedBookingId: uuid("converted_booking_id").references(
      () => bookings.id,
      { onDelete: "set null" },
    ),
    passengerDraft: jsonb("passenger_draft").$type<PassengerDraft | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("seat_holds_idempotency_unique").on(table.idempotencyKey),
    index("seat_holds_status_expiry_idx").on(table.status, table.expiresAt),
    index("seat_holds_run_idx").on(table.runId),
    index("seat_holds_user_idx").on(table.userId),
    check("seat_holds_valid_range", sql`${table.toStopIndex} > ${table.fromStopIndex}`),
    check("seat_holds_passenger_count_positive", sql`${table.passengerCount} > 0`),
  ],
);

export const holdSeats = pgTable(
  "hold_seats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    holdId: uuid("hold_id")
      .notNull()
      .references(() => seatHolds.id, { onDelete: "cascade" }),
    runSeatId: uuid("run_seat_id")
      .notNull()
      .references(() => runSeats.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("hold_seats_hold_seat_unique").on(table.holdId, table.runSeatId),
    index("hold_seats_hold_idx").on(table.holdId),
  ],
);

/**
 * THE core invariant table.
 *
 * A journey [from, to) owns one row per segment index. The unique index on
 * (run_seat_id, segment_index) is the database-level guarantee that two active
 * holds or bookings can never overlap on the same physical seat, while still
 * allowing the same seat to be sold on non-overlapping legs.
 */
export const seatSegmentClaims = pgTable(
  "seat_segment_claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runSeatId: uuid("run_seat_id")
      .notNull()
      .references(() => runSeats.id, { onDelete: "cascade" }),
    segmentIndex: integer("segment_index").notNull(),
    holdId: uuid("hold_id").references(() => seatHolds.id, {
      onDelete: "cascade",
    }),
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("seat_segment_claims_seat_segment_unique").on(
      table.runSeatId,
      table.segmentIndex,
    ),
    index("seat_segment_claims_hold_idx").on(table.holdId),
    index("seat_segment_claims_booking_idx").on(table.bookingId),
    check("seat_segment_claims_segment_non_negative", sql`${table.segmentIndex} >= 0`),
    check(
      "seat_segment_claims_single_owner",
      sql`(CASE WHEN ${table.holdId} IS NULL THEN 0 ELSE 1 END) + (CASE WHEN ${table.bookingId} IS NULL THEN 0 ELSE 1 END) = 1`,
    ),
  ],
);

export const waitlistEntries = pgTable(
  "waitlist_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => trainRuns.id, { onDelete: "cascade" }),
    fromStopIndex: integer("from_stop_index").notNull(),
    toStopIndex: integer("to_stop_index").notNull(),
    travelClass: travelClassEnum("travel_class").notNull(),
    passengerCount: integer("passenger_count").notNull(),
    priority: integer("priority").default(0).notNull(),
    status: waitlistStatusEnum("status").default("waiting").notNull(),
    offeredHoldId: uuid("offered_hold_id").references(() => seatHolds.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("waitlist_run_queue_idx").on(
      table.runId,
      table.travelClass,
      table.status,
      table.priority,
      table.createdAt,
    ),
    index("waitlist_user_idx").on(table.userId),
    check("waitlist_valid_range", sql`${table.toStopIndex} > ${table.fromStopIndex}`),
    check("waitlist_passenger_count_positive", sql`${table.passengerCount} > 0`),
  ],
);

export const paymentsDemo = pgTable(
  "payments_demo",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    amountPaise: integer("amount_paise").notNull(),
    status: paymentStatusEnum("status").default("succeeded").notNull(),
    method: text("method").default("demo_card").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("payments_demo_booking_unique").on(table.bookingId),
    uniqueIndex("payments_demo_idempotency_unique").on(table.idempotencyKey),
    check("payments_demo_amount_non_negative", sql`${table.amountPaise} >= 0`),
  ],
);

/* -------------------------------------------------------------------------- */
/* Operations                                                                  */
/* -------------------------------------------------------------------------- */

export const disruptions = pgTable(
  "disruptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => trainRuns.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    severity: disruptionSeverityEnum("severity").default("warning").notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [index("disruptions_run_idx").on(table.runId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_logs_created_idx").on(table.createdAt),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* -------------------------------------------------------------------------- */
/* Inferred types                                                              */
/* -------------------------------------------------------------------------- */

export type Station = typeof stations.$inferSelect;
export type Route = typeof routes.$inferSelect;
export type RouteStop = typeof routeStops.$inferSelect;
export type Train = typeof trains.$inferSelect;
export type TrainRun = typeof trainRuns.$inferSelect;
export type CoachTemplate = typeof coachTemplates.$inferSelect;
export type TemplateSeat = typeof templateSeats.$inferSelect;
export type RunCoach = typeof runCoaches.$inferSelect;
export type RunSeat = typeof runSeats.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type BookingPassenger = typeof bookingPassengers.$inferSelect;
export type BookingSeat = typeof bookingSeats.$inferSelect;
export type SeatHold = typeof seatHolds.$inferSelect;
export type SeatSegmentClaim = typeof seatSegmentClaims.$inferSelect;
export type WaitlistEntry = typeof waitlistEntries.$inferSelect;
export type Fare = typeof fares.$inferSelect;
export type Disruption = typeof disruptions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type TravelClass = (typeof travelClassEnum.enumValues)[number];
export type AppRole = (typeof appRoleEnum.enumValues)[number];
export type RunStatus = (typeof runStatusEnum.enumValues)[number];
export type BookingStatus = (typeof bookingStatusEnum.enumValues)[number];
export type HoldStatus = (typeof holdStatusEnum.enumValues)[number];
export type WaitlistStatus = (typeof waitlistStatusEnum.enumValues)[number];
export type BerthType = (typeof berthTypeEnum.enumValues)[number];
