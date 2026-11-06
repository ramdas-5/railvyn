-- ===========================================================================
-- RAILVYN — bulk demonstration data (Part 3)
--
-- Adds 1,000+ rows to every operational table on top of db/seed.sql:
--   stations 1,000 · routes 1,420 · route_stops 50,520 · trains 1,420
--   runs 9,940 · coaches 19,880 · seats 1,351,840 · fares 112,000
--   riders 1,000 · bookings 1,200 · claims 1,200 · waitlist 1,200
--   disruptions 1,000 · audit 1,200 · expired holds 1,000
--
-- Every generated route has a train with one departure on each of the next
-- seven days (today .. today+6), so the date picked in search always returns
-- departures. Runs are keyed by train, day and seed date, so re-running the
-- file extends the window instead of duplicating it.
--
-- A dense all-pairs network (420 synthetic corridors built from 20 station
-- blocks) guarantees that every station pair shares at least one route, so
-- any boarding/alighting combination returns trains.
--
-- Everything is generated inside PostgreSQL with generate_series, so this file
-- stays small enough for the Neon SQL Editor. IDs, codes and journeys are
-- deterministic: re-running it is safe (conflicting rows are skipped).
--
-- No row is a duplicate of another: every station has a unique name/city pair,
-- booking and reference values are unique, each rider appears at most once per
-- run in the waitlist, and disruption/audit rows carry a unique sequence.
--
-- Apply AFTER db/seed.sql (it reuses the seeded demo users and coach
-- templates). Run pnpm db:seed:bulk to apply it from a terminal.
-- ===========================================================================

begin;

/* Repair rows written by older versions of this file -------------------
   Re-running the bulk seed must not leave earlier duplicates behind. Only
   rows with this file's deterministic IDs are touched.
   - older seeds reused 30 station names: rewrite the generated stations
   - older seeds queued the same rider twice for one run: drop the extras
   - older seeds repeated disruption and audit rows: rebuild them below
   - older seeds reused 12 passenger names: rewrite the generated passengers */

update stations s
set name = src.name,
    city = src.city,
    state = src.state
from (
  select
    md5('bulk-station:' || i)::uuid as id,
    x.city || ' ' || x.station_type as name,
    x.city,
    x.state
  from generate_series(1, 1000) as i
  cross join lateral (
    select
      (array['Ram','Nan','Vijay','Krishna','Sundar','Dev','Anand','Shiv','Chand','Govind','Hari','Lakshmi','Madhav','Ganga','Yamuna','Kavi','Nava','Raj','Surya','Chandra'])[1 + ((i - 1) / 50)]
        || (array['pur','garh','nagar','patnam','wada','kot','ganj','palli','durg','khera'])[1 + (((i - 1) / 5) % 10)] as city,
      (array['Junction','Central','Halt','Road','Terminus'])[1 + ((i - 1) % 5)] as station_type,
      (array['Delhi','Maharashtra','Karnataka','Tamil Nadu','West Bengal','Gujarat','Rajasthan','Uttar Pradesh','Telangana','Bihar'])[1 + (((i - 1) / 50) % 10)] as state
  ) as x
) as src
where s.id = src.id
  and (s.name <> src.name or s.city <> src.city or s.state <> src.state);

delete from seat_segment_claims
where booking_id in (
  select md5('bulk-booking:' || i)::uuid from generate_series(1001, 1200) as i
);

delete from payments_demo
where booking_id in (
  select md5('bulk-booking:' || i)::uuid from generate_series(1001, 1200) as i
);

delete from booking_seats
where booking_id in (
  select md5('bulk-booking:' || i)::uuid from generate_series(1001, 1200) as i
);

delete from booking_passengers
where booking_id in (
  select md5('bulk-booking:' || i)::uuid from generate_series(1001, 1200) as i
);

delete from bookings
where id in (
  select md5('bulk-booking:' || i)::uuid from generate_series(1001, 1200) as i
);

