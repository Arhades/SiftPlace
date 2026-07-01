// World cities directory.
// Source: russ666/all-countries-and-cities-json (~84k cities across 152 countries, ~1MB).
// Loaded once and cached in memory, then filtered locally for instant type-ahead.

const CITIES_URL =
  "https://cdn.jsdelivr.net/gh/russ666/all-countries-and-cities-json@master/countries.min.json";

// Country name -> flag emoji. The cities dataset groups cities by country name,
// so we keep this map alongside it to attach a flag to every city.
export const COUNTRY_FLAGS: Record<string, string> = {
  "Afghanistan": "🇦🇫",
  "Albania": "🇦🇱",
  "Algeria": "🇩🇿",
  "Andorra": "🇦🇩",
  "Angola": "🇦🇴",
  "Antigua and Barbuda": "🇦🇬",
  "Argentina": "🇦🇷",
  "Armenia": "🇦🇲",
  "Aruba": "🇦🇼",
  "Australia": "🇦🇺",
  "Austria": "🇦🇹",
  "Azerbaijan": "🇦🇿",
  "Bahamas": "🇧🇸",
  "Bahrain": "🇧🇭",
  "Bangladesh": "🇧🇩",
  "Barbados": "🇧🇧",
  "Belarus": "🇧🇾",
  "Belgium": "🇧🇪",
  "Belize": "🇧🇿",
  "Bolivia": "🇧🇴",
  "Bosnia and Herzegovina": "🇧🇦",
  "Botswana": "🇧🇼",
  "Brazil": "🇧🇷",
  "Brunei": "🇧🇳",
  "Bulgaria": "🇧🇬",
  "Cambodia": "🇰🇭",
  "Cameroon": "🇨🇲",
  "Canada": "🇨🇦",
  "Cayman Islands": "🇰🇾",
  "Chile": "🇨🇱",
  "China": "🇨🇳",
  "Colombia": "🇨🇴",
  "Congo": "🇨🇬",
  "Costa Rica": "🇨🇷",
  "Croatia": "🇭🇷",
  "Cuba": "🇨🇺",
  "Cyprus": "🇨🇾",
  "Czech Republic": "🇨🇿",
  "Denmark": "🇩🇰",
  "Dominican Republic": "🇩🇴",
  "Ecuador": "🇪🇨",
  "Egypt": "🇪🇬",
  "El Salvador": "🇸🇻",
  "Estonia": "🇪🇪",
  "Faroe Islands": "🇫🇴",
  "Finland": "🇫🇮",
  "France": "🇫🇷",
  "French Polynesia": "🇵🇫",
  "Gabon": "🇬🇦",
  "Georgia": "🇬🇪",
  "Germany": "🇩🇪",
  "Ghana": "🇬🇭",
  "Greece": "🇬🇷",
  "Greenland": "🇬🇱",
  "Guadeloupe": "🇬🇵",
  "Guam": "🇬🇺",
  "Guatemala": "🇬🇹",
  "Guinea": "🇬🇳",
  "Haiti": "🇭🇹",
  "Hashemite Kingdom of Jordan": "🇯🇴",
  "Honduras": "🇭🇳",
  "Hong Kong": "🇭🇰",
  "Hungary": "🇭🇺",
  "Iceland": "🇮🇸",
  "India": "🇮🇳",
  "Indonesia": "🇮🇩",
  "Iran": "🇮🇷",
  "Iraq": "🇮🇶",
  "Ireland": "🇮🇪",
  "Isle of Man": "🇮🇲",
  "Israel": "🇮🇱",
  "Italy": "🇮🇹",
  "Jamaica": "🇯🇲",
  "Japan": "🇯🇵",
  "Kazakhstan": "🇰🇿",
  "Kenya": "🇰🇪",
  "Kosovo": "🇽🇰",
  "Kuwait": "🇰🇼",
  "Latvia": "🇱🇻",
  "Lebanon": "🇱🇧",
  "Libya": "🇱🇾",
  "Liechtenstein": "🇱🇮",
  "Luxembourg": "🇱🇺",
  "Macedonia": "🇲🇰",
  "Madagascar": "🇲🇬",
  "Malaysia": "🇲🇾",
  "Malta": "🇲🇹",
  "Martinique": "🇲🇶",
  "Mauritius": "🇲🇺",
  "Mayotte": "🇾🇹",
  "Mexico": "🇲🇽",
  "Mongolia": "🇲🇳",
  "Montenegro": "🇲🇪",
  "Morocco": "🇲🇦",
  "Mozambique": "🇲🇿",
  "Myanmar [Burma]": "🇲🇲",
  "Namibia": "🇳🇦",
  "Nepal": "🇳🇵",
  "Netherlands": "🇳🇱",
  "New Caledonia": "🇳🇨",
  "New Zealand": "🇳🇿",
  "Nicaragua": "🇳🇮",
  "Nigeria": "🇳🇬",
  "Norway": "🇳🇴",
  "Oman": "🇴🇲",
  "Pakistan": "🇵🇰",
  "Palestine": "🇵🇸",
  "Panama": "🇵🇦",
  "Papua New Guinea": "🇵🇬",
  "Paraguay": "🇵🇾",
  "Peru": "🇵🇪",
  "Philippines": "🇵🇭",
  "Poland": "🇵🇱",
  "Portugal": "🇵🇹",
  "Puerto Rico": "🇵🇷",
  "Republic of Korea": "🇰🇷",
  "Republic of Lithuania": "🇱🇹",
  "Republic of Moldova": "🇲🇩",
  "Romania": "🇷🇴",
  "Russia": "🇷🇺",
  "Saint Lucia": "🇱🇨",
  "San Marino": "🇸🇲",
  "Saudi Arabia": "🇸🇦",
  "Senegal": "🇸🇳",
  "Serbia": "🇷🇸",
  "Singapore": "🇸🇬",
  "Slovakia": "🇸🇰",
  "Slovenia": "🇸🇮",
  "South Africa": "🇿🇦",
  "Spain": "🇪🇸",
  "Sri Lanka": "🇱🇰",
  "Sudan": "🇸🇩",
  "Suriname": "🇸🇷",
  "Swaziland": "🇸🇿",
  "Sweden": "🇸🇪",
  "Switzerland": "🇨🇭",
  "Taiwan": "🇹🇼",
  "Tanzania": "🇹🇿",
  "Thailand": "🇹🇭",
  "Trinidad and Tobago": "🇹🇹",
  "Tunisia": "🇹🇳",
  "Turkey": "🇹🇷",
  "U.S. Virgin Islands": "🇻🇮",
  "Ukraine": "🇺🇦",
  "United Arab Emirates": "🇦🇪",
  "United Kingdom": "🇬🇧",
  "United States": "🇺🇸",
  "Uruguay": "🇺🇾",
  "Venezuela": "🇻🇪",
  "Vietnam": "🇻🇳",
  "Zambia": "🇿🇲",
  "Zimbabwe": "🇿🇼",
};

