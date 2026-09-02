# API contract

Base URL is `/api`. In development Next proxies that to the Nest process on :4001
(see `apps/web/next.config.mjs`); `NEXT_PUBLIC_API_URL` overrides it.
All responses are JSON. Dates are `YYYY-MM-DD` strings, never timestamps — the registry
deals in calendar days, and a timezone on a filing deadline is a bug waiting to happen.

Shared vocabulary:

```ts
type RegistrationType = 'Entity' | 'FQ';
type ComplianceStatus =
  | 'GOOD_STANDING' | 'FILING_DUE' | 'OVERDUE'
  | 'SUSPENDED' | 'NOT_APPLICABLE' | 'TBD';
```

---

## `POST /api/uploads`

`multipart/form-data` with exactly three file fields: `entities`, `ownership`,
`filings`. Each may be `.csv` or `.xlsx`. All three go in one request — the cross-file
and graph rules cannot be checked otherwise.

**200 — accepted and stored**

```json
{
  "message": "Registry updated.",
  "changed": true,
  "counts": { "entities": 32, "ownership": 26, "filings": 36 }
}
```

`changed: false` means the files match what is already stored. Say so in the UI rather
than claiming an update: "These files match what is already stored, so nothing changed."

**400 — a file was not attached**

```json
{ "message": "Attach all three files before uploading. Still needed: filings.", "missing": ["filings"] }
```

**422 — the files were read but cannot be accepted. Nothing was written.**

```json
{
  "message": "Nothing was saved. 21 problems need fixing in the files.",
  "summary": { "total": 21, "byClass": { "structural": 0, "row": 14, "reference": 4, "graph": 3 } },
  "errors": [
    {
      "file": "entities.csv",
      "line": 6,
      "column": "Entity Status",
      "class": "row",
      "message": "\"Actve\" is not a valid Entity Status. Did you mean \"Active\"? Use one of: In Formation, Active, ..."
    }
  ]
}
```

`line` is the spreadsheet line, so the header is 1 and the first data row is 2. It is
`null` only when the fault is the whole file. `column` is `null` when the fault is the
row or the file rather than one cell.

The four classes are distinct and the UI should group by them, in this order, with these
headings:

| class | heading | what it means |
|---|---|---|
| `structural` | The file itself | Wrong or missing columns; the rows could not be read |
| `row` | Individual rows | One cell breaks a rule |
| `reference` | Names that do not match | A row points at something in another file |
| `graph` | The ownership graph | Cycles, self-ownership, over-allocated children |

Every message already names the fix. Render it verbatim; do not rewrite or truncate it.

---

## `GET /api/registry/status`

Whether there is anything to show. Drives the empty state.

```json
{ "hasData": true, "uploadedAt": "2026-09-02", "counts": { "entities": 32, "ownership": 26, "filings": 36 } }
```

---

## `GET /api/registry/entities`

The List page. Returns the hierarchy already assembled — the client does no tree
building.

Query parameters, all optional, all combinable:

| param | effect |
|---|---|
| `search` | Case-insensitive substring of Entity Name |
| `entityStatus` | Exact Entity Status |
| `complianceStatus` | Exact ComplianceStatus |
| `jurisdiction` | Exact jurisdiction string |

A filter matches against every node in the tree, not only roots. A top-level entity is
returned when it or any of its descendants matches, and the branch to each match is kept
so the row can be found; `matched: false` marks the ancestors that are only present as
context.

```ts
interface EntityNode {
  name: string;
  registrationType: RegistrationType;
  jurisdiction: string;
  entityType: string;
  entityStatus: string;
  statusDate: string | null;
  formationDate: string | null;
  businessId: string | null;
  globalRegion: string | null;

  complianceStatus: ComplianceStatus;
  nextFilingDueDate: string | null;
  /** Calendar days from today; negative once passed. Null when there is no due date. */
  daysToDue: number | null;

  /** Present only on subsidiary rows: the share this parent holds. Null on roots and FQs. */
  ownershipPercent: number | null;
  /** Direct children only. */
  subsidiaryCount: number;
  fqCount: number;
  /** True when this node itself satisfies the filters. */
  matched: boolean;

  foreignQualifications: EntityNode[];
  subsidiaries: EntityNode[];
}
```

```json
{
  "topLevel": [ /* EntityNode[] */ ],
  "totals": { "topLevel": 5, "entities": 26, "foreignQualifications": 6, "shown": 12 },
  "filterOptions": {
    "jurisdictions": ["United States/Delaware", "..."],
    "entityStatuses": ["Active", "..."],
    "complianceStatuses": ["GOOD_STANDING", "..."]
  }
}
```

Ownership is a graph, not a tree: **a company owned by two parents appears under both**,
with the relevant `ownershipPercent` in each place. That is correct and intentional —
do not deduplicate it in the UI.

`filterOptions` lists only values actually present in the data, so a filter can never be
set to something that returns nothing.

---

## `GET /api/analytics`

All four charts in one response, so the page's filters apply consistently.

Query parameters: `jurisdiction`, `entityStatus` (page-level filters, both optional),
and `parent` (which parent's ownership split chart d is showing).

```json
{
  "complianceBreakdown": [ { "status": "GOOD_STANDING", "count": 13 } ],
  "entityStatusByRegion": [
    { "region": "North America", "counts": { "Active": 12, "Dissolved": 1 } }
  ],
  "compositionByTopLevel": [
    { "name": "Harrier Group Inc", "subsidiaries": 4, "foreignQualifications": 2 }
  ],
  "ownershipSplit": {
    "parent": "Harrier Group Inc",
    "children": [
      { "name": "Harrier Systems LLC", "percent": 55, "heldByOthers": 30, "unallocated": 15 }
    ]
  },
  "parentOptions": ["Harrier Group Inc", "..."],
  "filterOptions": { "jurisdictions": ["..."], "entityStatuses": ["..."] }
}
```

- `entityStatusByRegion` uses the literal `"Unassigned"` for rows with no Global Region.
  It is a real state in the data, not a gap to hide.
- `ownershipSplit` is `null` when no `parent` is given, or when the chosen parent owns
  nothing. Draw it as **one bar per child, not one pie across them**: percentages are
  capped per child and share no denominator, so a parent holding 60% of one company and
  100% of another has not allocated 160% of anything.
- Each bar runs the full 0-100% of that child and is divided three ways, which always
  sum to exactly 100:
  - `percent` - the selected parent's own stake.
  - `heldByOthers` - stakes other parents in this registry hold in the same child.
  - `unallocated` - the remainder, owned outside the registry.
  `unallocated` is never negative; validation rejects over-allocation before anything is
  stored. It is frequently non-zero and must be shown as its own segment: hiding it would
  imply the group owns these companies outright.
- The page filters deliberately do not narrow this chart. It answers "how is this parent's
  stake divided", and dropping some of its children would show a remainder that is an
  artefact of the filter rather than a fact about the company.
- Every array can legitimately be empty. Each chart needs its own empty state.
