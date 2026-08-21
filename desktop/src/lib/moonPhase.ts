// Known new moon reference: 2000-01-06 18:14 UTC
const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const SYNODIC_MONTH_DAYS = 29.530588853;

export type MoonPhaseName = 'newMoon' | 'firstQuarter' | 'fullMoon' | 'lastQuarter';

export const MOON_PHASE_LABELS: Record<MoonPhaseName, string> = {
  newMoon: 'New Moon',
  firstQuarter: 'First Quarter Moon',
  fullMoon: 'Full Moon',
  lastQuarter: 'Last Quarter Moon'
};

export const MOON_PHASE_ICONS: Record<MoonPhaseName, string> = {
  newMoon: '\u{1F311}',
  firstQuarter: '\u{1F313}',
  fullMoon: '\u{1F315}',
  lastQuarter: '\u{1F317}'
};

const getMoonAgeDays = (date: Date): number => {
  const noonUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  const diffDays = (noonUtc - REFERENCE_NEW_MOON_MS) / 86400000;
  const age = diffDays % SYNODIC_MONTH_DAYS;
  return age < 0 ? age + SYNODIC_MONTH_DAYS : age;
};

// Returns the phase name if `date` is the closest calendar day to that lunar phase, else null.
export const getMoonPhaseForDate = (date: Date): MoonPhaseName | null => {
  const age = getMoonAgeDays(date);
  const targets: { phase: MoonPhaseName; age: number }[] = [
    { phase: 'newMoon', age: 0 },
    { phase: 'firstQuarter', age: SYNODIC_MONTH_DAYS / 4 },
    { phase: 'fullMoon', age: SYNODIC_MONTH_DAYS / 2 },
    { phase: 'lastQuarter', age: (3 * SYNODIC_MONTH_DAYS) / 4 }
  ];

  for (const target of targets) {
    let diff = Math.abs(age - target.age);
    diff = Math.min(diff, SYNODIC_MONTH_DAYS - diff);
    if (diff < 0.5) return target.phase;
  }
  return null;
};
