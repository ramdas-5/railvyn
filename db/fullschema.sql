-- ---------------------------------------------------------------------------
-- RAILVYN — complete PostgreSQL schema for a fresh database
-- Generated from drizzle/0000_faulty_mephistopheles.sql + drizzle/0001_icy_solo.sql
-- DO NOT apply this to an existing RAILVYN database after Drizzle migrations;
-- choose either versioned Drizzle migrations OR these SQL files for a fresh DB.
-- Apply: psql "$NEON_DATABASE_URL" -f db/fullschema.sql
-- Then:  psql "$NEON_DATABASE_URL" -f db/seed.sql
-- ---------------------------------------------------------------------------

set client_encoding to 'UTF8';
set search_path to public;

CREATE TYPE "public"."app_role" AS ENUM('passenger', 'operator', 'admin');
CREATE TYPE "public"."berth_type" AS ENUM('lower', 'middle', 'upper', 'side_lower', 'side_upper', 'seat');
CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'cancelled');
CREATE TYPE "public"."disruption_severity" AS ENUM('info', 'warning', 'critical');
CREATE TYPE "public"."hold_status" AS ENUM('active', 'converted', 'expired', 'released');
CREATE TYPE "public"."payment_status" AS ENUM('succeeded', 'refunded');
CREATE TYPE "public"."run_status" AS ENUM('scheduled', 'disrupted', 'cancelled', 'completed');
CREATE TYPE "public"."travel_class" AS ENUM('sleeper', 'ac3', 'ac2', 'chair');
CREATE TYPE "public"."waitlist_status" AS ENUM('waiting', 'offered', 'confirmed', 'expired', 'cancelled');
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);

CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"actor_role" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "booking_passengers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"age" integer NOT NULL,
	"gender" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "booking_passengers_age_valid" CHECK ("booking_passengers"."age" >= 0 AND "booking_passengers"."age" <= 120)
);

CREATE TABLE "booking_seats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"run_seat_id" uuid NOT NULL,
	"passenger_id" uuid NOT NULL,
	"fare_paise" integer NOT NULL
);

CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(20) NOT NULL,
	"user_id" text NOT NULL,
	"run_id" uuid NOT NULL,
	"from_stop_index" integer NOT NULL,
	"to_stop_index" integer NOT NULL,
	"travel_class" "travel_class" NOT NULL,
	"passenger_count" integer NOT NULL,
	"total_fare_paise" integer NOT NULL,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"idempotency_key" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	CONSTRAINT "bookings_valid_range" CHECK ("bookings"."to_stop_index" > "bookings"."from_stop_index"),
	CONSTRAINT "bookings_passenger_count_positive" CHECK ("bookings"."passenger_count" > 0),
	CONSTRAINT "bookings_fare_non_negative" CHECK ("bookings"."total_fare_paise" >= 0)
);

CREATE TABLE "coach_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(16) NOT NULL,
	"name" text NOT NULL,
	"travel_class" "travel_class" NOT NULL,
	"layout_style" text NOT NULL,
	"total_seats" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coach_templates_total_positive" CHECK ("coach_templates"."total_seats" > 0)
);

CREATE TABLE "disruptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"severity" "disruption_severity" DEFAULT 'warning' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);

CREATE TABLE "fares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid NOT NULL,
	"travel_class" "travel_class" NOT NULL,
	"from_stop_index" integer NOT NULL,
	"to_stop_index" integer NOT NULL,
	"amount_paise" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fares_valid_range" CHECK ("fares"."to_stop_index" > "fares"."from_stop_index"),
	CONSTRAINT "fares_amount_non_negative" CHECK ("fares"."amount_paise" >= 0)
);

CREATE TABLE "hold_seats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hold_id" uuid NOT NULL,
	"run_seat_id" uuid NOT NULL
);