delete from waitlist_entries
where id in (
  select md5('bulk-wait:' || i)::uuid from generate_series(1001, 1200) as i
);

delete from disruptions
where id in (
  select md5('bulk-disruption:' || i)::uuid from generate_series(1, 1200) as i
);

delete from audit_logs
where id in (
  select md5('bulk-audit:' || i)::uuid from generate_series(1, 1200) as i
);

update booking_passengers bp
set full_name = src.full_name,
    age = src.age,
    gender = src.gender
from (
  select
    md5('bulk-bp:' || i)::uuid as id,
    (array['Aarav','Vivaan','Aditya','Vihaan','Arjun','Sai','Reyansh','Ayaan','Krishna','Ishaan','Shaurya','Atharv','Advik','Pranav','Dhruv','Kabir','Ritvik','Aarush','Kayaan','Darsh','Rudra','Yash','Vedant','Abhinav','Ananya','Diya','Aadhya','Saanvi','Myra','Anika','Navya','Kiara','Aarohi','Ira','Riya','Sara','Nisha','Meera','Kavya','Ishita'])[1 + ((i - 1) % 40)]
      || ' ' ||
    (array['Sharma','Verma','Nair','Rao','Menon','Iyer','Patel','Reddy','Gupta','Singh','Khan','Bose','Kulkarni','Yadav','Mehta','Joshi','Chopra','Desai','Malhotra','Das','Pillai','Shah','Kapoor','Mishra','Ghosh','Shetty','Trivedi','Banerjee','Chauhan','Naidu'])[1 + (((i - 1) / 40) % 30)] as full_name,
    18 + (i % 55) as age,
    case when ((i - 1) % 40) >= 24 then 'female' else 'male' end as gender
  from generate_series(1, 1200) as i
) as src
where bp.id = src.id;

/* Stations ------------------------------------------------------------- */
insert into stations (id, code, name, city, state)
select
  md5('bulk-station:' || i)::uuid,
  'D' || lpad(i::text, 4, '0'),
  s.city || ' ' || s.station_type,
  s.city,
  s.state
from generate_series(1, 1000) as i
cross join lateral (
  select
    (array['Ram','Nan','Vijay','Krishna','Sundar','Dev','Anand','Shiv','Chand','Govind','Hari','Lakshmi','Madhav','Ganga','Yamuna','Kavi','Nava','Raj','Surya','Chandra'])[1 + ((i - 1) / 50)]
      || (array['pur','garh','nagar','patnam','wada','kot','ganj','palli','durg','khera'])[1 + (((i - 1) / 5) % 10)] as city,
    (array['Junction','Central','Halt','Road','Terminus'])[1 + ((i - 1) % 5)] as station_type,
    (array['Delhi','Maharashtra','Karnataka','Tamil Nadu','West Bengal','Gujarat','Rajasthan','Uttar Pradesh','Telangana','Bihar'])[1 + (((i - 1) / 50) % 10)] as state
) as s
on conflict (code) do nothing;

/* Routes and ordered stops --------------------------------------------- */
insert into routes (id, code, name, description)
select
  md5('bulk-route:' || i)::uuid,
  'BULK-' || lpad(i::text, 4, '0'),
  'Demonstration Corridor ' || lpad(i::text, 4, '0'),
  'Synthetic multi-stop corridor generated for load and scale testing.'
from generate_series(1, 1000) as i
on conflict (code) do nothing;

insert into route_stops (id, route_id, station_id, stop_index, distance_km, scheduled_offset_minutes)
select
  md5('bulk-stop:' || i || ':' || k)::uuid,
  r.id,
  s.id,
  k,
  (k * 70) + ((i % 7) * 5),
  k * 85
from generate_series(1, 1000) as i
cross join generate_series(0, 7) as k
join routes r on r.code = 'BULK-' || lpad(i::text, 4, '0')
join stations s on s.code = 'D' || lpad((((i * 37) + (k * 53)) % 1000 + 1)::text, 4, '0')
on conflict do nothing;

