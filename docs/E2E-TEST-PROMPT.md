# End-to-end test prompt

Paste everything below the line into a fresh Claude Code session opened in this
repository. It is written to be run by someone who has not seen the code: it asks
for evidence, not for opinions, and it asks the tester to report rather than to fix.

Expected values in the prompt are the ones this build currently produces. A
mismatch is a finding, not a licence to edit the expectation.

---

You are testing a take-home submission end to end. Do not fix anything you find —
your job is to verify and report. If something is broken, capture the exact command,
the exact output, and move on to the next check.

The project is an **Entity Registry**: three spreadsheets (`entities`, `ownership`,
`filings`) are uploaded in one request, validated as a set, and then presented as a
corporate hierarchy plus analytics. Read `README.md` and `docs/API.md` first — they
state the contract you are checking against.

Work through the sections in order. Keep a running table of PASS / FAIL / and record
the evidence for each numbered check. At the end, produce a written report.

## 0. Set-up, from a clean state

Verify the project runs the way the README says it does, from nothing.

1. `git clone` this repo into a temporary directory outside the project (do **not**
   run these steps in the working copy — it has a database and env files already).
2. In the clone: `pnpm install`, then `pnpm db:setup`, then `pnpm test` and
   `pnpm typecheck`. Record whether each succeeds and the test count.
3. Confirm no step asked you to hand-create an environment file, install a database
   server, or edit anything. If it did, that is a FAIL — the README claims three
   commands.
4. Start the app (`pnpm dev` in the clone, or use an already-running instance on
   :3000 — say which you used). Confirm http://localhost:3000 loads and
   http://localhost:3000/api/registry/status returns JSON.

Everything below can be driven through the browser, through `curl`, or both. Prefer
the browser for anything about how something *reads*, and `curl` for exact payloads.

## 1. The empty state

5. With an empty registry (a clean clone has one), open `/`, `/entities`, and
   `/analytics`. Each should say plainly that there is nothing yet and point at the
   next action. A blank panel, a spinner that never resolves, a chart drawn around
   zero data, or `NaN`/`undefined`/`0%` anywhere is a FAIL. Screenshot each.

## 2. The happy path

Fixtures live in `sample-data/`. `provided/` is the assignment's own sample data.

6. Upload the three files in `sample-data/provided/` through the UI. Expect HTTP 200
   and a message that the registry was updated, with counts 5 / 5 / 5.
7. Upload **the same three files again**. Expect 200 with `changed: false` and a
   message saying the files match what is already stored. Then check
   `GET /api/registry/status`: the counts must be unchanged. Re-uploading must never
   duplicate rows — this is an explicit requirement.
8. Upload `sample-data/demo/` (a larger set: 32 / 26 / 36). Confirm the counts
   replace the previous ones rather than adding to them — 32, not 37.

## 3. Error reporting — the core of the assignment

The requirement is: **every** problem reported in **one** pass, each naming the file,
the spreadsheet line number, the column, and what to do about it. Validation must not
stop at the first error, and nothing may be written when there are any.

9. Upload `sample-data/defective/`. Expect HTTP 422 and exactly **21** errors, split
   `row: 14, reference: 4, graph: 3, structural: 0`.
10. Compare the reported errors against `sample-data/EXPECTED-ERRORS.md`, which lists
    every one with its intended line, column, and class. Report any error that is
    missing, extra, on the wrong line, or in the wrong class. Pay particular
    attention to these, which are the ones a naive implementation gets wrong:
    - `ownership.csv` line 4 — a child owned 115% in total across two rows. The
      error must be attributed to the row that breaks the ceiling, and must name
      both rows.
    - `ownership.csv` line 5 — an entity owning itself.
    - `ownership.csv` line 6 — a cycle. The message must show the path.
    - `entities.csv` line 7 — a duplicate Entity Name, naming the earlier line.
    - `entities.csv` line 6 — an invalid Entity Status with a spelling suggestion
      (`"Actve"` → `Did you mean "Active"?`).
