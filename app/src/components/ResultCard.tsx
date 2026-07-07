import { useState } from "react";
import { MapPin, Clock, Heart, Map as MapIcon, ChevronDown, Wallet } from "lucide-react";
import type { Badge, Community, ListingResult } from "@/lib/api";
import { sendFeedback } from "@/lib/api";
import { fmtMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import {
  COMMUTE_LEVEL_TEXT,
  MODE_LABEL,
  MODE_SHORT,
  commuteLevel,
  fmtHours,
  osmLink,
  otherMode,
} from "@/lib/fare";
import { PriceCompare } from "./PriceCompare";

const LEVEL_STYLE: Record<"low" | "moderate" | "high", string> = {
  low: "bg-ok-soft text-ok",
  moderate: "bg-warn-soft text-warn",
  high: "bg-error-soft text-error",
};

// Spread badges — the ranked list is guaranteed to include these trade-off picks.
const BADGE_META: Record<Badge, { label: string; cls: string } | null> = {
  top_match: null, // rendered as the existing "Top pick" chip via isTop
  best_value: { label: "💸 Best value further out", cls: "bg-tertiary-c text-on-tertiary" },
  best_quality: { label: "✨ Best quality", cls: "bg-secondary/20 text-secondary-dim" },
};

const LEASE_LABEL: Record<string, string> = {
  standard: "📜 12-mo lease",
  short_term: "🗓️ 3–6 mo lease",
  monthly: "🔄 monthly rolling",
};

const SUBSCORE_META: { key: "cost" | "location" | "living"; label: string }[] = [
  { key: "cost", label: "Cost" },
  { key: "location", label: "Location" },
  { key: "living", label: "Living" },
];

export function ResultCard({
  r,
  isTop,
  saved,
  currency = "THB",
  onToggleSave,
}: {
  r: ListingResult;
  isTop: boolean;
  saved: boolean;
  currency?: string;
  onToggleSave: (listing: ListingResult) => void;
}) {
  const mode = r.mode;
  const other = otherMode(mode);
  const otherFare = r.fares[other];
  const level = commuteLevel(r.monthly_fare);
  const meta = [r.area, r.type].filter(Boolean).join(" · ");

  const [colOpen, setColOpen] = useState(false);
  const col = r.cost_of_living;

  // community accuracy feedback (one vote per visitor per listing, server-side)
  const [community, setCommunity] = useState<Community | null>(r.community);
  const [voted, setVoted] = useState<"up" | "down" | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState("");
  const canVote = r.lat != null && r.lon != null && r.source !== "featured";

  const vote = (accurate: boolean) => {
    if (r.lat == null || r.lon == null) return;
    setVoted(accurate ? "up" : "down");
    setReportOpen(!accurate);
    sendFeedback({ name: r.name, lat: r.lat, lon: r.lon }, accurate)
      .then((res) => setCommunity(res.community))
      .catch(() => {});
  };

  const submitReport = () => {
    if (r.lat == null || r.lon == null || !report.trim()) return;
    sendFeedback({ name: r.name, lat: r.lat, lon: r.lon }, false, report.trim())
      .then((res) => setCommunity(res.community))
      .catch(() => {});
    setReportOpen(false);
    setReport("");
  };

  return (
    <article
      className={cn(
        "sf-card p-5 animate-sift-fade",
        isTop
          ? "border-primary/60 shadow-[0_14px_34px_-14px_rgba(255,193,7,0.55)]"
          : "",
      )}
    >
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-ink text-surface text-xs font-bold">
            ★ {r.score}% match
          </span>
          {isTop ? (
            <span className="px-2.5 py-1 rounded-full bg-primary text-on-primary text-[11px] font-bold">
              ⭐ Top pick
            </span>
          ) : r.score >= 80 ? (
            <span className="px-2.5 py-1 rounded-full bg-ok-soft text-ok text-[11px] font-bold">
              Great fit
            </span>
          ) : null}
          {r.badge && BADGE_META[r.badge] && (
            <span
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-bold",
                BADGE_META[r.badge]!.cls,
              )}
            >
              {BADGE_META[r.badge]!.label}
            </span>
          )}
          {community?.flagged && (
            <span className="px-2.5 py-1 rounded-full bg-error-soft text-error text-[11px] font-bold">
              ⚠️ Accuracy under review
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onToggleSave(r)}
          aria-label={saved ? "Remove from saved" : "Save"}
          className={cn(
            "h-9 w-9 rounded-full border-2 flex items-center justify-center transition cursor-pointer shrink-0",
            saved
              ? "bg-secondary/20 border-secondary/50 text-secondary"
              : "bg-lowest border-line text-muted hover:text-ink",
          )}
        >
          <Heart className={cn("h-4 w-4", saved && "fill-secondary")} />
        </button>
      </div>

      {/* title */}
      <h3 className="mt-3 text-lg font-bold text-ink leading-tight">
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

      {/* semantic layer's "why this matches", in the student's own terms */}
      {r.ai_reason && (
        <p className="mt-2 text-xs text-secondary-dim font-semibold italic leading-relaxed">
          🤖 {r.ai_reason}
        </p>
      )}

      {/* true cost block — the headline */}
      <div className="mt-4 rounded-2xl bg-surface-low border border-line p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            True monthly cost
          </span>
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", LEVEL_STYLE[level])}>
            {COMMUTE_LEVEL_TEXT[level]}
          </span>
        </div>

        {r.price_known && r.true_cost != null ? (
          <>
            <div className="mt-1.5 text-2xl font-bold text-ink">
              {fmtMoney(r.true_cost, currency)}{" "}
              <span className="text-xs font-semibold text-muted">/mo all-in</span>
              {currency !== "THB" && (
                <span className="ml-1.5 text-xs font-semibold text-muted">
                  ({fmtMoney(r.true_cost, "THB")})
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-muted font-medium">
              {fmtMoney(r.rent, currency)} rent + ~{fmtMoney(r.monthly_fare, currency)}{" "}
              {MODE_LABEL[mode]}
            </div>
          </>
        ) : (
          <>
            <div className="mt-1.5 text-2xl font-bold text-ink">Price on request</div>
            <div className="mt-0.5 text-xs text-muted font-medium">
              + ~{fmtMoney(r.monthly_fare, currency)} {MODE_LABEL[mode]} fare. No public rent price
              for this place yet.
            </div>
          </>
        )}

        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted font-medium">
          <Clock className="h-3.5 w-3.5 text-muted shrink-0" />~{fmtHours(r.monthly_hours)}/mo on the road
        </div>

        {r.time_cost != null && (
          <div className="mt-1 text-xs text-secondary-dim font-semibold">
            {r.true_cost_incl_time != null ? (
              <>
                Incl. your time:{" "}
                <span className="font-bold">{fmtMoney(r.true_cost_incl_time, currency)}/mo</span>
              </>
            ) : (
              <>
                Your commute time ≈{" "}
                <span className="font-bold">{fmtMoney(r.time_cost, currency)}/mo</span>
              </>
            )}
          </div>
        )}

        {otherFare && (
          <div className="mt-2 pt-2 border-t border-line text-[11px] text-muted font-medium">
            vs {MODE_SHORT[other]}: ~{fmtMoney(otherFare.monthly_fare_thb, currency)}/mo ·{" "}
            {fmtHours(otherFare.monthly_hours)}/mo
          </div>
        )}
      </div>

      {/* what else you'll spend — rough per-person monthly extras */}
      {col && col.total != null && (
        <div className="mt-3 rounded-2xl border border-line bg-lowest">
          <button
            type="button"
            onClick={() => setColOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer"
          >
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
              <Wallet className="h-3.5 w-3.5" /> What else you'll spend
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-ink">
              ~{fmtMoney(col.total, currency)}/mo
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted transition-transform", colOpen && "rotate-180")} />
            </span>
          </button>
          {colOpen && (
            <div className="px-4 pb-3 text-xs text-muted font-medium space-y-1">
              <div className="flex justify-between"><span>Utilities (electricity, water)</span><span className="text-ink font-bold">~{fmtMoney(col.utilities, currency)}</span></div>
              <div className="flex justify-between"><span>Internet</span><span className="text-ink font-bold">~{fmtMoney(col.internet, currency)}</span></div>
              <div className="flex justify-between"><span>Mobile plan</span><span className="text-ink font-bold">~{fmtMoney(col.mobile, currency)}</span></div>
              <div className="flex justify-between"><span>Food (cooking + street food)</span><span className="text-ink font-bold">~{fmtMoney(col.food, currency)}</span></div>
              <p className="pt-1 text-[10px] text-muted/70">
                {col.note} · {col.source}
              </p>
            </div>
          )}
        </div>
      )}

      {/* multi-provider price comparison (affiliate Book buttons) */}
      <PriceCompare offers={r.offers ?? []} currency={currency} />

      {/* tags */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {r.vibe && (
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-surface-c text-ink">
            {r.vibe === "quiet" ? "🌿 quiet" : "✨ lively"}
          </span>
        )}
        {r.lease_type && LEASE_LABEL[r.lease_type] && (
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-surface-c text-ink">
            {LEASE_LABEL[r.lease_type]}
          </span>
        )}
        {r.met_nearby.map((m) => (
          <span
            key={m}
            className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-ok-soft text-ok"
          >
            📍 {m.replace(/_/g, " ")}
          </span>
        ))}
        {r.matched_amenities.map((a) => (
          <span
            key={a}
            className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-surface-c text-ink"
          >
            {a}
          </span>
        ))}
      </div>

      {/* subscores */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {SUBSCORE_META.map(({ key, label }) => {
          const pct = Math.round((r.subscores[key] ?? 0) * 100);
          return (
            <div key={key}>
              <div className="flex items-center justify-between text-[10px] text-muted mb-1">
                <span className="uppercase tracking-wide font-bold">{label}</span>
                <span className="text-ink font-bold">{pct}</span>
              </div>
              <div className="h-2 rounded-full bg-surface-high overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary-dim"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* review */}
      {r.reviews.length > 0 && (
        <p className="mt-4 text-sm text-muted italic leading-relaxed font-medium">
          "{r.reviews[0].text}"
          <span className="not-italic text-primary-dim ml-1">
            {"★".repeat(Math.max(0, Math.min(5, r.reviews[0].stars)))}
          </span>
        </p>
      )}

      {/* footer: map link + community accuracy feedback */}
      <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
        <a
          href={osmLink(r.lat, r.lon)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-secondary-dim hover:text-secondary"
        >
          <MapIcon className="h-3.5 w-3.5" /> View on map
        </a>
        {canVote && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted font-medium">
            <span>Accurate?</span>
            <button
              type="button"
              aria-label="Listing was accurate"
              onClick={() => vote(true)}
              disabled={voted !== null}
              className={cn(
                "px-2 py-1 rounded-full border transition cursor-pointer disabled:cursor-default",
                voted === "up" ? "bg-ok-soft border-ok/40 text-ok font-bold" : "border-line hover:bg-surface-c",
              )}
            >
              👍{community && community.up > 0 ? ` ${community.up}` : ""}
            </button>
            <button
              type="button"
              aria-label="Listing was inaccurate"
              onClick={() => vote(false)}
              disabled={voted !== null}
              className={cn(
                "px-2 py-1 rounded-full border transition cursor-pointer disabled:cursor-default",
                voted === "down" ? "bg-error-soft border-error/40 text-error font-bold" : "border-line hover:bg-surface-c",
              )}
            >
              👎{community && community.down > 0 ? ` ${community.down}` : ""}
            </button>
          </div>
        )}
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
    </article>
  );
}