/* Trains and dated runs ------------------------------------------------ */
insert into trains (id, code, name, route_id, active)
select
  md5('bulk-train:' || i)::uuid,
  'T' || lpad(i::text, 4, '0'),
  'Bulk Express ' || lpad(i::text, 4, '0'),
  r.id,
  true
from generate_series(1, 1000) as i
join routes r on r.code = 'BULK-' || lpad(i::text, 4, '0')
on conflict (code) do nothing;

insert into train_runs (id, train_id, service_date, departure_at, arrival_at, status, notes)
select
  md5('bulk-run:' || i || ':' || d || ':' || to_char(b.base_date, 'YYYYMMDD'))::uuid,
  t.id,
  b.base_date + d,
  (b.base_date + d + time '05:00' + make_interval(hours => i % 18)) at time zone 'Asia/Kolkata',
  (b.base_date + d + time '05:00' + make_interval(hours => i % 18) + interval '700 minutes') at time zone 'Asia/Kolkata',
  (case
     when (i + d) % 31 = 0 then 'cancelled'
     when (i + d) % 17 = 0 then 'disrupted'
     else 'scheduled'
   end)::run_status,
  null
from generate_series(1, 1000) as i
cross join generate_series(0, 6) as d
cross join (select (now() at time zone 'Asia/Kolkata')::date as base_date) as b
join trains t on t.code = 'T' || lpad(i::text, 4, '0')
on conflict (train_id, service_date) do nothing;

/* Coaches and seats ---------------------------------------------------- */
insert into run_coaches (id, run_id, template_id, coach_code, position, travel_class)
select
  md5('bulk-coach:' || i || ':' || d || ':' || c.code)::uuid,
  r.id,
  ct.id,
  c.code,
  c.position,
  c.travel_class::travel_class
from generate_series(1, 1000) as i
cross join generate_series(0, 6) as d
cross join (select (now() at time zone 'Asia/Kolkata')::date as base_date) as b
join trains t on t.code = 'T' || lpad(i::text, 4, '0')
join train_runs r on r.train_id = t.id and r.service_date = b.base_date + d
cross join (values
  ('S1', 'SL72', 'sleeper', 1),
  ('B1', '3A64', 'ac3', 2)
) as c(code, template_code, travel_class, position)
join coach_templates ct on ct.code = c.template_code
on conflict do nothing;

insert into run_seats (id, run_coach_id, seat_number, berth_type, deck, row_index, position_in_row, is_accessible)
select
  md5('bulk-seat:' || rc.id || ':' || ts.seat_number)::uuid,
  rc.id,
  ts.seat_number,
  ts.berth_type,
  ts.deck,
  ts.row_index,
  ts.position_in_row,
  ts.is_accessible
from run_coaches rc
join train_runs r on r.id = rc.run_id
join trains t on t.id = r.train_id
join template_seats ts on ts.template_id = rc.template_id
where t.code ~ '^T[0-9]{4}$'
on conflict (run_coach_id, seat_number) do nothing;

/* Fares: every stop pair for all four classes -------------------------- */
insert into fares (id, route_id, travel_class, from_stop_index, to_stop_index, amount_paise)
select
  md5('bulk-fare:' || r.id || ':' || c.travel_class || ':' || a.k || ':' || b.k)::uuid,
  r.id,
  c.travel_class::travel_class,
  a.k,
  b.k,
  greatest(5000, (round(((c.base_paise + c.per_km_paise * ((b.k - a.k) * 70))::numeric) / 500) * 500))::int
from routes r
cross join (values
  ('sleeper', 15000, 35),
  ('ac3', 55000, 90),
  ('ac2', 95000, 140),
  ('chair', 30000, 55)
) as c(travel_class, base_paise, per_km_paise)
cross join generate_series(0, 7) as a(k)
cross join generate_series(0, 7) as b(k)
where r.code like 'BULK-%'
  and b.k > a.k