11. Confirm the messages are addressed to a person with the spreadsheet open: they
    should name the fix, not the rule that fired. "Add it to the header row" and
    "Rename or remove them" are the register; "validation failed on field 3" is not.
12. Immediately after the 422, check `GET /api/registry/status`. It must still show
    the demo counts (32 / 26 / 36). **Nothing may be written when an upload is
    rejected** — verify this, do not assume it.
13. Upload `sample-data/defective-structural/`. Expect 422 with **4** structural
    errors: a missing column, unrecognised columns, a right-columns-wrong-order
    header, and a file with a header but no rows. Note that the last one has
    `line: null` — a fault in the whole file, not a row. Confirm the UI renders that
    row without an empty or `null` line cell.
14. Submit with a file missing (e.g. only `entities` and `ownership`). Expect HTTP
    400 naming which file is still needed. Then check the UI: can you even reach
    this state through the form, or does it prevent submission? Either is
    acceptable — say which, and whether the guard reads clearly.
15. Upload something that is neither CSV nor XLSX (e.g. rename a `.png`). Report
    what happens. It must be a clear message, never a stack trace or a 500.

## 4. XLSX support

The spec requires both `.csv` and `.xlsx` to be accepted.

16. Convert the three files in `sample-data/provided/` to `.xlsx` and upload those.
    Expect the same result as check 6. You can build them with the `exceljs`
    already in `apps/api`'s dependencies:

    ```js
    // node this from apps/api, adjusting paths
    const ExcelJS = require('exceljs');
    const { readFileSync } = require('node:fs');
    for (const name of ['entities', 'ownership', 'filings']) {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Sheet1');
      for (const line of readFileSync(`../../sample-data/provided/${name}.csv`, 'utf8').trim().split('\n')) {
        ws.addRow(line.split(','));
      }
      wb.xlsx.writeFile(`/tmp/${name}.xlsx`);
    }
    ```

17. Now break one cell in the `.xlsx` (e.g. set an Entity Status to `Actve`) and
    upload again. The error must report the **spreadsheet row number** as seen in
    Excel — header is line 1 — not a zero-based index. This is the check that
    catches an xlsx reader bolted on after the fact.

## 5. The model: FQs, subsidiaries, and the graph

A **foreign qualification** is the same legal entity registered in another
jurisdiction. A **subsidiary** is a different company that something owns a
percentage of. The assignment explicitly grades whether these are modelled as
different things.

Load `sample-data/demo/` for this section.

18. On `/entities`, find a foreign qualification. Confirm it: sits under its domestic
    entity, is visibly distinguished from a subsidiary (not merely by a word buried
    in a tooltip), and carries **no** ownership percentage.
19. Confirm no FQ appears as a top-level row, and no FQ appears as the child of an
    ownership edge.
20. Find a company owned by two different parents (`Northgate Materials Corp` in the
    demo set). It must appear under **both** parents, each time showing that
    parent's own percentage — 55% under one, 30% under the other. Showing it once is
    a FAIL: ownership is a graph, not a tree.
21. Expand that company under one parent. Its copy under the *other* parent must
    stay collapsed. They are two different facts on the page and must not share
    expansion state.
22. Confirm the page has no detail view — the assignment says the list is the whole
    thing, and a row that links to a `/entities/[id]` page is a FAIL.

## 6. Compliance

The status is derived, never taken from the file. The ladder, in order, with
inclusive-low boundaries:

| Condition | Status |
|---|---|
| Entity Status is Dissolved, Merged/Acquired, Revoked/Terminated, Divested/Sold, Dormant | `NOT_APPLICABLE` |
| No outstanding filing | `TBD` |
| Next due date 90+ days away | `GOOD_STANDING` |
| 0–89 days away | `FILING_DUE` |
| 1–364 days past | `OVERDUE` |
| 365+ days past | `SUSPENDED` |

23. Pick three entities across different branches. From `sample-data/demo/filings.csv`
    work out by hand what the next due date should be — the **earliest filing that is
    not Filed or Canceled** — and confirm the UI agrees, both on the date and on the
    status.
