import { ExternalLink } from "lucide-react";
import type { Offer } from "@/lib/api";
import { fmtMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";

/** Skyscanner-style price comparison: the same place across booking sites,
 * cheapest highlighted, one affiliate-tagged Book button per provider. Offers
 * arrive cheapest-first from the backend. */
export function PriceCompare({ offers, currency }: { offers: Offer[]; currency: string }) {
  if (offers.length === 0) return null;
  const cheapest = offers[0];

  return (
    <div className="mt-3 rounded-2xl border border-line overflow-hidden">
      <div className="px-3 py-2 bg-surface-low text-[11px] font-bold uppercase tracking-wider text-muted">
        {offers.length > 1 ? `Compare ${offers.length} booking sites` : "Book this place"}
      </div>
      <ul>
        {offers.map((o) => {
          const isCheapest = o === cheapest && offers.length > 1;
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