on conflict do nothing;

/* Demo riders (same password as the seeded accounts) ------------------- */
insert into "user" (id, name, email, email_verified, created_at, updated_at)
select
  md5('bulk-user:' || i)::uuid::text,
  'Demo Rider ' || lpad(i::text, 4, '0'),
  'rider' || lpad(i::text, 4, '0') || '@railvyn.demo',
  true,
  now(),
  now()
from generate_series(1, 1000) as i
on conflict (email) do nothing;

insert into account (id, account_id, provider_id, user_id, password, created_at, updated_at)
select
  md5('bulk-account:' || i)::uuid::text,
  u.id,
  'credential',
  u.id,
  (select a.password from account a where a.provider_id = 'credential' order by a.created_at limit 1),
  now(),
  now()
from generate_series(1, 1000) as i
join "user" u on u.email = 'rider' || lpad(i::text, 4, '0') || '@railvyn.demo'
on conflict (id) do nothing;

insert into role_assignments (id, user_id, role, created_at)
select
  md5('bulk-role:' || i)::uuid,
  u.id,
  'passenger',
  now()
from generate_series(1, 1000) as i
join "user" u on u.email = 'rider' || lpad(i::text, 4, '0') || '@railvyn.demo'
on conflict do nothing;

/* Bookings: one per run, plus a second seat on the first 200 runs by
   a different rider, so no rider books the same run twice --------------- */
insert into bookings (
  id, reference, user_id, run_id, from_stop_index, to_stop_index, travel_class,
  passenger_count, total_fare_paise, status, contact_email, contact_phone,
  idempotency_key, created_at
)
select
  md5('bulk-booking:' || i)::uuid,
  'RVN-B' || lpad(i::text, 6, '0'),
  u.id,
  r.id,
  0,
  1,
  'sleeper',
  1,
  17500,
  'confirmed',
  u.email,
  '+91-90000-' || lpad(i::text, 5, '0'),
  'bulk-booking-' || i,
  now() - make_interval(days => i % 30)
from generate_series(1, 1200) as i
join trains t on t.code = 'T' || lpad((((i - 1) % 1000) + 1)::text, 4, '0')
join train_runs r on r.train_id = t.id
  and r.service_date = (now() at time zone 'Asia/Kolkata')::date
join "user" u on u.email = 'rider' || lpad((case when i <= 1000 then i else i - 500 end)::text, 4, '0') || '@railvyn.demo'
on conflict do nothing;

insert into booking_passengers (id, booking_id, full_name, age, gender, position)
select
  md5('bulk-bp:' || i)::uuid,
  b.id,
  (array['Aarav','Vivaan','Aditya','Vihaan','Arjun','Sai','Reyansh','Ayaan','Krishna','Ishaan','Shaurya','Atharv','Advik','Pranav','Dhruv','Kabir','Ritvik','Aarush','Kayaan','Darsh','Rudra','Yash','Vedant','Abhinav','Ananya','Diya','Aadhya','Saanvi','Myra','Anika','Navya','Kiara','Aarohi','Ira','Riya','Sara','Nisha','Meera','Kavya','Ishita'])[1 + ((i - 1) % 40)]
    || ' ' ||
  (array['Sharma','Verma','Nair','Rao','Menon','Iyer','Patel','Reddy','Gupta','Singh','Khan','Bose','Kulkarni','Yadav','Mehta','Joshi','Chopra','Desai','Malhotra','Das','Pillai','Shah','Kapoor','Mishra','Ghosh','Shetty','Trivedi','Banerjee','Chauhan','Naidu'])[1 + (((i - 1) / 40) % 30)],
  18 + (i % 55),
  case when ((i - 1) % 40) >= 24 then 'female' else 'male' end,
  1
