import { nowInTz } from './time';

interface TimezoneEntry {
  value: string;
  keywords: string[];
}

const TIMEZONE_LIST: TimezoneEntry[] = [
  { value: 'Pacific/Honolulu', keywords: ['hawaii', 'hst'] },
  { value: 'America/Anchorage', keywords: ['alaska', 'akst'] },
  { value: 'America/Los_Angeles', keywords: ['pacific', 'pst', 'pdt', 'california', 'usa', 'us'] },
  { value: 'America/Denver', keywords: ['mountain', 'mst', 'mdt', 'colorado', 'usa', 'us'] },
  { value: 'America/Chicago', keywords: ['central', 'cst', 'cdt', 'texas', 'usa', 'us'] },
  { value: 'America/New_York', keywords: ['eastern', 'est', 'edt', 'usa', 'us'] },
  { value: 'America/Toronto', keywords: ['canada', 'ontario'] },
  { value: 'America/Vancouver', keywords: ['canada', 'british columbia'] },
  { value: 'America/Mexico_City', keywords: ['mexico'] },
  { value: 'America/Sao_Paulo', keywords: ['brazil', 'brasil'] },
  { value: 'America/Argentina/Buenos_Aires', keywords: ['argentina'] },
  { value: 'America/Bogota', keywords: ['colombia'] },
  { value: 'America/Lima', keywords: ['peru'] },
  { value: 'America/Santiago', keywords: ['chile'] },
  { value: 'Europe/London', keywords: ['uk', 'united kingdom', 'britain', 'england', 'gmt', 'bst'] },
  { value: 'Europe/Paris', keywords: ['france', 'cet', 'cest'] },
  { value: 'Europe/Berlin', keywords: ['germany', 'deutschland', 'cet', 'cest'] },
  { value: 'Europe/Madrid', keywords: ['spain'] },
  { value: 'Europe/Rome', keywords: ['italy', 'italia'] },
  { value: 'Europe/Amsterdam', keywords: ['netherlands', 'holland'] },
  { value: 'Europe/Brussels', keywords: ['belgium'] },
  { value: 'Europe/Zurich', keywords: ['switzerland'] },
  { value: 'Europe/Warsaw', keywords: ['poland'] },
  { value: 'Europe/Moscow', keywords: ['russia', 'msk'] },
  { value: 'Europe/Istanbul', keywords: ['turkey', 'türkiye'] },
  { value: 'Europe/Athens', keywords: ['greece'] },
  { value: 'Europe/Bucharest', keywords: ['romania'] },
  { value: 'Europe/Helsinki', keywords: ['finland'] },
  { value: 'Europe/Stockholm', keywords: ['sweden'] },
  { value: 'Europe/Oslo', keywords: ['norway'] },
  { value: 'Europe/Copenhagen', keywords: ['denmark'] },
  { value: 'Asia/Dubai', keywords: ['uae', 'emirates', 'gst'] },
  { value: 'Asia/Riyadh', keywords: ['saudi arabia', 'saudi'] },
  { value: 'Asia/Tehran', keywords: ['iran'] },
  { value: 'Asia/Karachi', keywords: ['pakistan', 'pkt'] },
  { value: 'Asia/Kolkata', keywords: ['india', 'ist', 'mumbai', 'delhi', 'bangalore', 'chennai'] },
  { value: 'Asia/Colombo', keywords: ['sri lanka'] },
  { value: 'Asia/Dhaka', keywords: ['bangladesh'] },
  { value: 'Asia/Bangkok', keywords: ['thailand'] },
  { value: 'Asia/Ho_Chi_Minh', keywords: ['vietnam'] },
  { value: 'Asia/Singapore', keywords: ['singapore', 'sgt'] },
  { value: 'Asia/Kuala_Lumpur', keywords: ['malaysia'] },
  { value: 'Asia/Jakarta', keywords: ['indonesia'] },
  { value: 'Asia/Manila', keywords: ['philippines'] },
  { value: 'Asia/Shanghai', keywords: ['china', 'cst', 'beijing'] },
  { value: 'Asia/Hong_Kong', keywords: ['hong kong', 'hkt'] },
  { value: 'Asia/Taipei', keywords: ['taiwan'] },
  { value: 'Asia/Tokyo', keywords: ['japan', 'jst'] },
  { value: 'Asia/Seoul', keywords: ['korea', 'south korea', 'kst'] },
  { value: 'Australia/Perth', keywords: ['australia', 'awst', 'western australia'] },
  { value: 'Australia/Sydney', keywords: ['australia', 'aest', 'new south wales'] },
  { value: 'Australia/Melbourne', keywords: ['australia', 'victoria'] },
  { value: 'Pacific/Auckland', keywords: ['new zealand', 'nz', 'nzst'] },
  { value: 'UTC', keywords: ['utc', 'gmt', 'coordinated universal'] },
];

export function searchTimezones(query: string, limit: number = 25) {
  const q = query.toLowerCase();

  if (q === '') return TIMEZONE_LIST.slice(0, limit);

  const scored = TIMEZONE_LIST
    .map((entry) => {
      const valLower = entry.value.toLowerCase();
      const keywordMatch = entry.keywords.some((kw) => kw.includes(q));
      const valueMatch = valLower.includes(q);
      if (!keywordMatch && !valueMatch) return null;
      const exactKeyword = entry.keywords.some((kw) => kw === q);
      const score = exactKeyword ? 2 : keywordMatch ? 1 : 0;
      return { entry, score };
    })
    .filter((x): x is { entry: TimezoneEntry; score: number } => x !== null)
    .sort((a, b) => b.score - a.score);

  return scored.map((s) => s.entry).slice(0, limit);
}

export function formatTimezoneChoices(entries: TimezoneEntry[]) {
  return entries.map((entry) => {
    const now = nowInTz(entry.value);
    const label = `${entry.value} (${now.toFormat('HH:mm')})`;
    return { name: label, value: entry.value };
  });
}
