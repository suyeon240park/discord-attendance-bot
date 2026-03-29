import { DateTime } from 'luxon';

export function nowInTz(timezone: string): DateTime {
  return DateTime.now().setZone(timezone);
}

export function getTodayDate(timezone: string): string {
  return nowInTz(timezone).toFormat('yyyy-MM-dd');
}

export function getISODayOfWeek(timezone: string): number {
  return nowInTz(timezone).weekday; // 1=Mon ... 7=Sun
}

export function getCurrentHHmm(timezone: string): string {
  return nowInTz(timezone).toFormat('HH:mm');
}

export function getCurrentYearMonth(timezone: string): string {
  return nowInTz(timezone).toFormat('yyyy-MM');
}

export function formatHHmmToAmPm(hhMm: string): string {
  const [h, m] = hhMm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export function formatSlotTime(startTime: string, endTime: string): string {
  return `${formatHHmmToAmPm(startTime)} – ${formatHHmmToAmPm(endTime)}`;
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

/**
 * Convert a date + HH:mm string in a given timezone to a Unix timestamp (seconds).
 */
export function slotToUnixTimestamp(date: string, timeHHmm: string, timezone: string): number {
  const dt = DateTime.fromISO(`${date}T${timeHHmm}`, { zone: timezone });
  return Math.floor(dt.toSeconds());
}

/**
 * Returns a Discord dynamic timestamp string: `<t:UNIX:STYLE>`.
 * Styles: t (short time), T (long time), d (short date), D (long date),
 *         f (short datetime), F (long datetime), R (relative).
 */
export function discordTimestamp(unixSeconds: number, style: string = 't'): string {
  return `<t:${unixSeconds}:${style}>`;
}

/**
 * Build a Discord timestamp range string for a slot on a given date.
 * Returns e.g. `<t:UNIX:t> – <t:UNIX:t>` which Discord renders per-viewer.
 */
export function discordSlotRange(date: string, startTime: string, endTime: string, timezone: string): string {
  const startUnix = slotToUnixTimestamp(date, startTime, timezone);
  const endUnix = slotToUnixTimestamp(date, endTime, timezone);
  return `${discordTimestamp(startUnix, 't')} – ${discordTimestamp(endUnix, 't')}`;
}

/**
 * Convert an HH:mm time from one timezone to another on a specific date.
 * Returns the converted HH:mm string and whether the day shifted.
 */
export function convertTime(
  timeHHmm: string,
  date: string,
  fromTz: string,
  toTz: string
): { time: string; dayOffset: number } {
  const dt = DateTime.fromISO(`${date}T${timeHHmm}`, { zone: fromTz });
  const converted = dt.setZone(toTz);
  const convertedDate = converted.toFormat('yyyy-MM-dd');
  const dayOffset = DateTime.fromISO(convertedDate).diff(DateTime.fromISO(date), 'days').days;
  return { time: converted.toFormat('HH:mm'), dayOffset: Math.round(dayOffset) };
}

/**
 * Convert a slot time range from guild timezone to user timezone.
 * Returns formatted strings for both timezones and a day-shift indicator.
 */
export function convertSlotTime(
  startTime: string,
  endTime: string,
  date: string,
  fromTz: string,
  toTz: string
): { startTime: string; endTime: string; dayOffset: number } {
  const start = convertTime(startTime, date, fromTz, toTz);
  const end = convertTime(endTime, date, fromTz, toTz);
  return { startTime: start.time, endTime: end.time, dayOffset: start.dayOffset };
}

/**
 * Format slot time for display to a user, converted to their timezone.
 * Falls back to guild timezone if no user timezone is set.
 */
export function formatSlotTimeForUser(
  startTime: string,
  endTime: string,
  guildTz: string,
  userTz?: string,
  date?: string
): string {
  if (!userTz || userTz === guildTz) return formatSlotTime(startTime, endTime);

  const effectiveDate = date ?? getTodayDate(guildTz);
  const converted = convertSlotTime(startTime, endTime, effectiveDate, guildTz, userTz);
  const label = formatSlotTime(converted.startTime, converted.endTime);

  if (converted.dayOffset !== 0) {
    const sign = converted.dayOffset > 0 ? '+' : '';
    return `${label} (${sign}${converted.dayOffset}d)`;
  }
  return label;
}

export function isValidTimezone(tz: string): boolean {
  return DateTime.now().setZone(tz).isValid;
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
