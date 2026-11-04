# RAILVYN — Design System

## Context and direction
**Brand:** RAILVYN — *Every journey. Precisely placed.*

**Intent:** A premium, precise railway operations and reservation experience inspired by the supplied Hjem reference: matte-black application shell, soft ivory work surfaces, generous rounded geometry, large editorial typography and quiet motion. This is an original RAILVYN identity, **not a copy of Hjem or its brand assets**. Optimize for high-density operational use without looking like a generic admin dashboard.

## Design tokens
Create CSS variables and Tailwind semantic aliases. Use **tokens in components**, never one-off hex colors. The values below are foundations; check actual contrast in rendered components.

| Token | Value | Usage |
|---|---|---|
| `--surface-canvas` | `#080A09` | App shell and dark pages |
| `--surface-dark-raised` | `#191C1A` | Dark nav, inset panels |
| `--surface-panel` | `#F7F8F3` | Main light cards and tables |
| `--surface-subtle` | `#E9ECE5` | Alternating backgrounds |
| `--text-on-dark` | `#F6F7F2` | Main text on dark |
| `--text-on-light` | `#161A17` | Main text on light |
| `--text-muted-dark` | `#CCD2CC` | Secondary text on dark |
| `--text-muted-light` | `#48534B` | Secondary text on light |
| `--border-dark` | `#343B36` | Dark separators |
| `--border-light` | `#CFD6CD` | Light separators |
| `--accent-primary` | `#DAF28F` | High-priority action on dark; use dark text |
| `--accent-ink` | `#263416` | Accent foreground and emphasis |
| `--state-warning-bg` | `#FFE4AE` | Held/waiting badges on light |
| `--state-danger-bg` | `#F9CCBF` | Problems/cancelled, with dark text |
| `--state-success-bg` | `#D8EDC8` | Available/confirmed with dark text |

**Type:** Prefer licensed `Matter` if present; otherwise use `Geist`/system sans, without fetching proprietary fonts. Base body 16px/1.5 for dense controls, larger 18–20px for display copy. Scale: 12, 14, 16, 18, 20, 24, 28, 36, 48px. Use tabular numerals for occupancy counts, fares, coach labels, times, and booking references.

**Space:** 8, 12, 16, 20, 24, 28, 32, 40px. **Radii:** 10px for inputs/chips, 16px for small panels, 24px for primary cards, 30px for featured modules. **Motion:** 150ms instant, 200ms fast, 300ms standard; honor `prefers-reduced-motion`. No giant shadows or glowing gradients.

## Layout and signature components
- **Dark navigation shell:** compact icon/label sidebar on desktop, prominent wordmark, top search/command strip, clear active state. Mobile uses a drawer or bottom navigation; critical actions never disappear.
- **Light floating work panels:** deliberate 24–30px corners, restrained border/shadow, generous whitespace for headers with tightly structured data sections.
- **Train timeline:** horizontal ordered station stops with origin/destination highlighting, travel duration, intermediate legs, and accessible text representation.
- **Coach explorer (signature):** full-width schematic train diagram with coach tabs, seat grid/berth map, walking aisle, berth categories and a live availability legend. Seat selection has `aria-pressed`, accessible name (`Coach B2, seat 18, lower berth, available`), focus ring, keyboard navigation, and a mobile list-view fallback.
- **Seat status:** available, selected, held, booked, accessible, unavailable, waitlisted. Use text/icon/pattern alongside color; keep legend visible and prevent selection of booked seats.
- **Operator data density:** filters, sortable tables, compact metrics, berth-utilization heatmaps, coach occupancy matrices and a sticky context panel. Do not let oversized rounded cards reduce serious operational readability.
- **Forms and dialogs:** clear field labels, validation near the field, server errors, cancellation confirmations, and an obvious hold-expiry countdown with accessible announcements.

## Component interaction contract
All interactive components **must** cover default, hover, focus-visible, active/selected, disabled, loading, empty and error states as applicable. Controls **must** work with keyboard, pointer and touch. Forms **must** block accidental duplicate submission, preserve entered data on recoverable failures, and announce resulting status. Tables **should** keep headings visible and use horizontal overflow or stacked cards on small screens rather than cropping data.

| Component | Behavioral requirement |
|---|---|
| Buttons | One unmistakable primary action per region; spinner + disabled during submission; actionable error feedback |
| Search / filters | Debounced input as needed, explicit loading/empty/error results, reset and visible applied filters |
| Seat cell | Native button; descriptive accessible name, selected state and disabled reasoning; touch target ideally >=44px |
| Hold timer | Real server expiration time; warn near expiry; never imply a stale hold is valid |
| Data table | Keyboard-operable sorting, pagination, concise empty state, accessible row actions |
| Navigation | Current page indicator, visible focus, no hover-only submenu |
| Dialog | Accessible title, focus trap, Escape close unless destructive flow needs confirmation, focus restored on close |

## Writing and information hierarchy
Voice is concise, human and operational. Prefer **“Seat 18 is no longer available. Choose another.”** over **“Unknown error occurred.”** Prefer **“Hold expires in 04:59”** over **“Processing ticket.”** Label payments **“Demo checkout”**, references **“RAILVYN booking reference”**, and usage **“Demonstration data, not official railway inventory.”** Do not imply actual live IRCTC data.

## Responsive and accessibility acceptance
- **Must** target WCAG 2.2 AA: text contrast at least 4.5:1 (3:1 for large text), visible focus, semantic labels, non-color status cues, errors announced, and no keyboard traps.
- **Must** remain usable at 320px and 200% zoom without hiding primary actions or information. Train maps can horizontally scroll only with a visible alternative/list mode.
- **Must** have functional keyboard seat selection and correctly labelled seat buttons; no clickable decorative `div` in place of buttons.
- **Must** provide actionable, readable empty/loading/error states and reduced-motion equivalents.
- **Should** use a 44x44px touch target where layout allows; WCAG 2.2 AA minimum target requirements still apply.

## Anti-patterns
No copied Hjem branding, stock-photo-heavy landing page, blue/purple SaaS gradients, random glassmorphism, unreadable low-contrast gray text, fake analytics, seats implemented as static imagery only, decorative controls, misleading “real-time” labels, or modal overload.

## UI QA checklist
- [ ] Visual tokens consistent across all passenger, operator and admin routes.
- [ ] Coach seats, stop timeline and occupancy panels respond to actual selected run/leg.
- [ ] All interactive controls work via keyboard/touch and show states.
- [ ] Tables and coach explorer work on mobile and with long names.
- [ ] Every screen includes loading, empty and failure handling.
- [ ] Contrast, focus, zoom, accessible names and reduced-motion tested.
- [ ] No official railway identity or payment claims appear anywhere.
