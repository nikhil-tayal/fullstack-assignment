# Entity Registry

Three spreadsheets go in — entities, ownership, filings — and what comes out is a
corporate group you can actually read: a hierarchy that keeps subsidiaries and
foreign qualifications apart, a derived compliance status for every registration,
and four charts that answer questions about the group rather than describing the
files.

Live: **[assignment.nikhiltayal.info](https://assignment.nikhiltayal.info)** ·
Source: [github.com/nikhil-tayal/fullstack-assignment](https://github.com/nikhil-tayal/fullstack-assignment)

## Run it

```bash
pnpm install     # also generates the Prisma client
pnpm db:setup    # writes apps/api/.env and creates the SQLite file
pnpm dev         # web on :3000, API on :4001
```

Open http://localhost:3000. There is nothing else to install and nothing to
configure: the database is a file, and `next dev` proxies `/api` to the Nest
process, so no environment file is needed to make the two halves talk.

The registry starts empty and says so. Upload the three files in
`sample-data/provided/` to fill it. `sample-data/defective/` and
`sample-data/defective-structural/` exist to be rejected — see
[`sample-data/EXPECTED-ERRORS.md`](./sample-data/EXPECTED-ERRORS.md) for the
problem each row is there to raise.

```bash
pnpm test        # 57 tests, nothing to start first
pnpm typecheck
pnpm build
```

## What the code decides

**One request, every error.** The three files arrive together in a single
`POST /api/uploads`, because the interesting rules are the ones that span files: an
ownership row naming an entity that does not exist, a cycle, a child owned 130%.
Validation never stops at the first fault. It runs every check it can still run and
returns them all at once, grouped into four classes — the file itself, individual
rows, names that do not match, and the ownership graph — each carrying the file, the
spreadsheet line number, the column, and a message written for the person with the
spreadsheet open beside them:

```
entities.csv line 6, Entity Status: "Actve" is not a valid Entity Status.
Did you mean "Active"? Use one of: In Formation, Active, ...
```

Cascades are suppressed rather than repeated: a row already reported as malformed
does not then generate four reference errors about the names it failed to parse.

**Nothing is written unless everything passes.** A rejected upload leaves the
registry exactly as it was. An accepted one replaces it wholesale inside one
transaction, so re-uploading the same files cannot duplicate anything — and because
the upload is fingerprinted from the three files' contents, an identical re-upload
is reported as `changed: false` rather than as work done.

**An FQ is not a subsidiary.** A foreign qualification is the same legal entity
registered in another jurisdiction; a subsidiary is a different company that
something owns a percentage of. They are modelled apart everywhere: FQs hang off
their domestic entity, never appear in the ownership graph, never carry a
percentage, and are counted separately. In the tree their rail is dashed where a
subsidiary's is solid.

**Ownership is a graph, not a tree.** A company owned by two parents is genuinely in
two places, so it is shown under both, each time with that parent's own stake.
Expansion is therefore keyed by the path taken to a node rather than by its name —
opening a company under one parent must not open it somewhere else on the page,
because those are two different facts about it. Cycles, self-ownership, and per-child
totals above 100% are rejected at upload, so the tree is known to terminate.

**Compliance is derived, never stored.** The next due date is the earliest
outstanding filing for that registration — per registration, so an FQ can fall out of
good standing while its parent is current. The ladder is evaluated in the spec's
order, entity status first:

| | |
|---|---|
| Dissolved, Merged/Acquired, Revoked/Terminated, Divested/Sold, Dormant | `NOT_APPLICABLE` — checked before any date |
| No outstanding filing | `TBD` |
| 90+ days out | `GOOD_STANDING` |
| 0–89 days | `FILING_DUE` |
| 1–364 days past | `OVERDUE` |
| 365+ days past | `SUSPENDED` |

Boundaries are inclusive-low, and the arithmetic runs on calendar date parts alone —
a wall-clock subtraction would let an entity cross the 90-day line at 2am, or at a
daylight-saving transition, instead of at midnight.

## The pages

**Upload** renders the 422 body as the document it is: four sections in a fixed
order, grouped by file, ruled Line / Column / What to fix.

**List** is the hierarchy, expandable in place, with search and filters. Filtering
keeps the ancestors of a match as context — a subsidiary shown without its parents
has lost the one thing this page is for. There is no detail page; the row carries
what a row needs to carry.

**Analytics** has four charts and page-level filters, each with a real empty state
rather than an axis drawn around nothing. The ownership chart is one bar per child,
never one pie across them: percentages are capped per child and share no
denominator, so a parent holding 60% of one company and 100% of another has not
allocated 160% of anything. Each bar splits into this parent's stake, stakes other
parents in the registry hold, and the remainder owned outside it.

A screen-by-screen walkthrough of how the whole thing behaves is in
[`docs/HOW-IT-WORKS.md`](./docs/HOW-IT-WORKS.md). The visual language and the standing
seal are set out in [`docs/DESIGN.md`](./docs/DESIGN.md); the wire contract is in
[`docs/API.md`](./docs/API.md).

## Stack

| Part | Tech | Dev port |
|------|------|----------|
| `apps/web` | Next.js 15 (App Router), React 19, Tailwind, TypeScript | 3000 |
| `apps/api` | NestJS 11, Prisma, SQLite, TypeScript | 4001 |

SQLite is the deliberate choice, not the lazy one: the whole point of a take-home is
that someone else can clone it and have it running in three commands, and a registry
is a corporate group — tens of rows, not millions. Charts read it in three queries
and hold it in memory, which is the honest shape of the data. `apps/api/src/registry`
is where that assumption lives if it ever stops being true.

There is no ESLint config here. Formatting is uniform because it was written that
way, and `pnpm typecheck` under `strict` catches what would actually break; adding a
linter to a project this size is a config file pretending to be a quality bar.

## Layout

```
apps/
  api/src/
    ingestion/         parsing → validation → persistence, in that order
      parsing/         csv-parse and exceljs, both reporting true spreadsheet lines
      validation/      the four error classes
      persistence/     transactional snapshot replace, fingerprinted
    domain/            the vocabulary and the compliance ladder
    registry/          hierarchy and analytics, derived on read
  web/src/
    app/               upload (/), /entities, /analytics
    components/        standing-seal.tsx is the signature element
    lib/               API client, typed contract, hooks
docs/                  API contract, design direction
sample-data/           demo, provided, and two fixtures built to be rejected
```

## Deploy

See [DEPLOY.md](./DEPLOY.md). Short version: `./deploy.sh`.
