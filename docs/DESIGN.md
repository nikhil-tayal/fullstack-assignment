# Design direction — Entity Registry

The single source of truth for how this product looks. Every page follows it. If
something is not specified here, it is derived from what is, never invented alongside.

## The subject

A corporate entity registry: legal entities, the jurisdictions they are registered in,
who owns whom, and what has to be filed before a deadline passes. The people who use it
are paralegals and corporate secretaries who currently live in these three spreadsheets.
Their actual anxiety is not data entry — it is a lapse. An annual report missed, a
registration quietly falling out of good standing.

So the page has one job: **make it obvious what is about to lapse, and where in the
corporate tree it sits.**

## Where the visual language comes from

Not from dashboards. From the instruments this work produces: certificates of good
standing, filing receipts, stock certificates, docket stamps. That world has a real
graphic tradition — engraved type, security tints, ruled ledgers, seals pressed into a
page — and it belongs to this subject rather than being borrowed from a fintech app.

Two things it must **not** drift into, both of which are the current default look for
generated interfaces:

- warm cream page + high-contrast serif + terracotta accent
- dense broadsheet columns with hairline rules and zero border radius

We are adjacent to the second, so hold the line: our surfaces are tinted paper rather
than white, our rules are used sparingly to group rather than everywhere to decorate,
and radius is small but present (4px), never zero.

## Colour

Defined once as CSS custom properties on `:root`. Nothing hardcodes a hex.

| Token | Value | Use |
|---|---|---|
| `--ink` | `#141B2E` | Body text, the near-navy of registry ink |
| `--ink-soft` | `#4A5468` | Secondary text, labels |
| `--ink-faint` | `#8992A3` | Metadata, disabled |
| `--paper` | `#F0F2ED` | Page ground — a pale security tint, not cream |
| `--surface` | `#FAFBF8` | Cards, rows, panels |
| `--rule` | `#D3D8CE` | Ruled lines, borders |
| `--seal` | `#1E5C46` | Certificate green: good standing, primary action |
| `--seal-deep` | `#123A2C` | Pressed / hover state of the above |
| `--stamp` | `#93231F` | Stamp red: overdue, errors, destructive |
| `--amber` | `#A66A12` | Filing due |
| `--slate` | `#5A6B80` | TBD |
| `--void` | `#2B2F38` | Suspended — the bottom of the ladder, near-black |

Compliance is the one place colour carries meaning, so it is spent there and nowhere
else. A chart uses these same six; it does not get its own palette.

| Status | Colour |
|---|---|
| `GOOD_STANDING` | `--seal` |
| `FILING_DUE` | `--amber` |
| `OVERDUE` | `--stamp` |
| `SUSPENDED` | `--void` |
| `NOT_APPLICABLE` | `--ink-faint` |
| `TBD` | `--slate` |

Dark mode is out of scope. This is a document, and documents are light.

## Type

Three faces, three jobs, loaded from Google Fonts with real fallbacks.

- **Bodoni Moda** — display only. Page titles and the seal's lettering. It carries
  banknote and certificate DNA, which is exactly the register we want, and it is
  unusable at small sizes, which is the point: it appears rarely.
  Fallback: `'Bodoni Moda', 'Didot', Georgia, serif`.
- **Public Sans** — everything else. It is the typeface of the US Web Design System,
  which is to say it is literally the face of government filings. Body, UI, tables.
  Fallback: `'Public Sans', -apple-system, 'Segoe UI', sans-serif`.
- **IBM Plex Mono** — the register's own data: entity/business IDs, dates, percentages,
  spreadsheet line numbers in error messages. Anything the user would compare
  character by character gets set in it, aligned in a column.
  Fallback: `'IBM Plex Mono', ui-monospace, 'SF Mono', monospace`.

Scale (`rem`): 3 / 2 / 1.5 / 1.125 / 1 / 0.875 / 0.75. Body 1rem/1.55. Labels are
0.75rem, uppercase, `letter-spacing: 0.08em`, `--ink-soft`. Nothing between 1.125 and
1.5 — the jump is deliberate and keeps hierarchy from going mushy.

## The signature: the standing seal

One memorable element, used in exactly one place, quiet everywhere else.

Every entity's compliance status renders as a small **seal**: a circle in the compliance
colour, with an engraved double ring, and inside it the number of days to the next
filing set in Bodoni. The outer ring is a progress arc — it depletes as the deadline
approaches, so a row that is fine reads as a full ring and a row in trouble reads as a
sliver, before the user has read a single word.

Two states break the circle deliberately, the way a real document is marked:

- `OVERDUE` and `SUSPENDED` get a rotated rectangular **stamp** over the seal
  (`transform: rotate(-8deg)`, 2px `--stamp` border, letterspaced uppercase) reading
  OVERDUE / SUSPENDED. It should look pressed on, not designed in.
- `NOT_APPLICABLE` gets a flat grey disc with a single horizontal rule through it. No
  arc, because there is no deadline to run down.

`TBD` is an empty ring — outline only, nothing inside. There is no date to show, and
saying so with absence is better than printing "TBD" in a circle.

Sizes: 44px in list rows, 96px in the analytics compliance chart's centre. Below 44px
the ring is illegible, so anything smaller uses a plain colour dot instead.

The seal is the risk. Everything around it is disciplined: flat surfaces, one rule
weight, no shadows deeper than `0 1px 2px rgb(20 27 46 / 0.06)`, no gradients.

## Structure

- **Ruled, not carded.** The list is a ledger: rows separated by a single `--rule`
  line, grouped by top-level entity. Cards are for the upload page and chart panels
  only.
- **Indentation carries the hierarchy**, 24px per level, with a vertical `--rule` line
  down the indent so a deep child still reads as belonging to its parent.
- **FQs and subsidiaries must never be confusable.** A subsidiary row shows its
  ownership percentage in mono and a solid connector. An FQ row shows no percentage at
  all, a dashed connector, and a small uppercase `FQ · <jurisdiction>` tag in
  `--ink-soft`. This distinction is graded; make it impossible to miss.
- Numbering (01 / 02 / …) is banned. Nothing here is a sequence.

## Motion

One orchestrated moment, not scattered effects: on the list page, seals draw their arc
once on mount, staggered 30ms per row, 400ms ease-out. Row expansion is a 180ms height
and opacity transition. Everything else is instant.

All of it inside `@media (prefers-reduced-motion: reduce)` guards that render the final
state directly.

## Empty and error states

These are graded, and they are the interface's voice. Every one says what happened and
what to do, in the same words the controls use.

- No data uploaded: "No registry yet. Upload entities, ownership and filings to get
  started." with the upload action.
- Filters exclude everything: "No entities match these filters." plus a control to clear
  them. Never the same copy as the no-data state — they are different situations.
- A chart with no data: the panel keeps its frame and title, and says what would fill
  it.
- Validation errors: the file, the line, the column, and the fix. Set the line number in
  mono. Never apologise, never say "oops", never blame the user.

## Quality floor

Responsive to 360px (the list collapses its lower-priority columns before it scrolls),
visible keyboard focus using `--seal` at 2px offset, reduced motion respected, every
interactive control reachable by tab, charts carrying an accessible text summary.