from generate_series(1, 1200) as i
join bookings b on b.id = md5('bulk-booking:' || i)::uuid
on conflict do nothing;

insert into booking_seats (id, booking_id, run_seat_id, passenger_id, fare_paise)
select
  md5('bulk-bs:' || i)::uuid,
  b.id,
  rs.id,
  bp.id,
  17500
from generate_series(1, 1200) as i
join bookings b on b.id = md5('bulk-booking:' || i)::uuid
join booking_passengers bp on bp.id = md5('bulk-bp:' || i)::uuid
join run_coaches rc on rc.run_id = b.run_id and rc.coach_code = 'S1'
join run_seats rs on rs.run_coach_id = rc.id
  and rs.seat_number = 1 + (((i - 1) / 1000)::int)
on conflict do nothing;

insert into seat_segment_claims (id, run_seat_id, segment_index, booking_id, created_at)
select
  md5('bulk-claim:' || i)::uuid,
  bs.run_seat_id,
  0,
  bs.booking_id,
  now()
from generate_series(1, 1200) as i
join booking_seats bs on bs.id = md5('bulk-bs:' || i)::uuid
on conflict (run_seat_id, segment_index) do nothing;

insert into payments_demo (id, booking_id, amount_paise, status, method, idempotency_key, created_at)
select
  md5('bulk-payment:' || i)::uuid,
  b.id,
  17500,
  'succeeded',
  'demo_card',
  'bulk-payment-' || i,
  now()
from generate_series(1, 1200) as i
join bookings b on b.id = md5('bulk-booking:' || i)::uuid
on conflict do nothing;

/* Waitlist queue: one request per run, plus a second queue entry from a
   different rider on runs 1-200 so the FIFO demo has two people per run -- */
insert into waitlist_entries (
  id, user_id, run_id, from_stop_index, to_stop_index, travel_class,
  passenger_count, priority, status, created_at, updated_at
)
select
  md5('bulk-wait:' || i)::uuid,
  u.id,
  r.id,
  0,
  1,
  'sleeper',
  1,
  i % 2,
  (array['waiting','offered','expired','cancelled'])[1 + (i % 4)]::waitlist_status,
  now() - make_interval(days => i % 20),
  now()
from generate_series(1, 1200) as i
join trains t on t.code = 'T' || lpad((((i - 1) % 1000) + 1)::text, 4, '0')
join train_runs r on r.train_id = t.id
  and r.service_date = (now() at time zone 'Asia/Kolkata')::date
join "user" u on u.email = 'rider' || lpad((case when i <= 1000 then i else i - 500 end)::text, 4, '0') || '@railvyn.demo'
on conflict do nothing;

/* Expired holds (no live claims, historical records only) -------------- */
insert into seat_holds (
  id, user_id, run_id, from_stop_index, to_stop_index, travel_class,
  passenger_count, status, expires_at, idempotency_key, created_at
)
select
  md5('bulk-hold:' || i)::uuid,
  u.id,
  r.id,
  0,
  1,
  'sleeper',
  1,
  'expired',
  now() - make_interval(hours => 6 + (i % 48)),
  'bulk-hold-' || i,
  now() - make_interval(days => 1 + (i % 14))
from generate_series(1, 1000) as i
join trains t on t.code = 'T' || lpad((((i - 1) % 1000) + 1)::text, 4, '0')
join train_runs r on r.train_id = t.id
  and r.service_date = (now() at time zone 'Asia/Kolkata')::date
join "user" u on u.email = 'rider' || lpad((((i - 1) % 1000) + 1)::text, 4, '0') || '@railvyn.demo'
on conflict do nothing;

