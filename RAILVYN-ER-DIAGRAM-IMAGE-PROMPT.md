# RAILVYN — ER Diagram Image Generation Prompt

> Use this file to generate a **clean, presentation-ready ER diagram image** for the RAILVYN PPT.
> Copy one prompt block, paste it into the image tool, and use the checklist at the end before putting it on a slide.
>
> **Important reality check:** AI image generators are excellent at *style* but weak at *long exact text*. If the entity names come out misspelled, use **Plan B** at the bottom (generate the visual, then type the labels yourself in PowerPoint / draw.io). A rough-looking-but-readable diagram scores better than a beautiful-but-garbled one.

---

## 1. Art direction brief (what we want to see)

| Item | Decision |
|---|---|
| **Aspect ratio** | 16:9 (1920 × 1080) so it fits a slide without cropping |
| **Style** | Flat vector technical diagram, thin 2px lines, square-ish rounded boxes (8px radius) |
| **Background** | Very light warm ivory `#F7F8F3`, no texture, no gradient |
| **Box fill** | White `#FFFFFF` with border `#CFD6CD` |
| **Text** | Dark charcoal `#161A17`, uppercase entity names, 20–24px, bold |
| **Highlight** | Only one box highlighted: `SEAT_SEGMENT_CLAIM` — fill `#DAF28F` (lime), border `#263416` |
| **Accent text** | Small captions in muted green `#48534B` |
| **Connectors** | Straight or right-angle arrows, `#343B36`, **crow's-foot** ends, relationship label `1 : N` on the line |
| **Reading direction** | Left → right, top → bottom, **no crossing lines** |
| **Title on image** | `RAILVYN — Entity Relationship Diagram` (top-left), caption below: `27 tables · 12 core entities shown` |
| **No** | Photos, 3D, shadows, glows, clip-art trains, emoji, logos, watermarks |

---

## 2. MASTER PROMPT (best for text-accurate tools)

Use with **GPT-Image / ChatGPT image / Ideogram / Nano Banana / Flux / Gemini image**.

