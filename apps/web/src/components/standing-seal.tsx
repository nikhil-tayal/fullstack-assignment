import type { CSSProperties } from 'react';
import type { ComplianceStatus } from '@/lib/types';

/** Compliance is the only place colour carries meaning, so the map lives here alone. */
const STATUS_COLOUR: Record<ComplianceStatus, string> = {
  GOOD_STANDING: 'var(--seal)',
  FILING_DUE: 'var(--amber)',
  OVERDUE: 'var(--stamp)',
  SUSPENDED: 'var(--void)',
  NOT_APPLICABLE: 'var(--ink-faint)',
  TBD: 'var(--slate)',
};

/** The two states that get a stamp pressed over them, and the word it reads. */
const STAMP_WORD: Partial<Record<ComplianceStatus, string>> = {
  OVERDUE: 'Overdue',
  SUSPENDED: 'Suspended',
};

/** Below this the ring is illegible, so the seal degrades to a plain colour dot. */
const MIN_RING_SIZE = 44;

const ARC_RADIUS = 42.5;
const ARC_LENGTH = 2 * Math.PI * ARC_RADIUS;

/**
 * How full the ring reads, given days to the next filing.
 *
 * A straight days/365 mapping would put a comfortably good-standing entity at a
 * quarter ring, contradicting its own colour. So the arc is pinned to the same
 * ladder the colour uses: good standing owns the ring from 55% up, filing due
 * from a sliver to 40%, and a passed deadline is empty. Ring and colour then
 * always say the same thing, and the gap between the two bands means crossing
 * the 90-day threshold is a visible step rather than one more degree of arc.
 */
function arcFraction(status: ComplianceStatus, daysToDue: number | null): number {
  if (daysToDue === null) return 0;
  if (status === 'GOOD_STANDING') {
    const beyond = Math.min(Math.max(daysToDue - 90, 0), 275) / 275;
    return 0.55 + 0.45 * beyond;
  }
  if (status === 'FILING_DUE') {
    return 0.06 + 0.34 * (Math.min(Math.max(daysToDue, 0), 90) / 90);
  }
  return 0;
}

function describe(status: ComplianceStatus, daysToDue: number | null): string {
  switch (status) {
    case 'GOOD_STANDING':
      return `Good standing, ${daysToDue} days to the next filing.`;
    case 'FILING_DUE':
      return `Filing due in ${daysToDue} days.`;
    case 'OVERDUE':
      return `Overdue by ${Math.abs(daysToDue ?? 0)} days.`;
    case 'SUSPENDED':
      return `Suspended. Overdue by ${Math.abs(daysToDue ?? 0)} days.`;
    case 'NOT_APPLICABLE':
      return 'Not applicable. This entity has no filing obligation.';
    case 'TBD':
      return 'To be determined. No filing due date on record.';
  }
}

export interface StandingSealProps {
  status: ComplianceStatus;
  daysToDue: number | null;
  /** 44px in list rows, 96px in the analytics chart centre. */
  size?: number;
  /** Stagger for the list page's one orchestrated moment: 30ms per row. */
  delayMs?: number;
  className?: string;
}

/**
 * The signature element. Every entity's compliance status is a seal: a
 * certificate-style double ring in the compliance colour, its outer arc
 * depleting towards the deadline, with the days remaining set in Bodoni.
 *
 * Rendered without client state on purpose — the draw-on-mount animation is a
 * CSS keyframe whose *from* is the empty ring, so the HTML the server sends is
 * already the final state. No JS, or reduced motion, and the ring is simply there.
 */
export function StandingSeal({
  status,
  daysToDue,
  size = MIN_RING_SIZE,
  delayMs = 0,
  className,
}: StandingSealProps) {
  const colour = STATUS_COLOUR[status];
  const label = describe(status, daysToDue);

  if (size < MIN_RING_SIZE) {
    return (
      <span
        role="img"
        aria-label={label}
        className={`inline-block shrink-0 rounded-full ${className ?? ''}`}
        style={{ width: size, height: size, background: colour }}
      />
    );
  }

  const stampWord = STAMP_WORD[status];
  const fraction = arcFraction(status, daysToDue);
  const offset = ARC_LENGTH * (1 - fraction);

  return (
    <span
      role="img"
      aria-label={label}
      className={`relative inline-block shrink-0 align-middle ${className ?? ''}`}
      style={{ width: size, height: size, color: colour }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        {status === 'NOT_APPLICABLE' ? (
          <StruckDisc />
        ) : status === 'TBD' ? (
          <EmptyRing />
        ) : (
          <>
            <EngravedRings />
            <circle
              cx="50"
              cy="50"
              r={ARC_RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              opacity="0.14"
            />
            <circle
              className="seal-arc"
              cx="50"
              cy="50"
              r={ARC_RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={ARC_LENGTH}
              strokeDashoffset={offset}
              transform="rotate(-90 50 50)"
              style={
                {
                  '--seal-arc-length': ARC_LENGTH,
                  animationDelay: `${delayMs}ms`,
                } as CSSProperties
              }
            />
            {/* The stamp carries the message for these two, so the interior
                number would only sit behind it as noise. */}
            {!stampWord && daysToDue !== null && (
              <text
                x="50"
                y="50"
                textAnchor="middle"
                dominantBaseline="central"
                fill="currentColor"
                fontSize="30"
                fontFamily="var(--font-bodoni-moda), Didot, Georgia, serif"
              >
                {daysToDue}
              </text>
            )}
          </>
        )}
      </svg>

      {stampWord && <Stamp word={stampWord} size={size} />}
    </span>
  );
}

/** The engraving: two hairlines either side of the arc, as on a share certificate. */
function EngravedRings() {
  return (
    <>
      <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </>
  );
}

/** NOT_APPLICABLE: no deadline to run down, so no arc — a disc, ruled through. */
function StruckDisc() {
  return (
    <>
      <circle cx="50" cy="50" r="47" fill="currentColor" opacity="0.16" />
      <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <line x1="12" y1="50" x2="88" y2="50" stroke="currentColor" strokeWidth="2.5" opacity="0.9" />
    </>
  );
}

/** TBD: there is no date to show, and absence says that better than the word would. */
function EmptyRing() {
  return (
    <circle
      cx="50"
      cy="50"
      r="47"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      opacity="0.85"
    />
  );
}

/**
 * Pressed on, not designed in: it overhangs the seal and sits at an angle, the
 * way a docket stamp lands on a page it was never laid out for.
 */
function Stamp({ word, size }: { word: string; size: number }) {
  // It overhangs the ring, but only just: at 1.36× a 44px seal the stamp still
  // clears the row's neighbours, and the type is sized to the longest word so
  // OVERDUE and SUSPENDED read at the same weight rather than one shrinking.
  const width = size * 1.36;
  const inner = width - size * 0.12 - 4;
  const fontSize = Math.min(inner / (word.length * 0.7), size * 0.2);

  return (
    <span
      className="pointer-events-none absolute left-1/2 top-1/2 flex items-center justify-center whitespace-nowrap border-2 border-stamp uppercase text-stamp"
      style={{
        width,
        paddingBlock: size * 0.06,
        paddingInline: size * 0.06,
        fontSize,
        letterSpacing: '0.08em',
        fontWeight: 600,
        borderRadius: 2,
        transform: 'translate(-50%, -50%) rotate(-8deg)',
      }}
    >
      {word}
    </span>
  );
}
