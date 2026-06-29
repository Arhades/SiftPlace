import { getFlagEmoji } from "@/lib/utils";

export interface UniversityPreset {
  name: string;
  flag: string;
  country: string;
}

// Full global university directory (~10k schools, ~2.2MB).
// Source: Hipo/university-domains-list. Loaded once and cached in memory, then
// filtered locally so the search box responds instantly (no per-keystroke fetch).
const UNIVERSITIES_URL =
  "https://cdn.jsdelivr.net/gh/Hipo/university-domains-list@master/world_universities_and_domains.json";

let universitiesPromise: Promise<UniversityPreset[]> | null = null;

export function loadUniversities(): Promise<UniversityPreset[]> {
  if (!universitiesPromise) {
    universitiesPromise = fetch(UNIVERSITIES_URL)
      .then((res) => {
        if (!res.ok) throw new Error("University directory fetch failed");
        return res.json();
      })
      .then((data: any[]) => {
        const seen = new Set<string>();
        const out: UniversityPreset[] = [];
        for (const item of data) {
          const name: string = item.name;
          const country: string = item.country || "";
          const key = `${name}|${item.alpha_two_code}`;
          if (!name || seen.has(key)) continue;
          seen.add(key);
          out.push({ name, country, flag: getFlagEmoji(item.alpha_two_code) });
        }
        return out;
      })
      .catch((err) => {
        universitiesPromise = null;
        throw err;
      });
  }
  return universitiesPromise;
}

// Local substring search, prefix matches first, matching name or country.
export function searchUniversities(
  list: UniversityPreset[],
  query: string,
  limit = 8
): UniversityPreset[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const starts: UniversityPreset[] = [];
  const contains: UniversityPreset[] = [];
  for (const entry of list) {
    const name = entry.name.toLowerCase();
    if (name.startsWith(q)) {
      starts.push(entry);
      if (starts.length >= limit) break;
    } else if (
      contains.length < limit &&
      (name.includes(q) || entry.country.toLowerCase().includes(q))
    ) {
      contains.push(entry);
    }
  }
  return [...starts, ...contains].slice(0, limit);
}

