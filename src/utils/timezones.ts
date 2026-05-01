import { nowInTz } from './time';

interface TimezoneEntry {
  value: string;
  keywords: string[];
}

const TIMEZONE_LIST: TimezoneEntry[] = [
  // UTC
  { value: 'UTC', keywords: ['utc', 'gmt', 'coordinated universal'] },

  // Americas — Pacific & Hawaii
  { value: 'Pacific/Honolulu', keywords: ['hawaii', 'hst'] },
  { value: 'America/Anchorage', keywords: ['alaska', 'akst'] },
  { value: 'America/Los_Angeles', keywords: ['pacific', 'pst', 'pdt', 'california', 'usa', 'us'] },
  { value: 'America/Phoenix', keywords: ['arizona', 'mst', 'usa', 'us'] },
  { value: 'America/Denver', keywords: ['mountain', 'mst', 'mdt', 'colorado', 'usa', 'us'] },
  { value: 'America/Chicago', keywords: ['central', 'cst', 'cdt', 'texas', 'usa', 'us'] },
  { value: 'America/New_York', keywords: ['eastern', 'est', 'edt', 'usa', 'us'] },
  { value: 'America/Puerto_Rico', keywords: ['puerto rico', 'ast', 'usa', 'us'] },

  // Americas — Canada
  { value: 'America/Vancouver', keywords: ['canada', 'british columbia'] },
  { value: 'America/Edmonton', keywords: ['canada', 'alberta'] },
  { value: 'America/Winnipeg', keywords: ['canada', 'manitoba'] },
  { value: 'America/Toronto', keywords: ['canada', 'ontario'] },
  { value: 'America/Halifax', keywords: ['canada', 'nova scotia', 'atlantic', 'ast'] },
  { value: 'America/St_Johns', keywords: ['canada', 'newfoundland', 'nst'] },

  // Americas — Central America & Caribbean
  { value: 'America/Mexico_City', keywords: ['mexico'] },
  { value: 'America/Costa_Rica', keywords: ['costa rica'] },
  { value: 'America/Guatemala', keywords: ['guatemala'] },
  { value: 'America/Panama', keywords: ['panama'] },
  { value: 'America/Havana', keywords: ['cuba'] },
  { value: 'America/Jamaica', keywords: ['jamaica'] },

  // Americas — South America
  { value: 'America/Bogota', keywords: ['colombia'] },
  { value: 'America/Lima', keywords: ['peru'] },
  { value: 'America/Guayaquil', keywords: ['ecuador'] },
  { value: 'America/Caracas', keywords: ['venezuela'] },
  { value: 'America/La_Paz', keywords: ['bolivia'] },
  { value: 'America/Santiago', keywords: ['chile'] },
  { value: 'America/Asuncion', keywords: ['paraguay'] },
  { value: 'America/Montevideo', keywords: ['uruguay'] },
  { value: 'America/Sao_Paulo', keywords: ['brazil', 'brasil'] },
  { value: 'America/Argentina/Buenos_Aires', keywords: ['argentina'] },

  // Europe — Western
  { value: 'Europe/London', keywords: ['uk', 'united kingdom', 'britain', 'england', 'gmt', 'bst'] },
  { value: 'Europe/Dublin', keywords: ['ireland'] },
  { value: 'Europe/Lisbon', keywords: ['portugal'] },
  { value: 'Atlantic/Reykjavik', keywords: ['iceland'] },

  // Europe — Central
  { value: 'Europe/Paris', keywords: ['france', 'cet', 'cest'] },
  { value: 'Europe/Berlin', keywords: ['germany', 'deutschland', 'cet', 'cest'] },
  { value: 'Europe/Madrid', keywords: ['spain'] },
  { value: 'Europe/Rome', keywords: ['italy', 'italia'] },
  { value: 'Europe/Amsterdam', keywords: ['netherlands', 'holland'] },
  { value: 'Europe/Brussels', keywords: ['belgium'] },
  { value: 'Europe/Zurich', keywords: ['switzerland'] },
  { value: 'Europe/Vienna', keywords: ['austria'] },
  { value: 'Europe/Prague', keywords: ['czech republic', 'czechia'] },
  { value: 'Europe/Budapest', keywords: ['hungary'] },
  { value: 'Europe/Warsaw', keywords: ['poland'] },
  { value: 'Europe/Belgrade', keywords: ['serbia'] },
  { value: 'Europe/Zagreb', keywords: ['croatia'] },
  { value: 'Europe/Stockholm', keywords: ['sweden'] },
  { value: 'Europe/Oslo', keywords: ['norway'] },
  { value: 'Europe/Copenhagen', keywords: ['denmark'] },
  { value: 'Europe/Helsinki', keywords: ['finland'] },

  // Europe — Eastern
  { value: 'Europe/Athens', keywords: ['greece', 'eet'] },
  { value: 'Europe/Bucharest', keywords: ['romania'] },
  { value: 'Europe/Sofia', keywords: ['bulgaria'] },
  { value: 'Europe/Istanbul', keywords: ['turkey', 'türkiye'] },
  { value: 'Europe/Kyiv', keywords: ['ukraine'] },
  { value: 'Europe/Vilnius', keywords: ['lithuania'] },
  { value: 'Europe/Riga', keywords: ['latvia'] },
  { value: 'Europe/Tallinn', keywords: ['estonia'] },
  { value: 'Europe/Minsk', keywords: ['belarus'] },

  // Russia (11 time zones)
  { value: 'Europe/Kaliningrad', keywords: ['russia', 'kaliningrad'] },
  { value: 'Europe/Moscow', keywords: ['russia', 'msk', 'moscow'] },
  { value: 'Europe/Samara', keywords: ['russia', 'samara'] },
  { value: 'Asia/Yekaterinburg', keywords: ['russia', 'yekaterinburg', 'ufa', 'chelyabinsk', 'perm'] },
  { value: 'Asia/Omsk', keywords: ['russia', 'omsk'] },
  { value: 'Asia/Krasnoyarsk', keywords: ['russia', 'krasnoyarsk', 'novosibirsk'] },
  { value: 'Asia/Irkutsk', keywords: ['russia', 'irkutsk'] },
  { value: 'Asia/Yakutsk', keywords: ['russia', 'yakutsk'] },
  { value: 'Asia/Vladivostok', keywords: ['russia', 'vladivostok'] },
  { value: 'Asia/Magadan', keywords: ['russia', 'magadan'] },
  { value: 'Asia/Kamchatka', keywords: ['russia', 'kamchatka', 'petropavlovsk'] },

  // Africa
  { value: 'Africa/Casablanca', keywords: ['morocco'] },
  { value: 'Africa/Algiers', keywords: ['algeria'] },
  { value: 'Africa/Cairo', keywords: ['egypt'] },
  { value: 'Africa/Lagos', keywords: ['nigeria', 'west africa', 'wat'] },
  { value: 'Africa/Accra', keywords: ['ghana'] },
  { value: 'Africa/Nairobi', keywords: ['kenya', 'east africa', 'eat'] },
  { value: 'Africa/Addis_Ababa', keywords: ['ethiopia'] },
  { value: 'Africa/Dar_es_Salaam', keywords: ['tanzania'] },
  { value: 'Africa/Johannesburg', keywords: ['south africa', 'sast'] },

  // Middle East
  { value: 'Asia/Jerusalem', keywords: ['israel', 'ist'] },
  { value: 'Asia/Beirut', keywords: ['lebanon'] },
  { value: 'Asia/Amman', keywords: ['jordan'] },
  { value: 'Asia/Baghdad', keywords: ['iraq'] },
  { value: 'Asia/Kuwait', keywords: ['kuwait'] },
  { value: 'Asia/Riyadh', keywords: ['saudi arabia', 'saudi'] },
  { value: 'Asia/Qatar', keywords: ['qatar', 'doha'] },
  { value: 'Asia/Dubai', keywords: ['uae', 'emirates', 'gst'] },
  { value: 'Asia/Muscat', keywords: ['oman'] },
  { value: 'Asia/Tehran', keywords: ['iran'] },

  // Caucasus & Central Asia
  { value: 'Asia/Tbilisi', keywords: ['georgia'] },
  { value: 'Asia/Yerevan', keywords: ['armenia'] },
  { value: 'Asia/Baku', keywords: ['azerbaijan'] },
  { value: 'Asia/Tashkent', keywords: ['uzbekistan'] },
  { value: 'Asia/Almaty', keywords: ['kazakhstan'] },

  // South Asia
  { value: 'Asia/Karachi', keywords: ['pakistan', 'pkt'] },
  { value: 'Asia/Kolkata', keywords: ['india', 'ist', 'mumbai', 'delhi', 'bangalore', 'chennai'] },
  { value: 'Asia/Kathmandu', keywords: ['nepal'] },
  { value: 'Asia/Colombo', keywords: ['sri lanka'] },
  { value: 'Asia/Dhaka', keywords: ['bangladesh'] },
  { value: 'Asia/Yangon', keywords: ['myanmar', 'burma'] },

  // Southeast Asia
  { value: 'Asia/Bangkok', keywords: ['thailand'] },
  { value: 'Asia/Ho_Chi_Minh', keywords: ['vietnam'] },
  { value: 'Asia/Phnom_Penh', keywords: ['cambodia'] },
  { value: 'Asia/Jakarta', keywords: ['indonesia'] },
  { value: 'Asia/Singapore', keywords: ['singapore', 'sgt'] },
  { value: 'Asia/Kuala_Lumpur', keywords: ['malaysia'] },
  { value: 'Asia/Manila', keywords: ['philippines'] },

  // East Asia
  { value: 'Asia/Shanghai', keywords: ['china', 'cst', 'beijing'] },
  { value: 'Asia/Hong_Kong', keywords: ['hong kong', 'hkt'] },
  { value: 'Asia/Taipei', keywords: ['taiwan'] },
  { value: 'Asia/Tokyo', keywords: ['japan', 'jst'] },
  { value: 'Asia/Seoul', keywords: ['korea', 'south korea', 'kst'] },

  // Australia
  { value: 'Australia/Perth', keywords: ['australia', 'awst', 'western australia'] },
  { value: 'Australia/Darwin', keywords: ['australia', 'acst', 'northern territory'] },
  { value: 'Australia/Adelaide', keywords: ['australia', 'acst', 'south australia'] },
  { value: 'Australia/Brisbane', keywords: ['australia', 'aest', 'queensland'] },
  { value: 'Australia/Sydney', keywords: ['australia', 'aest', 'new south wales'] },
  { value: 'Australia/Melbourne', keywords: ['australia', 'victoria'] },

  // Pacific
  { value: 'Pacific/Guam', keywords: ['guam'] },
  { value: 'Pacific/Fiji', keywords: ['fiji'] },
  { value: 'Pacific/Auckland', keywords: ['new zealand', 'nz', 'nzst'] },
  { value: 'Pacific/Samoa', keywords: ['samoa'] },
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
    const label = `${entry.value} (${now.toFormat('h:mm a')})`;
    return { name: label, value: entry.value };
  });
}