/* Disruptions and audit trail: one incident per run, unique audit rows -- */
insert into disruptions (id, run_id, title, description, severity, created_by, created_at, resolved_at)
select
  md5('bulk-disruption:' || i)::uuid,
  r.id,
  (array['Signal delay','Rolling stock swap','Weather advisory','Platform change','Track maintenance'])[1 + (i % 5)],
  'Generated demonstration incident ' || lpad(i::text, 4, '0') || ' for ' || t.code
    || ' (' || r.service_date || '): synthetic record for operator workflows and load testing.',
  (array['info','warning','critical'])[1 + (i % 3)]::disruption_severity,
  (select id from "user" where email = 'admin@railvyn.demo'),
  now() - make_interval(days => i % 15),
  case when i % 3 = 0 then now() - make_interval(days => i % 5) else null end
from generate_series(1, 1000) as i
join trains t on t.code = 'T' || lpad(i::text, 4, '0')
join train_runs r on r.train_id = t.id
  and r.service_date = (now() at time zone 'Asia/Kolkata')::date
on conflict do nothing;

insert into audit_logs (id, actor_user_id, actor_role, action, entity_type, entity_id, metadata, created_at)
select
  md5('bulk-audit:' || i)::uuid,
  (select id from "user" where email = 'admin@railvyn.demo'),
  case when i % 3 = 0 then 'admin' else 'operator' end,
  (array['run.disrupted','booking.cancelled','waitlist.promoted','fare.updated','coach.reassigned'])[1 + (i % 5)],
  'run',
  r.id::text,
  jsonb_build_object('batch', true, 'source', 'bulk-seed', 'sequence', i),
  now() - make_interval(mins => i * 29)
from generate_series(1, 1200) as i
join trains t on t.code = 'T' || lpad((((i - 1) % 1000) + 1)::text, 4, '0')
join train_runs r on r.train_id = t.id
  and r.service_date = (now() at time zone 'Asia/Kolkata')::date
on conflict do nothing;

/* Dense all-pairs network ----------------------------------------------
   The sparse corridors above only connect eight stops each. This block adds
   a synthetic network that guarantees every station pair shares a route:
   stations are split into 20 blocks, every ordered block pair gets a corridor
   (block A stops then block B stops), and each block gets forward/reverse
   local corridors. Pairs inside a block use the local routes; pairs in
   different blocks use the A -> B corridor. */

with station_blocks as (
  select id, code, ntile(20) over (order by code) as block_no
  from stations
),
block_pairs as (
  select a.block_no as block_a, b.block_no as block_b
  from generate_series(1, 20) as a(block_no)
  cross join generate_series(1, 20) as b(block_no)
  where a.block_no <> b.block_no
)
insert into routes (id, code, name, description)
select
  md5('dense-route:' || block_a || ':' || block_b)::uuid,
  'DN-' || lpad(block_a::text, 2, '0') || '-' || lpad(block_b::text, 2, '0'),
  'Dense corridor ' || block_a || ' to ' || block_b,
  'Synthetic all-pairs corridor generated for demonstration searches.'
from block_pairs
on conflict (code) do nothing;

insert into routes (id, code, name, description)
select
  md5('dense-local:' || b.block_no || ':' || d.dir)::uuid,
  'DL-' || lpad(b.block_no::text, 2, '0') || '-' || d.dir,
  'Dense local ' || b.block_no || ' ' || case d.dir when 'F' then 'forward' else 'reverse' end,
  'Synthetic all-pairs corridor generated for demonstration searches.'
from generate_series(1, 20) as b(block_no)
cross join (values ('F'), ('R')) as d(dir)
on conflict (code) do nothing;

with station_blocks as (
  select id, code, ntile(20) over (order by code) as block_no
  from stations
),
cross_order as (
  select
    r.id as route_id,
    sb.id as station_id,
    row_number() over (
      partition by r.id
      order by (sb.block_no = (split_part(r.code, '-', 2))::int) desc, sb.code
    ) as rn
  from routes r
  join station_blocks sb
    on sb.block_no in (
      (split_part(r.code, '-', 2))::int,
      (split_part(r.code, '-', 3))::int
    )
  where r.code like 'DN-%'
)
insert into route_stops (id, route_id, station_id, stop_index, distance_km, scheduled_offset_minutes)
select
  md5('dense-stop:' || route_id || ':' || station_id)::uuid,
  route_id,
  station_id,
  (rn - 1)::int,
  ((rn - 1) * 20)::int,
  ((rn - 1) * 5)::int