export const UNIVERSITY_PRESETS: UniversityPreset[] = [
  // United States
  { name: "Harvard University", flag: "🇺🇸", country: "United States" },
  { name: "Yale University", flag: "🇺🇸", country: "United States" },
  { name: "Stanford University", flag: "🇺🇸", country: "United States" },
  { name: "Massachusetts Institute of Technology (MIT)", flag: "🇺🇸", country: "United States" },
  { name: "University of California, Berkeley (UC Berkeley)", flag: "🇺🇸", country: "United States" },
  { name: "University of California, Los Angeles (UCLA)", flag: "🇺🇸", country: "United States" },
  { name: "Columbia University", flag: "🇺🇸", country: "United States" },
  { name: "New York University (NYU)", flag: "🇺🇸", country: "United States" },
  { name: "Boston University (BU)", flag: "🇺🇸", country: "United States" },
  { name: "University of Southern California (USC)", flag: "🇺🇸", country: "United States" },
  { name: "Cornell University", flag: "🇺🇸", country: "United States" },
  { name: "Princeton University", flag: "🇺🇸", country: "United States" },
  { name: "University of Chicago", flag: "🇺🇸", country: "United States" },
  { name: "Northwestern University", flag: "🇺🇸", country: "United States" },
  { name: "University of Michigan", flag: "🇺🇸", country: "United States" },
  { name: "University of Pennsylvania (UPenn)", flag: "🇺🇸", country: "United States" },

  // United Kingdom
  { name: "University of Oxford", flag: "🇬🇧", country: "United Kingdom" },
  { name: "University of Cambridge", flag: "🇬🇧", country: "United Kingdom" },
  { name: "London School of Economics (LSE)", flag: "🇬🇧", country: "United Kingdom" },
  { name: "University College London (UCL)", flag: "🇬🇧", country: "United Kingdom" },
  { name: "Imperial College London", flag: "🇬🇧", country: "United Kingdom" },
  { name: "King's College London (KCL)", flag: "🇬🇧", country: "United Kingdom" },
  { name: "University of Edinburgh", flag: "🇬🇧", country: "United Kingdom" },
  { name: "University of Manchester", flag: "🇬🇧", country: "United Kingdom" },
  { name: "University of Warwick", flag: "🇬🇧", country: "United Kingdom" },

  // Europe
  { name: "LMU Munich (Ludwig-Maximilians-Universität)", flag: "🇩🇪", country: "Germany" },
  { name: "Technical University of Munich (TUM)", flag: "🇩🇪", country: "Germany" },
  { name: "Heidelberg University", flag: "🇩🇪", country: "Germany" },
  { name: "ETH Zurich", flag: "🇨🇭", country: "Switzerland" },
  { name: "EPFL (Ecole Polytechnique Fédérale de Lausanne)", flag: "🇨🇭", country: "Switzerland" },
  { name: "HEC Paris", flag: "🇫🇷", country: "France" },
  { name: "ESCP Business School", flag: "🇫🇷", country: "France" },
  { name: "Sorbonne University", flag: "🇫🇷", country: "France" },
  { name: "Sciences Po", flag: "🇫🇷", country: "France" },
  { name: "Bocconi University", flag: "🇮🇹", country: "Italy" },
  { name: "Erasmus University Rotterdam", flag: "🇳🇱", country: "Netherlands" },
  { name: "University of Amsterdam", flag: "🇳🇱", country: "Netherlands" },
  { name: "Copenhagen Business School (CBS)", flag: "🇩🇰", country: "Denmark" },
  { name: "Stockholm School of Economics", flag: "🇸🇪", country: "Sweden" },

  // Singapore & Asia
  { name: "National University of Singapore (NUS)", flag: "🇸🇬", country: "Singapore" },
  { name: "Nanyang Technological University (NTU)", flag: "🇸🇬", country: "Singapore" },
  { name: "Singapore Management University (SMU)", flag: "🇸🇬", country: "Singapore" },
  { name: "University of Hong Kong (HKU)", flag: "🇭🇰", country: "Hong Kong" },
  { name: "Hong Kong University of Science and Technology (HKUST)", flag: "🇭🇰", country: "Hong Kong" },
  { name: "Chinese University of Hong Kong (CUHK)", flag: "🇭🇰", country: "Hong Kong" },
  { name: "Tsinghua University", flag: "🇨🇳", country: "China" },
  { name: "Peking University", flag: "🇨🇳", country: "China" },
  { name: "University of Tokyo", flag: "🇯🇵", country: "Japan" },
  { name: "Kyoto University", flag: "🇯🇵", country: "Japan" },
  { name: "Waseda University", flag: "🇯🇵", country: "Japan" },
  { name: "Keio University", flag: "🇯🇵", country: "Japan" },
  { name: "Seoul National University (SNU)", flag: "🇰🇷", country: "South Korea" },
  { name: "KAIST", flag: "🇰🇷", country: "South Korea" },
  { name: "Yonsei University", flag: "🇰🇷", country: "South Korea" },
  { name: "Korea University", flag: "🇰🇷", country: "South Korea" },

  // Thailand
  { name: "Chulalongkorn University", flag: "🇹🇭", country: "Thailand" },
  { name: "Thammasat University", flag: "🇹🇭", country: "Thailand" },
  { name: "Mahidol University", flag: "🇹🇭", country: "Thailand" },
  { name: "Kasetsart University", flag: "🇹🇭", country: "Thailand" },

  // Australia & New Zealand
  { name: "University of Sydney", flag: "🇦🇺", country: "Australia" },
  { name: "University of Melbourne", flag: "🇦🇺", country: "Australia" },
  { name: "University of New South Wales (UNSW)", flag: "🇦🇺", country: "Australia" },
  { name: "University of Queensland (UQ)", flag: "🇦🇺", country: "Australia" },
  { name: "Australian National University (ANU)", flag: "🇦🇺", country: "Australia" },
  { name: "Monash University", flag: "🇦🇺", country: "Australia" },
  { name: "University of Auckland", flag: "🇳🇿", country: "New Zealand" },

  // Canada
  { name: "University of Toronto", flag: "🇨🇦", country: "Canada" },
  { name: "McGill University", flag: "🇨🇦", country: "Canada" },
  { name: "University of British Columbia (UBC)", flag: "🇨🇦", country: "Canada" },
  { name: "University of Waterloo", flag: "🇨🇦", country: "Canada" }
].sort((a, b) => a.name.localeCompare(b.name));