````text
Create a clean, flat vector ENTITY RELATIONSHIP DIAGRAM for a railway booking
system, designed as a single presentation slide at 16:9 (1920 x 1080), warm ivory
background (#F7F8F3), technical and minimal, like a professional software
architecture poster. No 3D, no shadows, no gradients, no photos, no clip art.

TITLE (top-left, dark charcoal #161A17, bold, 40px):
"RAILVYN — Entity Relationship Diagram"
SUBTITLE (under title, muted green #48534B, 18px):
"27 tables · 12 core entities shown · UNIQUE(run_seat_id, segment_index)"

LAYOUT — three horizontal bands, left to right, straight connector lines, NO
crossing lines. Every entity is a white rounded rectangle with a thin grey border
(#CFD6CD), the entity name in uppercase bold 22px centred at the top, and 2 key
attributes listed in smaller 15px text underneath.

BAND 1 — NETWORK (top row, y = 15%)
Left to right: STATION → ROUTE_STOP → ROUTE → TRAIN → TRAIN_RUN
- STATION (id PK, code, city)
- ROUTE_STOP (route_id FK, stop_index, distance_km)
- ROUTE (id PK, code, name)
- TRAIN (id PK, code, route_id FK)
- TRAIN_RUN (id PK, train_id FK, service_date)
Relationship labels on the lines: STATION 1:N ROUTE_STOP, ROUTE 1:N ROUTE_STOP,
ROUTE 1:N TRAIN, TRAIN 1:N TRAIN_RUN.

BAND 2 — INVENTORY (middle row, y = 40%)
Centre left to right: COACH_TEMPLATE → RUN_COACH → RUN_SEAT, with
TEMPLATE_SEAT hanging below COACH_TEMPLATE and RUN_COACH connected upward to
TRAIN_RUN.
- COACH_TEMPLATE (id PK, class, layout_name)
- TEMPLATE_SEAT (template_id FK, seat_number, berth_type)
- RUN_COACH (id PK, run_id FK, coach_code)
- RUN_SEAT (id PK, run_coach_id FK, seat_number, berth_type)
Relationship labels: COACH_TEMPLATE 1:N TEMPLATE_SEAT,
COACH_TEMPLATE 1:N RUN_COACH, TRAIN_RUN 1:N RUN_COACH,
RUN_COACH 1:N RUN_SEAT.

BAND 3 — BOOKING (bottom row, y = 70%)
Left: USER. Centre: SEAT_HOLD and BOOKING. Right: BOOKING_PASSENGER and
WAITLIST_ENTRY. Far bottom-left small: AUDIT_LOG.
- USER (id PK, name, email)
- ROLE_ASSIGNMENT (user_id FK, role) attached below USER
- SEAT_HOLD (id PK, user_id FK, expires_at)
- BOOKING (id PK, reference, user_id FK, total_fare)
- BOOKING_PASSENGER (booking_id FK, full_name, age)
- WAITLIST_ENTRY (user_id FK, run_id FK, status, priority)
- AUDIT_LOG (actor_user_id FK, action, created_at)
Relationship labels: USER 1:N BOOKING, USER 1:N SEAT_HOLD,
BOOKING 1:N BOOKING_PASSENGER, USER 1:N WAITLIST_ENTRY, USER 1:N AUDIT_LOG,
TRAIN_RUN 1:N BOOKING, TRAIN_RUN 1:N WAITLIST_ENTRY.

CENTRE OF THE DIAGRAM — THE KEY ENTITY:
Place SEAT_SEGMENT_CLAIM between BAND 2 and BAND 3, slightly larger than the
others, filled lime green (#DAF28F) with a dark green border (#263416) and dark
green bold text, so it is clearly the most important box.
Attributes: run_seat_id FK, segment_index, hold_id FK, booking_id FK.
Inside it, second line in small caps: "one row per seat per segment".
Draw crow's-foot connectors: RUN_SEAT 1:N SEAT_SEGMENT_CLAIM,
BOOKING 1:N SEAT_SEGMENT_CLAIM, SEAT_HOLD 1:N SEAT_SEGMENT_CLAIM.
Add a thin dashed lime-green callout line to a small caption on the right:
"UNIQUE(run_seat_id, segment_index) prevents double booking".

STYLE RULES
- All text must be crisp, horizontal, correctly spelled, and inside its box.
- Same font everywhere: a clean geometric sans-serif (Inter / Poppins / Geist).
- Connector lines 2px, arrowheads as small crow's feet, relationship labels
  placed in the middle of the line on a tiny ivory chip so lines never touch text.
- Generous white space, aligned boxes, consistent box size, even gutters.
- Keep the whole diagram inside safe margins (80px) so nothing is cut off.

NEGATIVE (do not include): photographs, realistic trains, 3D bevels, drop
shadows, neon glow, gradients, decorative patterns, icons of people, emoji,
watermark, logo, fake or misspelled words, lorem ipsum, overlapping boxes,
crossing lines, text outside boxes, more than 12 entity boxes.
````

---

## 3. SHORT PROMPT (for Midjourney / tools that ignore long text)

Midjourney cannot spell reliably. Use this for **composition only**, then type the labels yourself (Plan B).

````text
flat vector entity relationship diagram poster for a railway reservation
database, ivory #F7F8F3 background, matte black thin connector lines with
crow's-foot ends, white rounded rectangles with light grey borders arranged in
three clean horizontal bands, one lime green #DAF28F highlighted box in the centre
with a dark green outline, small black uppercase labels, technical blueprint
aesthetic, editorial layout, generous white space, perfectly aligned grid,
16:9 presentation slide, minimal, clean, no shadows, no 3D --ar 16:9 --style raw --v 7
````

**Negative prompt for Midjourney:**

```text
photo, 3d, gradient, glow, neon, texture, train illustration, people icons,
emoji, watermark, logo, blurry text, gibberish letters, crowded, overlapping
boxes, crossing lines, dark background
```

---

## 4. Variant prompts

### Variant A — Dark theme (matches the RAILVYN app shell)

Replace the background line with:

```text
Deep matte black background (#080A09), entity boxes in dark grey (#191C1A) with
soft grey borders (#343B36), white entity names (#F6F7F2), lime green (#DAF28F)
for the highlighted SEAT_SEGMENT_CLAIM box only, connectors in light grey
(#CCD2CC), subtitle in muted grey-green.
```

### Variant B — Minimal 8-entity version (if the slide feels crowded)

```text
Draw only these 8 boxes: USER, ROUTE, STATION, TRAIN_RUN, RUN_SEAT, SEAT_HOLD,
BOOKING, SEAT_SEGMENT_CLAIM. Keep only the relationships USER→BOOKING,
USER→SEAT_HOLD, ROUTE→STATION (via ROUTE_STOP label), TRAIN_RUN→RUN_SEAT,
RUN_SEAT→SEAT_SEGMENT_CLAIM, BOOKING→SEAT_SEGMENT_CLAIM,
SEAT_HOLD→SEAT_SEGMENT_CLAIM. No attributes, only names and 1:N labels.
Leave extra white space — the presenter will explain orally.
```

### Variant C — One-line "hero" diagram (for the slide 6 concept page)

```text
A single horizontal route line with four dots labelled A, B, C, D and three
segments labelled 0, 1, 2. Seat 12 is shown claimed on segments 0 and 1 (lime
fill) and free on segment 2 (white dashed). A second passenger card on the right
shows "C → D · uses segment 2 · seat reuse allowed". Flat vector, ivory
background, minimal, 16:9, thin black lines, no 3D, no shadows.
```

---

## 5. Entities, keys and cardinalities (the truth to check against)

| Parent | Child | Cardinality | Meaning |
|---|---|---|---|
| USER | BOOKING | 1 : N | a user makes many bookings |
| USER | SEAT_HOLD | 1 : N | a user can hold seats many times |
| USER | WAITLIST_ENTRY | 1 : N | a user can join many queues |
| USER | ROLE_ASSIGNMENT | 1 : N | passenger / operator / admin roles |
| USER | AUDIT_LOG | 1 : N | every action is recorded |
| ROUTE | ROUTE_STOP | 1 : N | ordered stops, `stop_index` 0..N |
| STATION | ROUTE_STOP | 1 : N | a station appears in many routes |
| ROUTE | TRAIN | 1 : N | trains run on a route |
| TRAIN | TRAIN_RUN | 1 : N | one dated departure per service date |
| TRAIN_RUN | RUN_COACH | 1 : N | physical coaches on that date |
| COACH_TEMPLATE | RUN_COACH | 1 : N | template copied into a run |
| COACH_TEMPLATE | TEMPLATE_SEAT | 1 : N | seat layout per coach class |
| RUN_COACH | RUN_SEAT | 1 : N | real seats for that run |
| RUN_SEAT | SEAT_SEGMENT_CLAIM | 1 : N | **one claim per travelled segment** |
| BOOKING | SEAT_SEGMENT_CLAIM | 1 : N | confirmed booking owns claims |
| SEAT_HOLD | SEAT_SEGMENT_CLAIM | 1 : N | temporary hold owns claims |
| TRAIN_RUN | BOOKING | 1 : N | bookings belong to a run |
| BOOKING | BOOKING_PASSENGER | 1 : N | traveller details |
| BOOKING | BOOKING_SEAT | 1 : N | seat ↔ passenger mapping |
| TRAIN_RUN | WAITLIST_ENTRY | 1 : N | queue per run and leg |
| TRAIN_RUN | DISRUPTION | 1 : N | incident log |

**Core rule written on the diagram:** `UNIQUE(run_seat_id, segment_index)` — one seat can never be claimed twice on the same segment, and both holds and bookings must obey it.

---

## 6. Plan B — reliable method (recommended for the final slide)

AI images garble small text. Do this for a guaranteed-clean result:

1. Ask the image tool for the **layout only**, using this line at the end of the prompt:
   `Leave all entity boxes empty — no text inside the boxes, no labels anywhere.`
2. Insert the image into PowerPoint and send it to the back.
3. Draw your own rounded rectangles on top (same size/positions), set fill to white, and type the entity names with **Inter / Poppins, 20px, bold uppercase**.
4. Add connectors using **Insert → Shapes → Connector** with an arrow, and type `1 : N` beside each line.
5. Fill only `SEAT_SEGMENT_CLAIM` with `#DAF28F` and write the unique-key caption.

Faster still: open <https://mermaid.live>, paste the Mermaid ER code from `RAILVYN-PPT-PROMPT.md` (Slide 5), export **PNG at 3× scale**, and drop that into the slide. It is accurate, free, and fully editable later.

---

## 7. Pre-flight checklist before using the image

- [ ] Aspect ratio is 16:9 and nothing is cropped at the edges
- [ ] Every entity name is spelled correctly (`BOOKING`, `SEAT_HOLD`, `TRAIN_RUN`, `SEAT_SEGMENT_CLAIM`, …)
- [ ] `SEAT_SEGMENT_CLAIM` is the only highlighted box and is visually central
- [ ] Cardinalities are `1 : N` on every line, arrows not reversed
- [ ] No crossing lines; the diagram is readable at 50% zoom on a projector
- [ ] Text is at least 18px in the exported image
- [ ] Caption says "27 tables · 12 core entities shown"
- [ ] Footer or corner note: `RAILVYN · academic demo · not IRCTC`
- [ ] Total boxes ≤ 12 so the slide still breathes

---

## 8. What to say while the image is on screen (15–20 seconds)

> "This is the database design. On top is the railway network: stations, routes with ordered stops, trains and their dated runs. In the middle is the physical inventory: coach templates, coaches on that run, and real seats. At the bottom are users and bookings. The lime box in the centre is the heart of RAILVYN — for every seat and every small segment of the journey we store one claim row, protected by a unique key, so the same seat can be reused after a passenger alights but can never be sold twice on the same segment."
