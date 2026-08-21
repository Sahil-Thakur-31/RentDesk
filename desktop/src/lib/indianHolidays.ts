export type HolidayCategory = 'nationalHoliday' | 'festival';

export interface HolidayInfo {
  date: string; // YYYY-MM-DD
  name: string;
  category: HolidayCategory;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const toDateInput = (year: number, month: number, day: number) => `${year}-${pad2(month)}-${pad2(day)}`;

interface FixedEntry {
  month: number;
  day: number;
  name: string;
}

// Same Gregorian date every year.
const FIXED_HOLIDAYS: FixedEntry[] = [
  { month: 1, day: 1, name: "New Year's Day" },
  { month: 1, day: 26, name: 'Republic Day' },
  { month: 5, day: 1, name: 'Labour Day' },
  { month: 8, day: 15, name: 'Independence Day' },
  { month: 10, day: 2, name: 'Gandhi Jayanti' },
  { month: 12, day: 25, name: 'Christmas' }
];

// Movable festivals — lunar/Islamic calendars shift every year, so these are
// hardcoded per year rather than computed. Verify against an official
// calendar before relying on them, especially for years further out; Islamic
// dates (Eid, Muharram, Milad-un-Nabi) can also shift by a day depending on
// local moon sighting.
const FESTIVALS_BY_YEAR: Record<number, FixedEntry[]> = {
  2025: [
    { month: 1, day: 14, name: 'Makar Sankranti' },
    { month: 2, day: 26, name: 'Maha Shivratri' },
    { month: 3, day: 14, name: 'Holi' },
    { month: 3, day: 31, name: 'Eid al-Fitr' },
    { month: 4, day: 6, name: 'Ram Navami' },
    { month: 4, day: 10, name: 'Mahavir Jayanti' },
    { month: 5, day: 12, name: 'Buddha Purnima' },
    { month: 6, day: 7, name: 'Eid al-Adha (Bakrid)' },
    { month: 7, day: 6, name: 'Muharram' },
    { month: 8, day: 9, name: 'Raksha Bandhan' },
    { month: 8, day: 16, name: 'Janmashtami' },
    { month: 8, day: 27, name: 'Ganesh Chaturthi' },
    { month: 9, day: 5, name: 'Onam' },
    { month: 9, day: 22, name: 'Navratri Begins' },
    { month: 10, day: 2, name: 'Dussehra (Vijayadashami)' },
    { month: 10, day: 20, name: 'Diwali (Deepavali)' },
    { month: 10, day: 23, name: 'Bhai Dooj' },
    { month: 11, day: 5, name: 'Guru Nanak Jayanti' }
  ],
  2026: [
    { month: 1, day: 14, name: 'Makar Sankranti' },
    { month: 2, day: 15, name: 'Maha Shivratri' },
    { month: 3, day: 4, name: 'Holi' },
    { month: 3, day: 20, name: 'Eid al-Fitr' },
    { month: 3, day: 26, name: 'Ram Navami' },
    { month: 3, day: 31, name: 'Mahavir Jayanti' },
    { month: 5, day: 1, name: 'Buddha Purnima' },
    { month: 5, day: 27, name: 'Eid al-Adha (Bakrid)' },
    { month: 6, day: 25, name: 'Muharram' },
    { month: 8, day: 28, name: 'Raksha Bandhan' },
    { month: 9, day: 4, name: 'Janmashtami' },
    { month: 9, day: 14, name: 'Ganesh Chaturthi' },
    { month: 10, day: 11, name: 'Navratri Begins' },
    { month: 10, day: 20, name: 'Dussehra (Vijayadashami)' },
    { month: 11, day: 8, name: 'Diwali (Deepavali)' },
    { month: 11, day: 24, name: 'Guru Nanak Jayanti' }
  ]
};

// Anonymous Gregorian algorithm (Computus) — Good Friday = Easter Sunday - 2 days.
const getGoodFriday = (year: number): FixedEntry => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const easter = new Date(year, month - 1, day);
  easter.setDate(easter.getDate() - 2);
  return { month: easter.getMonth() + 1, day: easter.getDate(), name: 'Good Friday' };
};

const yearCache = new Map<number, HolidayInfo[]>();

export const getHolidaysForYear = (year: number): HolidayInfo[] => {
  const cached = yearCache.get(year);
  if (cached) return cached;

  const result: HolidayInfo[] = FIXED_HOLIDAYS.map((entry) => ({
    date: toDateInput(year, entry.month, entry.day),
    name: entry.name,
    category: 'nationalHoliday' as const
  }));

  const goodFriday = getGoodFriday(year);
  result.push({ date: toDateInput(year, goodFriday.month, goodFriday.day), name: goodFriday.name, category: 'nationalHoliday' });

  const festivals = FESTIVALS_BY_YEAR[year] || [];
  festivals.forEach((entry) => {
    result.push({ date: toDateInput(year, entry.month, entry.day), name: entry.name, category: 'festival' });
  });

  result.sort((a, b) => a.date.localeCompare(b.date));
  yearCache.set(year, result);
  return result;
};

export const hasFestivalDataForYear = (year: number) => Boolean(FESTIVALS_BY_YEAR[year]);