24. Confirm entity status wins over dates. `Silverbrook Pharma Ltd` is Dissolved and
    has an unfiled Annual Report that was due 2024-09-30 — long enough ago to be
    `SUSPENDED` on dates alone. It must read `NOT_APPLICABLE`.
25. `Marlowe Peak Ventures GP` has no filings at all. It must read `TBD`, not be
    silently treated as compliant.
26. Confirm a foreign qualification gets its **own** status from its own filings.
    `Northgate Materials Corp` is due 2026-06-30 and its Quebec FQ was due
    2025-01-31, so the two must show *different* statuses. An FQ that simply
    inherits its domestic entity's status is a FAIL — this is the check that
    catches an FQ modelled as a label rather than as a registration.
27. Read `apps/api/src/domain/compliance.spec.ts` and check the boundary cases are
    actually tested at 90, 89, 0, -1, -364 and -365 days, not just in the middle of
    each band.

## 7. The list page

28. Search for a subsidiary buried a few levels down. Its ancestors must remain
    visible as context, visually distinguished from the rows that actually matched.
    Returning the match alone, with no indication of where it sits, is a FAIL.
29. Apply each filter (jurisdiction, entity status, compliance status) and confirm
    the result matches what the same filter returns from
    `GET /api/registry/entities?...`.
30. Combine a search with a filter until nothing matches. Confirm you get a specific
    empty state about the filters — not the "registry is empty" message, which would
    be a lie, and not an empty page.
31. Confirm the filter dropdowns only offer values that exist in the data, and that
    choosing one filter does not empty the options of the others.

## 8. Analytics

32. Confirm there are four charts and that the filters apply at the **page** level,
    changing all of them together — not one control per chart.
33. Check every chart's numbers against `GET /api/analytics`. In particular, confirm
    the compliance totals sum to the number of entities, with each counted once.
34. Confirm entities with no Global Region appear as their own explicit group rather
    than being dropped.
35. The ownership chart is one bar per child, split into: the selected parent's
    stake, stakes other parents hold, and the remainder owned outside the registry.
    Confirm the three parts total 100% on every bar, and that the third part is
    visibly distinguished from a real holding.
36. Confirm that before a parent is chosen, the chart says so rather than rendering
    empty axes.
37. Filter until a chart genuinely has no data. Confirm a real empty state.
38. Check the legends: two categories must never share a colour. Compare swatches
    directly rather than trusting them.

## 9. Quality floor

39. Resize to a 390px-wide viewport (use a real viewport change — a device
    emulation mode or an iframe — not a CSS width, which does not move media
    queries). Confirm no horizontal scroll and nothing clipped on all three pages.
40. Tab through each page. Every interactive control must take focus in a sensible
    order with a visible focus ring.
41. Turn on "reduce motion" at the OS level and reload. Animation must not be the
    only thing conveying state.
42. Load `/entities` with JavaScript disabled, or check the server-rendered HTML with
    `curl`. Report how much of the page survives.
43. Check the browser console on all three pages, and the network tab, for errors,
    React key warnings, hydration mismatches, or failed requests.
44. Stop the API process and reload `/entities`. Confirm the page says the registry
    could not be reached and offers a retry, rather than hanging or showing an
    empty registry — which would be a lie about the data.

## 10. The public link

45. Open https://assignment.nikhiltayal.info. Confirm it loads over HTTPS, has data
    in it, and that all three pages work there — the deployed build, not just the
    local one, is what gets graded.

## Report

Produce a table of all 45 checks with PASS / FAIL / N/A and one line of evidence
each. Then, separately:

- **Blocking**: anything that breaks a stated requirement of the assignment.
- **Sloppy**: anything that works but reads as unfinished — wording, alignment,
  a number formatted three different ways.
- **Strong**: what is genuinely well done, since that is also information.

Be direct. A submission is being graded on this, so a finding you soften is a
finding the grader makes instead.
