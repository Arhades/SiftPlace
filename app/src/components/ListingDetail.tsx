import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, Eye, Heart, Map as MapIcon, MapPin, X } from "lucide-react";
import type { Community, ListingResult } from "@/lib/api";
import { sendFeedback } from "@/lib/api";
import { bumpViews, communityEnabled, listingKey } from "@/lib/community";
import { fmtMoney } from "@/lib/currency";
import { MODE_LABEL, fmtHours, osmLink } from "@/lib/fare";
import { cn } from "@/lib/utils";
import { ListingComments } from "./ListingComments";

// Click-into-a-listing detail panel: the community home of a listing —
// how many students viewed it, the 👍/👎 accuracy rating (+ scam report),
// and the shared student comments — on top of a compact cost recap.

export function ListingDetail({
  r,
  currency,
  saved,
  onToggleSave,
  community,
  onCommunity,
  onClose,
}: {
  r: ListingResult;
  currency: string;
  saved: boolean;
  onToggleSave: (listing: ListingResult) => void;
  /** Live vote aggregate — owned by the card so its ⚠️ chip stays in sync. */
  community: Community | null;
  onCommunity: (c: Community) => void;
  onClose: () => void;
}) {
  const meta = [r.area, r.type].filter(Boolean).join(" · ");
  const canVote = r.lat != null && r.lon != null && r.source !== "featured";

  const [voted, setVoted] = useState<"up" | "down" | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState("");

  // view counter (Supabase) — counted once per session, read on re-opens
  const [views, setViews] = useState<number | null>(null);
  useEffect(() => {
    if (!communityEnabled || r.lat == null || r.lon == null) return;
    let active = true;
    bumpViews(listingKey(r.name, r.lat, r.lon)).then((n) => {
      if (active) setViews(n);
    });
    return () => {
      active = false;
    };
  }, [r.name, r.lat, r.lon]);

  // close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const vote = (accurate: boolean) => {
    if (r.lat == null || r.lon == null) return;
    setVoted(accurate ? "up" : "down");
    setReportOpen(!accurate);
    sendFeedback({ name: r.name, lat: r.lat, lon: r.lon }, accurate)
      .then((res) => onCommunity(res.community))
      .catch(() => {});
  };

  const submitReport = () => {
    if (r.lat == null || r.lon == null || !report.trim()) return;
    sendFeedback({ name: r.name, lat: r.lat, lon: r.lon }, false, report.trim())
      .then((res) => onCommunity(res.community))
      .catch(() => {});
    setReportOpen(false);
    setReport("");
  };

  // portal to <body>: the card's fade animation makes it a containing block
  // for position:fixed, which would trap the overlay inside the card
  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${r.name} details`}
    >
      <div
        className="sf-card w-full sm:max-w-lg max-h-[92vh] sm:max-h-[85vh] overflow-y-auto rounded-b-none sm:rounded-b-3xl p-5 animate-sift-fade"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-ink leading-tight">
              {r.name}
              {r.stars != null && r.stars > 0 && (
                <span className="ml-1.5 text-xs font-bold text-primary-dim align-middle">
                  {"★".repeat(Math.max(1, Math.min(5, Math.round(r.stars))))}
                </span>
              )}
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted font-medium">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {meta}
                {meta ? " · " : ""}~{r.commute_min} min each way
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onToggleSave(r)}
              aria-label={saved ? "Remove from saved" : "Save"}
              className={cn(
                "h-9 w-9 rounded-full border-2 flex items-center justify-center transition cursor-pointer",
                saved
                  ? "bg-secondary/20 border-secondary/50 text-secondary"
                  : "bg-lowest border-line text-muted hover:text-ink",
              )}
            >
              <Heart className={cn("h-4 w-4", saved && "fill-secondary")} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close details"
              className="h-9 w-9 rounded-full border-2 border-line bg-lowest text-muted hover:text-ink flex items-center justify-center cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* community stats strip: views + 👍/👎 aggregate */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {views != null && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-c text-ink text-xs font-bold">
              <Eye className="h-3.5 w-3.5" /> {views.toLocaleString("en-US")} student
              {views === 1 ? "" : "s"} viewed this place
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ok-soft text-ok text-xs font-bold">
            👍 {community?.up ?? 0}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-error-soft text-error text-xs font-bold">
            👎 {community?.down ?? 0}
          </span>
          {community?.flagged && (
            <span className="px-3 py-1.5 rounded-full bg-error-soft text-error text-xs font-bold">
              ⚠️ Accuracy under review
            </span>
          )}
        </div>

        {/* cost recap */}
        <div className="mt-4 rounded-2xl bg-surface-low border border-line p-4">
          {r.price_known && r.true_cost != null ? (
            <>
              <div className="text-xl font-bold text-ink">
                {fmtMoney(r.true_cost, currency)}{" "}
                <span className="text-xs font-semibold text-muted">/mo all-in</span>
              </div>
              <div className="mt-0.5 text-xs text-muted font-medium">
                {fmtMoney(r.rent, currency)} rent + ~{fmtMoney(r.monthly_fare, currency)}{" "}
                {MODE_LABEL[r.mode]}
              </div>
            </>
          ) : (
            <div className="text-sm font-bold text-ink">
              Price on request · + ~{fmtMoney(r.monthly_fare, currency)} {MODE_LABEL[r.mode]} fare
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted font-medium">
              <Clock className="h-3.5 w-3.5 shrink-0" />~{fmtHours(r.monthly_hours)}/mo on the road
            </span>
            <a
              href={osmLink(r.lat, r.lon)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-secondary-dim hover:text-secondary"
            >
              <MapIcon className="h-3.5 w-3.5" /> View on map
            </a>
          </div>
        </div>

        {/* was this listing accurate? */}
        {canVote && (
          <div className="mt-4 rounded-2xl border border-line p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Was this listing accurate?
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                aria-label="Listing was accurate"
                onClick={() => vote(true)}
                disabled={voted !== null}
                className={cn(
                  "px-4 py-2 rounded-full border-2 text-sm transition cursor-pointer disabled:cursor-default",
                  voted === "up"
                    ? "bg-ok-soft border-ok/40 text-ok font-bold"
                    : "border-line hover:bg-surface-c",
                )}
              >
                👍 Accurate
              </button>
              <button
                type="button"
                aria-label="Listing was inaccurate"
                onClick={() => vote(false)}
                disabled={voted !== null}
                className={cn(
                  "px-4 py-2 rounded-full border-2 text-sm transition cursor-pointer disabled:cursor-default",
                  voted === "down"
                    ? "bg-error-soft border-error/40 text-error font-bold"
                    : "border-line hover:bg-surface-c",
                )}
              >
                👎 Off / suspicious
              </button>
            </div>
            {reportOpen && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  className="sf-field flex-1 min-w-0 text-xs"
                  placeholder="What was wrong? (optional — helps us catch scams)"
                  value={report}
                  maxLength={500}
                  onChange={(e) => setReport(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitReport();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={submitReport}
                  disabled={!report.trim()}
                  className="px-3 py-2 rounded-full border-2 border-line text-[11px] font-bold text-muted hover:bg-surface-c cursor-pointer disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            )}
            {voted === "up" && (
              <p className="mt-2 text-[11px] text-ok font-semibold">Thanks — logged! 💛</p>
            )}
          </div>
        )}

        {/* community comments — always open in the detail view */}
        <div className="mt-4">
          <ListingComments r={r} variant="detail" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
