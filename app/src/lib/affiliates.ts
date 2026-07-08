// Travelpayouts affiliate vendor catalogue for the pre-departure checklist.
//
// How the commission works: every Travelpayouts partner link is a tp.media
// redirect that carries OUR account `marker`. When a student clicks through,
// the partner drops an attribution cookie (typically 30 days) and any purchase
// they complete — eSIM, insurance, flight — is credited to the marker. No user
// account or login needed on our side.
//
// ── HOW IT SHOWS UP ─────────────────────────────────────────────────────────
// The Guide tab shows ONE button per category ("Get a Thailand eSIM →").
// Clicking it opens a popup listing EVERY vendor in that category, so the
// student compares and picks — we never funnel them to a single site.
//
// ── HOW TO ADD / REMOVE A VENDOR ────────────────────────────────────────────
// Edit CATALOGUE below. One vendor = one object in a category's `offers` list:
//
//   { name: "Airalo", blurb: "eSIM in 200+ countries", url: "https://…",
//     tpLink: "https://tp.media/r?…" },   // ← paste from the TP link generator
//
// To add: append an object. To remove: delete it. Nothing else to touch.
// To make a vendor commission-tracked, EITHER paste the whole generated link
// from the Travelpayouts dashboard (Tools → Link generator) into `tpLink`
// (easiest), OR set `programId` + `campaignId` from that same page and put
// your marker in .env (VITE_TP_MARKER, optional VITE_TP_TRS). Until one of
// those is done the vendor's plain site is used — still useful, not credited.

const MARKER = ((import.meta.env.VITE_TP_MARKER as string | undefined) ?? "").trim();
const TRS = ((import.meta.env.VITE_TP_TRS as string | undefined) ?? "").trim();

interface OfferDef {
  /** Vendor name shown in the popup. */
  name: string;
  /** One line on what makes this option worth a look. */
  blurb: string;
  /** Vendor landing page — the deep-link target and the no-marker fallback. */
  url: string;
  /** Option (a): the full generated link from the Travelpayouts link generator. */
  tpLink?: string;
  /** Option (b): program id (`p`) + campaign id from the same page. */
  programId?: number;
  campaignId?: number;
}

interface CategoryDef {
  /** Text on the single checklist button that opens the popup. */
  button: string;
  /** Popup heading. */
  title: string;
  offers: OfferDef[];
}

// The vendor catalogue. Suggested partners are pre-filled — confirm each is
// active in YOUR Travelpayouts account and paste its tpLink to start earning.
const CATALOGUE = {
  esim: {
    button: "Get a Thailand eSIM →",
    title: "eSIM options — land already online",
    offers: [
      { name: "Airalo", blurb: "Biggest eSIM store; dedicated Thailand packages", url: "https://airalo.tpx.lu/bIt4bHDb" },
      { name: "Yesim", blurb: "App-based eSIM with unlimited-data plans", url: "https://yesim.tpx.lu/CDlGBOo7" },
      { name: "Drimsim", blurb: "One universal SIM/eSIM, pay-as-you-go across countries", url: "https://drimsim.tpx.lu/fd5pPQkF" },
	  { name: "GigSky", blurb: "eSIM coverage in 200+ countries; subscription plans for frequent travelers", url: "https://klook.tpx.lu/fy5gCsOE" },
    ],
  },
  insurance: {
    button: "Compare travel insurance →",
    title: "Travel-insurance options",
    offers: [
      { name: "EKTA", blurb: "Travel insurance with student-friendly long-stay plans", url: "https://ektatraveling.tpx.lu/zyZHesRq" },
    ],
  },
  flights: {
    button: "Track flight prices →",
    title: "Flight search & price tracking",
    offers: [
      { name: "Aviasales", blurb: "Meta-search with price alerts", url: "https://aviasales.tpx.lu/QawDd2Rk" },
    ],
  },
} satisfies Record<string, CategoryDef>;

export type AffiliateCategory = keyof typeof CATALOGUE;

export interface AffiliateOffer {
  name: string;
  blurb: string;
  href: string;
  /** True when the click is commission-tracked. */
  sponsored: boolean;
}

export interface AffiliateGroup {
  button: string;
  title: string;
  offers: AffiliateOffer[];
}

/** Travelpayouts redirect hosts — links on these are commission-tracked even
 *  when pasted into `url` instead of `tpLink`. */
const TRACKED_HOSTS = /https:\/\/([\w-]+\.)?(tp\.media|tpx\.lu|tp\.st)\//i;

function resolve(o: OfferDef): AffiliateOffer {
  if (o.tpLink) return { name: o.name, blurb: o.blurb, href: o.tpLink, sponsored: true };
  if (TRACKED_HOSTS.test(o.url)) {
    return { name: o.name, blurb: o.blurb, href: o.url, sponsored: true };
  }
  if (MARKER && o.programId && o.campaignId) {
    const params = new URLSearchParams({
      marker: MARKER,
      p: String(o.programId),
      campaign_id: String(o.campaignId),
      u: o.url,
    });
    if (TRS) params.set("trs", TRS);
    return {
      name: o.name,
      blurb: o.blurb,
      href: `https://tp.media/r?${params.toString()}`,
      sponsored: true,
    };
  }
  return { name: o.name, blurb: o.blurb, href: o.url, sponsored: false };
}

/** Resolved vendor groups per checklist category (what the Guide renders). */
export const AFFILIATE_GROUPS: Record<AffiliateCategory, AffiliateGroup> = Object.fromEntries(
  (Object.keys(CATALOGUE) as AffiliateCategory[]).map((k) => [
    k,
    {
      button: CATALOGUE[k].button,
      title: CATALOGUE[k].title,
      offers: CATALOGUE[k].offers.map(resolve),
    },
  ]),
) as Record<AffiliateCategory, AffiliateGroup>;