from cross_order
on conflict do nothing;

with station_blocks as (
  select id, code, ntile(20) over (order by code) as block_no
  from stations
),
local_order as (
  select
    r.id as route_id,
    sb.id as station_id,
    row_number() over (
      partition by r.id
      order by
        case when split_part(r.code, '-', 3) = 'F' then sb.code end asc,
        case when split_part(r.code, '-', 3) = 'R' then sb.code end desc
    ) as rn
  from routes r
  join station_blocks sb
    on sb.block_no = (split_part(r.code, '-', 2))::int
  where r.code like 'DL-%'
)
insert into route_stops (id, route_id, station_id, stop_index, distance_km, scheduled_offset_minutes)
select
  md5('dense-stop:' || route_id || ':' || station_id)::uuid,
  route_id,
  station_id,
  (rn - 1)::int,
  ((rn - 1) * 20)::int,
  ((rn - 1) * 5)::int
from local_order
on conflict do nothing;

insert into trains (id, code, name, route_id, active)
select
  md5('dense-train:' || r.code)::uuid,
  'DT' || replace(substr(r.code, 4), '-', ''),
  'Dense Express ' || replace(r.code, '-', ' '),
  r.id,
  true
from routes r
where r.code like 'DN-%' or r.code like 'DL-%'
on conflict (code) do nothing;

with stop_counts as (
  select route_id, count(*)::int as stop_count
  from route_stops
  group by route_id
)
insert into train_runs (id, train_id, service_date, departure_at, arrival_at, status, notes)
select
  md5('dense-run:' || t.code || ':' || d || ':' || to_char(b.base_date, 'YYYYMMDD'))::uuid,
  t.id,
  b.base_date + d,
  (b.base_date + d + time '06:00' + make_interval(hours => mod(abs(hashtext(t.code)), 11))) at time zone 'Asia/Kolkata',
  (b.base_date + d + time '06:00' + make_interval(hours => mod(abs(hashtext(t.code)), 11))
    + make_interval(mins => (sc.stop_count - 1) * 5)) at time zone 'Asia/Kolkata',
  'scheduled',
  null
from trains t
join stop_counts sc on sc.route_id = t.route_id
cross join generate_series(0, 6) as d
cross join (select (now() at time zone 'Asia/Kolkata')::date as base_date) as b
where t.code like 'DT%'
on conflict (train_id, service_date) do nothing;

insert into run_coaches (id, run_id, template_id, coach_code, position, travel_class)
select
  md5('dense-coach:' || r.id || ':' || c.code)::uuid,
  r.id,
  ct.id,
  c.code,
  c.position,
  c.travel_class::travel_class
from train_runs r
join trains t on t.id = r.train_id
cross join (values
  ('S1', 'SL72', 'sleeper', 1),
  ('B1', '3A64', 'ac3', 2)
) as c(code, template_code, travel_class, position)
join coach_templates ct on ct.code = c.template_code
where t.code like 'DT%'
on conflict do nothing;

insert into run_seats (id, run_coach_id, seat_number, berth_type, deck, row_index, position_in_row, is_accessible)
select
  md5('dense-seat:' || rc.id || ':' || ts.seat_number)::uuid,
  rc.id,
  ts.seat_number,
  ts.berth_type,
  ts.deck,
  ts.row_index,
  ts.position_in_row,
  ts.is_accessible
from run_coaches rc
join train_runs r on r.id = rc.run_id
join trains t on t.id = r.train_id
join template_seats ts on ts.template_id = rc.template_id
where t.code like 'DT%'
on conflict (run_coach_id, seat_number) do nothing;

commit;
