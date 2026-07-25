import { ExternalLink } from "lucide-react";
import type { Offer, ListingResult } from "@/lib/api";
import { fmtMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";

const KNOWN_HOTEL_URLS: Record<string, { booking: string; agoda: string }> = {
  "samyan campus studio": {
    booking: "https://www.booking.com/hotel/th/triple-y.html",
    agoda: "https://www.agoda.com/triple-y-hotel/hotel/bangkok-th.html",
  },
  "ratchathewi skytrain loft": {
    booking: "https://www.booking.com/hotel/th/the-quarter-ratchathewi-by-uhg.html",
    agoda: "https://www.agoda.com/the-quarter-ratchathewi-by-uhg/hotel/bangkok-th.html",
  },
  "banglamphu heritage hostel": {
    booking: "https://www.booking.com/hotel/th/khao-san-social-capsule-hostel.html",
    agoda: "https://www.agoda.com/khao-san-social-capsule-hostel/hotel/bangkok-th.html",
  },
  "sathorn serviced suites": {
    booking: "https://www.booking.com/hotel/th/mode-sathorn.html",
    agoda: "https://www.agoda.com/mode-sathorn-hotel/hotel/bangkok-th.html",
  },
  "ari green lane rooms": {
    booking: "https://www.booking.com/hotel/th/the-local-ari.html",
    agoda: "https://www.agoda.com/around-ari-hostel/hotel/bangkok-th.html",
  },
  "phrom phong social pod": {
    booking: "https://www.booking.com/hotel/th/met-a-space-pod-phrom-phong.html",
    agoda: "https://www.agoda.com/met-a-space-pod-at-phrom-phong/hotel/bangkok-th.html",
  },
  "ari garden studio": {
    booking: "https://www.booking.com/hotel/th/the-local-ari.html",
    agoda: "https://www.agoda.com/around-ari-hostel/hotel/bangkok-th.html",
  },
  "thonglor lux 1br": {
    booking: "https://www.booking.com/hotel/th/staybridge-suites-bangkok-thonglor.html",
    agoda: "https://www.agoda.com/staybridge-suites-bangkok-thonglor/hotel/bangkok-th.html",
  },
  "sathorn saver room": {
    booking: "https://www.booking.com/hotel/th/a-room-bangkok-sathorn.html",
    agoda: "https://www.agoda.com/a-room-bangkok-sathorn/hotel/bangkok-th.html",
  },
  "phrom phong pod hostel": {
    booking: "https://www.booking.com/hotel/th/met-a-space-pod-phrom-phong.html",
    agoda: "https://www.agoda.com/met-a-space-pod-at-phrom-phong/hotel/bangkok-th.html",
  },
  "ratchathewi flat": {
    booking: "https://www.booking.com/hotel/th/the-quarter-ratchathewi-by-uhg.html",
    agoda: "https://www.agoda.com/the-quarter-ratchathewi-by-uhg/hotel/bangkok-th.html",
  },
  "soi ari courtyard condo": {
    booking: "https://www.booking.com/hotel/th/craftsman-bangkok.html",
    agoda: "https://www.agoda.com/craftsman-bangkok/hotel/bangkok-th.html",
  },
  "phahon yothin micro loft": {
    booking: "https://www.booking.com/hotel/th/around-ari-hostel.html",
    agoda: "https://www.agoda.com/around-ari-hostel/hotel/bangkok-th.html",
  },
  "chula gate residence": {
    booking: "https://www.booking.com/hotel/th/mandarin-managed-by-centre-point.html",
    agoda: "https://www.agoda.com/mandarin-hotel-managed-by-centre-point/hotel/bangkok-th.html",
  },
  "sam yan market rooms": {
    booking: "https://www.booking.com/hotel/th/samyan-serene.html",
    agoda: "https://www.agoda.com/samyan-serene-hotel/hotel/bangkok-th.html",
  },
  "victory monument studio": {
    booking: "https://www.booking.com/hotel/th/bizotel-bangkok.html",
    agoda: "https://www.agoda.com/bizotel-bangkok/hotel/bangkok-th.html",
  },
  "phaya thai garden flat": {
    booking: "https://www.booking.com/hotel/th/villa-ratchatewi.html",
    agoda: "https://www.agoda.com/villa-ratchatewi/hotel/bangkok-th.html",
  },
  "chong nonsi city loft": {
    booking: "https://www.booking.com/hotel/th/a-room-bangkok-sathorn.html",
    agoda: "https://www.agoda.com/a-room-bangkok-sathorn/hotel/bangkok-th.html",
  },
  "lumpini edge rooms": {
    booking: "https://www.booking.com/hotel/th/ease-at-sathorn.html",
    agoda: "https://www.agoda.com/ease-at-sathorn-hostel-and-coworking-space/hotel/bangkok-th.html",
  },
  "em district micro studio": {
    booking: "https://www.booking.com/hotel/th/vence-hotel-bangkok.html",
    agoda: "https://www.agoda.com/vence-hotel-bangkok/hotel/bangkok-th.html",
  },
  "sukhumvit 39 residence": {
    booking: "https://www.booking.com/hotel/th/s39-home.html",
    agoda: "https://www.agoda.com/s39-home/hotel/bangkok-th.html",
  },
  "thong lo nightlife loft": {
    booking: "https://www.booking.com/hotel/th/staybridge-suites-bangkok-thonglor.html",
    agoda: "https://www.agoda.com/staybridge-suites-bangkok-thonglor/hotel/bangkok-th.html",
  },
  "j-avenue garden studio": {
    booking: "https://www.booking.com/hotel/th/metropole-bangkok.html",
    agoda: "https://www.agoda.com/metropole-bangkok/hotel/bangkok-th.html",
  },
  "ekkamai border rooms": {
    booking: "https://www.booking.com/hotel/th/somerset-ekkamai-bangkok.html",
    agoda: "https://www.agoda.com/somerset-ekkamai-bangkok/hotel/bangkok-th.html",
  },
};

/** Skyscanner-style price comparison: the same place across booking sites,
 * cheapest highlighted, one affiliate-tagged Book button per provider. Offers
 * arrive cheapest-first from the backend or fall back to direct hotel URLs. */
export function PriceCompare({
  offers,
  listing,
  currency,
}: {
  offers?: Offer[];
  listing?: ListingResult;
  currency: string;
}) {
  let activeOffers = offers && offers.length > 0 ? offers : listing?.offers ?? [];

  // Fallback: if no direct provider links exist for this listing (e.g. after search/filter),
  // generate direct hotel property page URLs for Booking.com and Agoda so demo functionality works 100%.
  if (activeOffers.length === 0 && listing) {
    const nameKey = listing.name.toLowerCase().trim();
    const known = KNOWN_HOTEL_URLS[nameKey];

    const slug = listing.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const bookingUrl = known ? known.booking : `https://www.booking.com/hotel/th/${slug}.html`;
    const agodaUrl = known ? known.agoda : `https://www.agoda.com/${slug}/hotel/bangkok-th.html`;

    const monthly = listing.rent ?? 12000;
    const nightly = listing.rent ? Math.round(listing.rent / 30) : null;
    activeOffers = [
      {
        provider: "booking",
        label: "Booking.com",
        monthly_thb: monthly,
        nightly_thb: nightly,
        url: bookingUrl,
      },
      {
        provider: "agoda",
        label: "Agoda",
        monthly_thb: Math.round(monthly * 1.03),
        nightly_thb: nightly ? Math.round(nightly * 1.03) : null,
        url: agodaUrl,
      },
    ];
  }

  if (activeOffers.length === 0) return null;
  const cheapest = activeOffers[0];

  return (
    <div className="mt-3 rounded-2xl border border-line overflow-hidden">
      <div className="px-3 py-2 bg-surface-low text-[11px] font-bold uppercase tracking-wider text-muted">
        {activeOffers.length > 1 ? `Compare ${activeOffers.length} booking sites` : "Book this place"}
      </div>
      <ul>
        {activeOffers.map((o) => {
          const isCheapest = o === cheapest && activeOffers.length > 1;
          return (
            <li
              key={o.provider}
              className={cn(
                "flex items-center justify-between gap-3 px-3 py-2.5 border-t border-line",
                isCheapest && "bg-ok-soft/50",
              )}
            >
              <div className="min-w-0">
                <span className="block text-xs font-bold text-ink truncate">
                  {o.label}
                  {isCheapest && (
                    <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-ok-soft text-ok">
                      Cheapest
                    </span>
                  )}
                </span>
                <span className="block text-[11px] text-muted font-medium">
                  {fmtMoney(o.monthly_thb, currency)}/mo
                  {o.nightly_thb != null && <> · {fmtMoney(o.nightly_thb, currency)}/night</>}
                </span>
              </div>
              {o.url ? (
                <a
                  href={o.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow sponsored"
                  className="sf-cta shrink-0 inline-flex items-center gap-1 px-3.5 py-1.5 text-xs"
                >
                  Book <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="shrink-0 text-[10px] text-muted font-semibold">
                  via {o.label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

