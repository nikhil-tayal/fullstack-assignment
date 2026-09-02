import { describe, expect, it } from 'vitest';
import {
  calendarDaysBetween,
  complianceStatus,
  nextFilingDueDate,
} from './compliance';
import { ENTITY_STATUSES, TERMINAL_ENTITY_STATUSES } from './vocabulary';

const TODAY = new Date(2026, 8, 2); // 2026-09-02, local midnight

/** The date exactly `d` calendar days from TODAY. */
const at = (d: number) => new Date(2026, 8, 2 + d);

describe('calendarDaysBetween', () => {
  it('counts whole days forward and backward', () => {
    expect(calendarDaysBetween(TODAY, at(0))).toBe(0);
    expect(calendarDaysBetween(TODAY, at(1))).toBe(1);
    expect(calendarDaysBetween(TODAY, at(-1))).toBe(-1);
    expect(calendarDaysBetween(TODAY, at(365))).toBe(365);
  });

  it('ignores time of day, so the answer does not drift within a day', () => {
    const morning = new Date(2026, 8, 2, 1, 0, 0);
    const midnight = new Date(2026, 8, 2, 0, 0, 0);
    const nearlyMidnight = new Date(2026, 8, 2, 23, 59, 59);
    expect(calendarDaysBetween(morning, at(90))).toBe(90);
    expect(calendarDaysBetween(midnight, at(90))).toBe(90);
    expect(calendarDaysBetween(nearlyMidnight, at(90))).toBe(90);
  });

  it('crosses a daylight-saving boundary without losing a day', () => {
    // US DST ends 2026-11-01; a naive ms subtraction yields 30.958… days here.
    const oct15 = new Date(2026, 9, 15);
    const nov15 = new Date(2026, 10, 15);
    expect(calendarDaysBetween(oct15, nov15)).toBe(31);
  });
});

describe('nextFilingDueDate', () => {
  it('is null when there are no filings at all', () => {
    expect(nextFilingDueDate([])).toBeNull();
  });

  it('takes the earliest outstanding due date', () => {
    const due = nextFilingDueDate([
      { dueDate: at(200), status: 'Not Started' },
      { dueDate: at(30), status: 'In Progress' },
      { dueDate: at(90), status: 'Rejected' },
    ]);
    expect(due).toEqual(at(30));
  });

  it('ignores Filed and Canceled, even when they are the earliest', () => {
    const due = nextFilingDueDate([
      { dueDate: at(-100), status: 'Filed' },
      { dueDate: at(-50), status: 'Canceled' },
      { dueDate: at(10), status: 'Not Started' },
    ]);
    expect(due).toEqual(at(10));
  });

  it('still counts Submitted and Rejected as outstanding', () => {
    expect(nextFilingDueDate([{ dueDate: at(5), status: 'Submitted' }])).toEqual(at(5));
    expect(nextFilingDueDate([{ dueDate: at(5), status: 'Rejected' }])).toEqual(at(5));
  });

  it('is null when every filing is settled', () => {
    expect(
      nextFilingDueDate([
        { dueDate: at(-10), status: 'Filed' },
        { dueDate: at(10), status: 'Canceled' },
      ]),
    ).toBeNull();
  });
});

describe('complianceStatus ladder', () => {
  it('returns NOT_APPLICABLE for every terminal entity status', () => {
    for (const status of TERMINAL_ENTITY_STATUSES) {
      expect(complianceStatus(status, at(200), TODAY)).toBe('NOT_APPLICABLE');
    }
  });

  it('lets entity status win outright over a badly overdue date', () => {
    // The spec's own example: dissolved and two years overdue is NOT_APPLICABLE.
    expect(complianceStatus('Dissolved', at(-730), TODAY)).toBe('NOT_APPLICABLE');
  });

  it('returns TBD when there is no next filing due date', () => {
    expect(complianceStatus('Active', null, TODAY)).toBe('TBD');
    expect(complianceStatus('In Formation', null, TODAY)).toBe('TBD');
  });

  it('puts NOT_APPLICABLE ahead of TBD when both could apply', () => {
    expect(complianceStatus('Dormant', null, TODAY)).toBe('NOT_APPLICABLE');
  });

  // The boundaries are the whole point of the ladder, so each one is pinned from
  // both sides rather than sampled somewhere in the middle of a band.
  it.each([
    [365, 'GOOD_STANDING'],
    [91, 'GOOD_STANDING'],
    [90, 'GOOD_STANDING'], // d >= 90
    [89, 'FILING_DUE'], // first day below the threshold
    [1, 'FILING_DUE'],
    [0, 'FILING_DUE'], // due today
    [-1, 'OVERDUE'], // first day past due
    [-363, 'OVERDUE'],
    [-364, 'OVERDUE'], // last OVERDUE day
    [-365, 'SUSPENDED'], // first SUSPENDED day
    [-1000, 'SUSPENDED'],
  ])('d = %i is %s', (d, expected) => {
    expect(complianceStatus('Active', at(d), TODAY)).toBe(expected);
  });

  it('applies the same ladder to non-terminal statuses other than Active', () => {
    expect(complianceStatus('In Formation', at(90), TODAY)).toBe('GOOD_STANDING');
    expect(complianceStatus('In Formation', at(-1), TODAY)).toBe('OVERDUE');
  });

  it('classifies every entity status as either terminal or ladder-driven', () => {
    // Guards against a status being added to the vocabulary without deciding which
    // side of the first rung it falls on.
    for (const status of ENTITY_STATUSES) {
      const result = complianceStatus(status, at(200), TODAY);
      const terminal = (TERMINAL_ENTITY_STATUSES as readonly string[]).includes(status);
      expect(result).toBe(terminal ? 'NOT_APPLICABLE' : 'GOOD_STANDING');
    }
  });
});
