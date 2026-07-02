import { useState } from "react";
import { Mail } from "lucide-react";
import type { ListingResult } from "@/lib/api";
import { fmtMoney } from "@/lib/currency";
import { osmLink } from "@/lib/fare";
import { cn } from "@/lib/utils";
import { ResultCard } from "./ResultCard";
import { CompareTable } from "./CompareTable";

/** Compose the shortlist as a mailto: link — a soft, skippable lead capture
 * that needs no account and no backend (the user's own mail app sends it). */
function shortlistMailto(email: string, items: ListingResult[], currency: string): string {
  const lines = items.map((r) => {
    const price = r.price_known && r.true_cost != null
      ? `${fmtMoney(r.true_cost, currency)}/mo all-in`
      : "price on request";
    return `• ${r.name} — ${r.score}% match, ${price}, ~${r.commute_min} min commute\n  ${osmLink(r.lat, r.lon)}`;
  });
  const body =
    `My SiftPlace shortlist (${items.length} places):\n\n${lines.join("\n\n")}\n\n` +
    `Found with SiftPlace — ranked by true monthly cost (rent + commute fare).`;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
    "My SiftPlace shortlist",
  )}&body=${encodeURIComponent(body)}`;
}

export function Saved({
  items,
  onToggleSave,
  currency = "THB",
}: {
  items: ListingResult[];
  onToggleSave: (listing: ListingResult) => void;
  currency?: string;
}) {
  const [comparing, setComparing] = useState(false);
  const [email, setEmail] = useState("");
  const canCompare = items.length >= 2;
  const showTable = comparing && canCompare;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (items.length === 0) {
    return (
      <div className="text-center py-20 px-6 animate-sift-fade">
        <div className="text-5xl mb-4">💛</div>
        <h3 className="text-lg font-bold text-ink mb-1">No saved places yet</h3>
        <p className="text-sm text-muted max-w-xs mx-auto font-medium">
          Tap the heart on any listing and it'll wait for you here — then compare your shortlist
          side by side.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-sift-fade">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted font-medium">
          {items.length} saved {items.length === 1 ? "place" : "places"}
        </p>
        {canCompare && (
          <button
            type="button"
            onClick={() => setComparing((c) => !c)}
            className={cn(
              "px-3.5 py-2 rounded-full text-xs font-bold transition cursor-pointer active:scale-[0.97]",
              showTable
                ? "border-2 border-line text-muted hover:bg-surface-c"
                : "sf-cta",
            )}
          >
            {showTable ? "← Back to list" : "Compare Listings"}
          </button>
        )}
      </div>

      {showTable ? (
        <CompareTable items={items} />
      ) : (
        <div className="space-y-4">
          {items.map((r, i) => (
            <ResultCard
              key={r.name + i}
              r={r}
              isTop={false}
              saved
              currency={currency}
              onToggleSave={onToggleSave}
            />
          ))}
        </div>
      )}

      {/* soft, skippable — no account needed to use anything */}
      <div className="sf-well p-4">
        <p className="text-xs font-bold text-ink mb-1 flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5" /> Email me my shortlist{" "}
          <span className="font-medium text-muted">(optional)</span>
        </p>
        <p className="text-[11px] text-muted font-medium mb-2">
          Send this list to yourself — handy when you start messaging landlords. No account, ever.
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            className="sf-field min-w-0"
            placeholder="you@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <a
            href={emailOk ? shortlistMailto(email, items, currency) : undefined}
            aria-disabled={!emailOk}
            className={cn(
              "sf-cta shrink-0 inline-flex items-center px-4 py-2 text-xs",
              !emailOk && "opacity-55 pointer-events-none",
            )}
          >
            Send
          </a>
        </div>
      </div>
    </div>
  );
}