CREATE TABLE "operator_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"train_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "payments_demo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"amount_paise" integer NOT NULL,
	"status" "payment_status" DEFAULT 'succeeded' NOT NULL,
	"method" text DEFAULT 'demo_card' NOT NULL,
	"idempotency_key" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_demo_amount_non_negative" CHECK ("payments_demo"."amount_paise" >= 0)
);

CREATE TABLE "role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"role" "app_role" NOT NULL,
	"granted_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "route_stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	"stop_index" integer NOT NULL,
	"distance_km" integer NOT NULL,
	"scheduled_offset_minutes" integer NOT NULL,
	CONSTRAINT "route_stops_index_non_negative" CHECK ("route_stops"."stop_index" >= 0),
	CONSTRAINT "route_stops_distance_non_negative" CHECK ("route_stops"."distance_km" >= 0)
);

CREATE TABLE "routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(16) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "run_coaches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"coach_code" varchar(8) NOT NULL,
	"position" integer NOT NULL,
	"travel_class" "travel_class" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "run_seats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_coach_id" uuid NOT NULL,
	"seat_number" integer NOT NULL,
	"berth_type" "berth_type" NOT NULL,
	"deck" text DEFAULT 'lower' NOT NULL,
	"row_index" integer NOT NULL,
	"position_in_row" integer NOT NULL,
	"is_accessible" boolean DEFAULT false NOT NULL
);

CREATE TABLE "seat_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"run_id" uuid NOT NULL,
	"from_stop_index" integer NOT NULL,
	"to_stop_index" integer NOT NULL,
	"travel_class" "travel_class" NOT NULL,
	"passenger_count" integer NOT NULL,
	"status" "hold_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"idempotency_key" varchar(100) NOT NULL,
	"converted_booking_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seat_holds_valid_range" CHECK ("seat_holds"."to_stop_index" > "seat_holds"."from_stop_index"),
	CONSTRAINT "seat_holds_passenger_count_positive" CHECK ("seat_holds"."passenger_count" > 0)
);

CREATE TABLE "seat_segment_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_seat_id" uuid NOT NULL,
	"segment_index" integer NOT NULL,
	"hold_id" uuid,
	"booking_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seat_segment_claims_segment_non_negative" CHECK ("seat_segment_claims"."segment_index" >= 0),
	CONSTRAINT "seat_segment_claims_single_owner" CHECK ((CASE WHEN "seat_segment_claims"."hold_id" IS NULL THEN 0 ELSE 1 END) + (CASE WHEN "seat_segment_claims"."booking_id" IS NULL THEN 0 ELSE 1 END) = 1)
);

CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);

CREATE TABLE "stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(8) NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "template_seats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"seat_number" integer NOT NULL,
	"berth_type" "berth_type" NOT NULL,
	"deck" text DEFAULT 'lower' NOT NULL,
	"row_index" integer NOT NULL,
	"position_in_row" integer NOT NULL,
	"is_accessible" boolean DEFAULT false NOT NULL,
	CONSTRAINT "template_seats_number_positive" CHECK ("template_seats"."seat_number" > 0)
);

CREATE TABLE "train_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"train_id" uuid NOT NULL,
	"service_date" date NOT NULL,
	"departure_at" timestamp with time zone NOT NULL,
	"arrival_at" timestamp with time zone NOT NULL,
	"status" "run_status" DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "train_runs_arrival_after_departure" CHECK ("train_runs"."arrival_at" > "train_runs"."departure_at")
);

CREATE TABLE "trains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(12) NOT NULL,
	"name" text NOT NULL,
	"route_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);

CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"run_id" uuid NOT NULL,
	"from_stop_index" integer NOT NULL,
	"to_stop_index" integer NOT NULL,
	"travel_class" "travel_class" NOT NULL,
	"passenger_count" integer NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"status" "waitlist_status" DEFAULT 'waiting' NOT NULL,
	"offered_hold_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_valid_range" CHECK ("waitlist_entries"."to_stop_index" > "waitlist_entries"."from_stop_index"),
	CONSTRAINT "waitlist_passenger_count_positive" CHECK ("waitlist_entries"."passenger_count" > 0)
);

ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "booking_passengers" ADD CONSTRAINT "booking_passengers_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "booking_seats" ADD CONSTRAINT "booking_seats_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "booking_seats" ADD CONSTRAINT "booking_seats_run_seat_id_run_seats_id_fk" FOREIGN KEY ("run_seat_id") REFERENCES "public"."run_seats"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "booking_seats" ADD CONSTRAINT "booking_seats_passenger_id_booking_passengers_id_fk" FOREIGN KEY ("passenger_id") REFERENCES "public"."booking_passengers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_run_id_train_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."train_runs"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "disruptions" ADD CONSTRAINT "disruptions_run_id_train_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."train_runs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "disruptions" ADD CONSTRAINT "disruptions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "fares" ADD CONSTRAINT "fares_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "hold_seats" ADD CONSTRAINT "hold_seats_hold_id_seat_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."seat_holds"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "hold_seats" ADD CONSTRAINT "hold_seats_run_seat_id_run_seats_id_fk" FOREIGN KEY ("run_seat_id") REFERENCES "public"."run_seats"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "operator_scopes" ADD CONSTRAINT "operator_scopes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "operator_scopes" ADD CONSTRAINT "operator_scopes_train_id_trains_id_fk" FOREIGN KEY ("train_id") REFERENCES "public"."trains"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "payments_demo" ADD CONSTRAINT "payments_demo_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "run_coaches" ADD CONSTRAINT "run_coaches_run_id_train_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."train_runs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "run_coaches" ADD CONSTRAINT "run_coaches_template_id_coach_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."coach_templates"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "run_seats" ADD CONSTRAINT "run_seats_run_coach_id_run_coaches_id_fk" FOREIGN KEY ("run_coach_id") REFERENCES "public"."run_coaches"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "seat_holds" ADD CONSTRAINT "seat_holds_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "seat_holds" ADD CONSTRAINT "seat_holds_run_id_train_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."train_runs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "seat_holds" ADD CONSTRAINT "seat_holds_converted_booking_id_bookings_id_fk" FOREIGN KEY ("converted_booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "seat_segment_claims" ADD CONSTRAINT "seat_segment_claims_run_seat_id_run_seats_id_fk" FOREIGN KEY ("run_seat_id") REFERENCES "public"."run_seats"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "seat_segment_claims" ADD CONSTRAINT "seat_segment_claims_hold_id_seat_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."seat_holds"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "seat_segment_claims" ADD CONSTRAINT "seat_segment_claims_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "template_seats" ADD CONSTRAINT "template_seats_template_id_coach_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."coach_templates"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "train_runs" ADD CONSTRAINT "train_runs_train_id_trains_id_fk" FOREIGN KEY ("train_id") REFERENCES "public"."trains"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "trains" ADD CONSTRAINT "trains_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_run_id_train_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."train_runs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_offered_hold_id_seat_holds_id_fk" FOREIGN KEY ("offered_hold_id") REFERENCES "public"."seat_holds"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");
CREATE INDEX "booking_passengers_booking_idx" ON "booking_passengers" USING btree ("booking_id");
CREATE UNIQUE INDEX "booking_seats_booking_seat_unique" ON "booking_seats" USING btree ("booking_id","run_seat_id");
CREATE UNIQUE INDEX "booking_seats_passenger_unique" ON "booking_seats" USING btree ("passenger_id");
CREATE INDEX "booking_seats_booking_idx" ON "booking_seats" USING btree ("booking_id");
CREATE UNIQUE INDEX "bookings_reference_unique" ON "bookings" USING btree ("reference");
CREATE UNIQUE INDEX "bookings_idempotency_unique" ON "bookings" USING btree ("idempotency_key");
CREATE INDEX "bookings_user_created_idx" ON "bookings" USING btree ("user_id","created_at");
CREATE INDEX "bookings_run_idx" ON "bookings" USING btree ("run_id");
CREATE UNIQUE INDEX "coach_templates_code_unique" ON "coach_templates" USING btree ("code");
CREATE INDEX "disruptions_run_idx" ON "disruptions" USING btree ("run_id");
CREATE UNIQUE INDEX "fares_route_class_pair_unique" ON "fares" USING btree ("route_id","travel_class","from_stop_index","to_stop_index");
CREATE UNIQUE INDEX "hold_seats_hold_seat_unique" ON "hold_seats" USING btree ("hold_id","run_seat_id");
CREATE INDEX "hold_seats_hold_idx" ON "hold_seats" USING btree ("hold_id");
CREATE UNIQUE INDEX "operator_scopes_user_train_unique" ON "operator_scopes" USING btree ("user_id","train_id");
CREATE INDEX "operator_scopes_user_idx" ON "operator_scopes" USING btree ("user_id");
CREATE UNIQUE INDEX "payments_demo_booking_unique" ON "payments_demo" USING btree ("booking_id");
CREATE UNIQUE INDEX "payments_demo_idempotency_unique" ON "payments_demo" USING btree ("idempotency_key");
CREATE UNIQUE INDEX "role_assignments_user_role_unique" ON "role_assignments" USING btree ("user_id","role");
CREATE INDEX "role_assignments_user_idx" ON "role_assignments" USING btree ("user_id");
CREATE UNIQUE INDEX "route_stops_route_index_unique" ON "route_stops" USING btree ("route_id","stop_index");
CREATE UNIQUE INDEX "route_stops_route_station_unique" ON "route_stops" USING btree ("route_id","station_id");
CREATE UNIQUE INDEX "routes_code_unique" ON "routes" USING btree ("code");
CREATE UNIQUE INDEX "run_coaches_run_code_unique" ON "run_coaches" USING btree ("run_id","coach_code");
CREATE UNIQUE INDEX "run_coaches_run_position_unique" ON "run_coaches" USING btree ("run_id","position");
CREATE INDEX "run_coaches_run_idx" ON "run_coaches" USING btree ("run_id");
CREATE UNIQUE INDEX "run_seats_coach_number_unique" ON "run_seats" USING btree ("run_coach_id","seat_number");
CREATE INDEX "run_seats_coach_idx" ON "run_seats" USING btree ("run_coach_id");
CREATE UNIQUE INDEX "seat_holds_idempotency_unique" ON "seat_holds" USING btree ("idempotency_key");
CREATE INDEX "seat_holds_status_expiry_idx" ON "seat_holds" USING btree ("status","expires_at");
CREATE INDEX "seat_holds_run_idx" ON "seat_holds" USING btree ("run_id");
CREATE INDEX "seat_holds_user_idx" ON "seat_holds" USING btree ("user_id");
CREATE UNIQUE INDEX "seat_segment_claims_seat_segment_unique" ON "seat_segment_claims" USING btree ("run_seat_id","segment_index");
CREATE INDEX "seat_segment_claims_hold_idx" ON "seat_segment_claims" USING btree ("hold_id");
CREATE INDEX "seat_segment_claims_booking_idx" ON "seat_segment_claims" USING btree ("booking_id");
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");
CREATE UNIQUE INDEX "stations_code_unique" ON "stations" USING btree ("code");
CREATE UNIQUE INDEX "template_seats_template_number_unique" ON "template_seats" USING btree ("template_id","seat_number");
CREATE UNIQUE INDEX "train_runs_train_date_unique" ON "train_runs" USING btree ("train_id","service_date");
CREATE INDEX "train_runs_service_date_idx" ON "train_runs" USING btree ("service_date");
CREATE UNIQUE INDEX "trains_code_unique" ON "trains" USING btree ("code");
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");
CREATE INDEX "waitlist_run_queue_idx" ON "waitlist_entries" USING btree ("run_id","travel_class","status","priority","created_at");
CREATE INDEX "waitlist_user_idx" ON "waitlist_entries" USING btree ("user_id");
ALTER TABLE "seat_holds" ADD COLUMN "passenger_draft" jsonb;
