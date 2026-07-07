// Static option lists + demo content for the SiftPlace app.
// The chip values match the backend's expected keys (see backend/osm.py TAGS,
// scoring.py, and models.py).

import type { CommuteMode } from "@/lib/api";

export interface Option {
  value: string;
  label: string;
}

export const NEARBY_OPTIONS: Option[] = [
  { value: "gym", label: "🥊 Gym / dojo" },
  { value: "supermarket", label: "🛒 Supermarket" },
  { value: "transit", label: "🚆 Train / metro" },
  { value: "mall", label: "🛍️ Mall" },
  { value: "flea_market", label: "🎏 Flea market" },
];

export const VIBE_OPTIONS: Option[] = [
  { value: "", label: "Either is fine" },
  { value: "quiet", label: "🌿 Quiet" },
  { value: "lively", label: "✨ Lively" },
];

export const TYPE_OPTIONS: Option[] = [
  { value: "condo", label: "Condo / apt" },
  { value: "hostel", label: "Hostel" },
  { value: "hotel", label: "Serviced hotel" },
];

export const AMENITY_OPTIONS: Option[] = [
  { value: "wifi", label: "Fast wifi" },
  { value: "desk", label: "Study desk" },
  { value: "kitchen", label: "Kitchen" },
  { value: "laundry", label: "Laundry" },
  { value: "gympool", label: "Building gym/pool" },
];

// Lease-length filter values match backend search.py / models.py.
export const LEASE_OPTIONS: Option[] = [
  { value: "standard", label: "📜 Standard 12 mo" },
  { value: "short_term", label: "🗓️ Short-term 3–6 mo" },
  { value: "monthly", label: "🔄 Monthly rolling" },
];

export interface ModeOption {
  value: CommuteMode;
  label: string;
  hint: string;
  icon: string;
}

export const MODE_OPTIONS: ModeOption[] = [
  { value: "car", label: "Private-hire car", hint: "Comfier, pricier", icon: "🚗" },
  { value: "bike", label: "Motorbike taxi", hint: "Cheaper, faster in traffic", icon: "🛵" },
  { value: "transit", label: "Public transport", hint: "BTS / MRT / bus", icon: "🚆" },
  { value: "walk", label: "Walk", hint: "Free — best kept close", icon: "🚶" },
];

export interface MaxCommuteOption {
  value: number;
  label: string;
}

export const MAX_COMMUTE_OPTIONS: MaxCommuteOption[] = [
  { value: 0, label: "No limit" },
  { value: 20, label: "Under 20 min" },
  { value: 40, label: "Under 40 min" },
  { value: 60, label: "Under 60 min" },
];

// ---- Demo content (clearly sample data; not from the live API) ----

export interface AreaCard {
  name: string;
  emoji: string;
  vibe: string;
  safety: number; // out of 10
  rent: number;
  good: string;
}

export const AREAS: AreaCard[] = [
  { name: "Ari", emoji: "🌿", vibe: "Quiet & leafy", safety: 8, rent: 16000, good: "Cafés · young pros" },
  { name: "Samyan", emoji: "📚", vibe: "Campus core", safety: 8, rent: 14000, good: "Next to campus" },
  { name: "Ratchathewi", emoji: "🎓", vibe: "Student-friendly", safety: 6, rent: 15000, good: "Walk to centre" },
  { name: "Sathorn", emoji: "🏙️", vibe: "Business calm", safety: 8, rent: 11000, good: "CBD · metro" },
  { name: "Phrom Phong", emoji: "🛍️", vibe: "Central & social", safety: 8, rent: 8000, good: "Malls · hostels" },
  { name: "Thong Lo", emoji: "✨", vibe: "Lively nightlife", safety: 10, rent: 32000, good: "Expats · dining" },
];

export interface GuideItem {
  icon: string;
  q: string;
  a: string;
}

export const GUIDE: GuideItem[] = [
  { icon: "👀", q: "Never pay a deposit before viewing", a: "If a landlord pushes for a wire transfer before you've seen the unit (or done a video walkthrough), walk away. This is the #1 scam in student housing groups." },
  { icon: "🪪", q: "Verify the landlord actually owns it", a: "Ask for the title deed (proof of ownership) and the owner's ID, then check the names match. Sub-letting scams are common around campuses." },
  { icon: "📄", q: "Always get a written contract", a: "Insist on a signed lease stating rent, deposit, term and what's included. Keep a copy. Verbal-only deals leave you with no protection." },
  { icon: "🌧️", q: "Check if the street floods", a: "Some streets flood badly in the rainy season. Ask in the city's subreddit/forum or look for water-line marks on ground-floor walls before committing." },
  { icon: "📆", q: "Know the short-stay lease gap", a: "Many landlords want 1-year leases and short-term rentals are often restricted under 30 days. Target serviced apartments and monthly rentals — the student sweet spot." },
  { icon: "🚩", q: "Too cheap is a red flag", a: "A listing far below the area average usually means hidden costs, a bad location, or a fake. Compare against the 'Avg rent' in the Areas tab first." },
];

// Pre-departure checklist — static "before you move" content for the Guide tab.
export const PRE_DEPARTURE: GuideItem[] = [
  { icon: "🛂", q: "Sort your visa before you book", a: "Check your visa class allows your stay length and confirm whether the landlord needs to file a TM30 residence report for you. Many monthly rentals ask for your passport + visa page — have scans ready. Always confirm visa requirements with the landlord." },
  { icon: "💰", q: "Budget the move-in lump sum", a: "Expect 1–2 months' deposit plus the first month up front — often cash or Thai bank transfer. Carry enough accessible funds for it; foreign cards sometimes can't pay deposits." },
  { icon: "📶", q: "Get a SIM / eSIM on day one", a: "AIS, True and dtac sell tourist and student packages at the airport and in every mall. You'll need data immediately — for Grab, maps, and contacting landlords." },
  { icon: "⚡", q: "Ask how utilities are billed", a: "Government electricity rate is ~4-5 THB/unit; many apartments charge 7-8. Ask BEFORE signing — aircon on the padded rate can add thousands per month. Water and internet are usually flat." },
  { icon: "🏦", q: "Plan how you'll pay rent monthly", a: "International transfers are slow and pricey. Wise/Revolut work for most; long stays may justify a Thai bank account (needs passport + proof of address, sometimes visa class)." },
  { icon: "🏥", q: "Insurance + a copy of everything", a: "Confirm your health insurance covers Thailand (many exchange programmes require it). Keep cloud copies of passport, visa, lease, and deposit receipts." },
  { icon: "🧳", q: "Pack for the season you land in", a: "Light clothes year-round, one layer for malls' aircon, and a rain layer if you arrive May–Oct. Most things are cheaper to buy there than to overweight your luggage." },
];