export interface CityEntry {
  city: string;
  country: string;
  flag: string;
  /** "City, Country" — used as the display label. */
  label: string;
}

let citiesPromise: Promise<CityEntry[]> | null = null;

// Lazily fetch + flatten the world cities directory once, caching the promise so
// repeated calls (and re-mounts) reuse the same in-flight/loaded result.
export function loadCities(): Promise<CityEntry[]> {
  if (!citiesPromise) {
    citiesPromise = fetch(CITIES_URL)
      .then((res) => {
        if (!res.ok) throw new Error("Cities directory fetch failed");
        return res.json();
      })
      .then((data: Record<string, string[]>) => {
        const out: CityEntry[] = [];
        const seen = new Set<string>();
        for (const country in data) {
          const flag = COUNTRY_FLAGS[country] || "🌐";
          for (const city of data[country]) {
            const key = `${city}|${country}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ city, country, flag, label: `${city}, ${country}` });
          }
        }
        return out;
      })
      .catch((err) => {
        // Reset so a later attempt can retry instead of caching the failure.
        citiesPromise = null;
        throw err;
      });
  }
  return citiesPromise;
}

// Local substring search, prefix matches first. Fast enough over ~84k entries.
export function searchCities(list: CityEntry[], query: string, limit = 8): CityEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const starts: CityEntry[] = [];
  const contains: CityEntry[] = [];
  for (const entry of list) {
    const c = entry.city.toLowerCase();
    if (c.startsWith(q)) {
      starts.push(entry);
      if (starts.length >= limit) break;
    } else if (contains.length < limit && c.includes(q)) {
      contains.push(entry);
    }
  }
  return [...starts, ...contains].slice(0, limit);
}
