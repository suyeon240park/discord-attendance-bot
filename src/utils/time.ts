import { DateTime } from 'luxon';

export const TIMEZONE = 'America/New_York';

export function nowInTz(): DateTime {
  return DateTime.now().setZone(TIMEZONE);
}

export function formatSlotTime(startTime: string, endTime: string): string {
  return `${startTime} – ${endTime}`;
}

export function parseHHmm(time: string): { hour: number; minute: number } | null {
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Parses "HH:MM-HH:MM" into { startTime, endTime } as "HH:mm" strings.
 * Returns null if the format is invalid or start >= end.
 */
export function parseSlotTimeRange(
  raw: string
): { startTime: string; endTime: string } | null {
  const parts = raw.trim().split('-');
  if (parts.length !== 2) return null;
  const [startRaw, endRaw] = parts;
  if (!parseHHmm(startRaw) || !parseHHmm(endRaw)) return null;
  if (startRaw >= endRaw) return null;
  return { startTime: startRaw, endTime: endRaw };
}

export function getISODayOfWeek(): number {
  return nowInTz().weekday; // 1=Mon ... 7=Sun
}

export function getTodayDate(): string {
  return nowInTz().toFormat('yyyy-MM-dd');
}

export function getCurrentYearMonth(): string {
  return nowInTz().toFormat('yyyy-MM');
}

export function getCurrentHHmm(): string {
  return nowInTz().toFormat('HH:mm');
}

export const DAY_NAMES: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

export const DAY_SHORT: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};
