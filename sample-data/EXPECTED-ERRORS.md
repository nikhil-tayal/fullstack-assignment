# Expected validation output

`provided/` is the dataset from the assignment doc's "Sample data set" tab, with the
header row the spec requires ("Header is line 1") added. It is clean — it produces
zero errors. It is the happy-path fixture.

`defective/` is authored to exercise every failure class the evaluation criteria name
as distinct: structural / row / cross-file reference / graph. Line numbers are
spreadsheet lines, so the header is line 1 and the first data row is line 2.

## entities.csv

| Line | Column | Class | Expected error |
|------|--------|-------|----------------|
| 4 | Status Date | row | Status Date is required when Entity Status is Dissolved |
| 5 | Domestic Entity | row | Domestic Entity is required when Registration Type is FQ |
| 6 | Entity Status | row | "Actve" is not a valid Entity Status |
| 7 | Entity Name | row | "Harrier Systems LLC" is already used on line 3 |
| 8 | Formation Date | row | Formation Date 2027-06-01 is in the future |
| 9 | Domestic Entity | reference | "Harrier Group Inc (Oregon)" is an FQ; Domestic Entity must name an Entity row |
| 10 | Entity/Business ID | row | "DE-6001234" is already used on line 2 |
| 11 | Global Region | row | "Atlantic" is not a valid Global Region |

## ownership.csv

| Line | Column | Class | Expected error |
|------|--------|-------|----------------|
| 4 | Ownership % | graph | Harrier Freight LLC is owned 115% in total (60% on line 3, 55% here) |
| 5 | Child Entity | graph | Harrier Group Inc cannot own itself |
| 6 | Parent Entity | graph | Cycle: Harrier Group Inc -> Harrier Freight LLC -> Harrier Group Inc |
| 7 | Child Entity | reference | "Harrier Group Inc (Oregon)" is an FQ and cannot be a Child Entity |
| 8 | Child Entity | reference | "Harrier Atlantis Ltd" does not exist in entities.csv |
| 9 | Parent Entity, Child Entity | row | Duplicate pair; already declared on line 2 |
| 10 | Ownership % | row | Ownership % must be greater than 0 |
| 11 | Ownership % | row | Ownership % allows at most 2 decimals |

## filings.csv

| Line | Column | Class | Expected error |
|------|--------|-------|----------------|
| 4 | Filed Date | row | Filed Date 2027-01-05 is in the future |
| 5 | Filed Date | row | Filed Date is required when Status is Filed |
| 6 | Filing Type | row | "Quarterly Report" is not a valid Filing Type |
| 7 | Entity Name | reference | "Harrier Atlantis Ltd" does not exist in entities.csv |
| 9 | Due Date | row | Due Date is required |

Line 8 is deliberately valid: it uses the MM/DD/YYYY date form the spec permits.
Line 10 is deliberately valid and lands on SUSPENDED, exercising the bottom of the ladder.

## Still to add

Structural failures (missing or misnamed columns) break a whole file rather than a row,
so they need their own fixture directory — a file whose header is wrong cannot also
demonstrate row errors. Added separately as `defective-structural/`.

## Class counts

The `defective/` set produces 21 errors: **14 row, 4 reference, 3 graph, 0 structural**.
`defective-structural/` covers the fourth class on its own, because a broken header
invalidates its whole file and so cannot coexist with row errors in the same fixture.

"Child Entity is an FQ" is classed as **reference**, not graph, because it is settled by
looking the name up in entities.csv - the ownership graph is never consulted. The graph
class is reserved for the three faults that only exist in the edges themselves:
self-ownership, cycles, and per-child over-allocation.
