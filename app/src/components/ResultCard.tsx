import { MapPin, Clock, Heart, Map as MapIcon } from "lucide-react";
import type { ListingResult } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  COMMUTE_LEVEL_TEXT,
  MODE_LABEL,
  MODE_SHORT,
  commuteLevel,
  fmtHours,
  fmtTHB,
  osmLink,
  otherMode,
} from "@/lib/fare";

const LEVEL_STYLE: Record<"low" | "moderate" | "high", string> = {
  low: "bg-emerald-500/15 text-emerald-300",
  moderate: "bg-amber-500/15 text-amber-300",
  high: "bg-rose-500/15 text-rose-300",
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
  onToggleSave,
}: {
  r: ListingResult;
  isTop: boolean;
  saved: boolean;
  onToggleSave: (name: string) => void;
}) {
  const mode = r.mode;
  const other = otherMode(mode);
  const otherFare = r.fares[other];
  const level = commuteLevel(r.monthly_fare);
  const meta = [r.area, r.type].filter(Boolean).join(" · ");

  return (
    <article
      className={cn(
        "rounded-2xl border bg-white/[0.02] p-5 animate-sift-fade",
        isTop
          ? "border-indigo-500/40 shadow-[0_8px_40px_-12px_rgba(99,102,241,0.45)]"
          : "border-white/[0.08]",
      )}
    >
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold">
            ★ {r.score}% match
          </span>
          {isTop ? (
            <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 text-[11px] font-semibold">
              ⭐ Top pick
            </span>
          ) : r.score >= 80 ? (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-semibold">
              Great fit
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onToggleSave(r.name)}
          aria-label={saved ? "Remove from saved" : "Save"}
          className={cn(
            "h-9 w-9 rounded-full border flex items-center justify-center transition cursor-pointer shrink-0",
            saved
              ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
              : "bg-white/[0.03] border-white/[0.1] text-white/40 hover:text-white/70",
          )}
        >
          <Heart className={cn("h-4 w-4", saved && "fill-rose-500")} />
        </button>
      </div>

      {/* title */}
      <h3 className="mt-3 text-lg font-semibold text-white leading-tight">{r.name}</h3>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-white/45">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {meta}
          {meta ? " · " : ""}~{r.commute_min} min each way
        </span>
      </div>

      {/* true cost block — the headline */}
      <div className="mt-4 rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
            True monthly cost
          </span>
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", LEVEL_STYLE[level])}>
            {COMMUTE_LEVEL_TEXT[level]}
          </span>
        </div>

        {r.price_known && r.true_cost != null ? (
          <>
            <div className="mt-1.5 text-2xl font-bold text-white">
              {fmtTHB(r.true_cost)}{" "}
              <span className="text-xs font-medium text-white/40">/mo all-in</span>
            </div>
            <div className="mt-0.5 text-xs text-white/50">
              {fmtTHB(r.rent)} rent + ~{fmtTHB(r.monthly_fare)} {MODE_LABEL[mode]}
            </div>
          </>
        ) : (
          <>
            <div className="mt-1.5 text-2xl font-bold text-white">Price on request</div>
            <div className="mt-0.5 text-xs text-white/50">
              + ~{fmtTHB(r.monthly_fare)} {MODE_LABEL[mode]} fare. Rent isn't in free OSM data yet.
            </div>
          </>
        )}

        <div className="mt-3 flex items-center gap-1.5 text-xs text-white/55">
          <Clock className="h-3.5 w-3.5 text-white/40 shrink-0" />~{fmtHours(r.monthly_hours)}/mo on the road
        </div>

        {r.time_cost != null && (
          <div className="mt-1 text-xs text-indigo-300/90">
            {r.true_cost_incl_time != null ? (
              <>
                Incl. your time: <span className="font-semibold">{fmtTHB(r.true_cost_incl_time)}/mo</span>
              </>
            ) : (
              <>
                Your commute time ≈ <span className="font-semibold">{fmtTHB(r.time_cost)}/mo</span>
              </>
            )}
          </div>
        )}

        {otherFare && (
          <div className="mt-2 pt-2 border-t border-white/[0.06] text-[11px] text-white/40">
            vs {MODE_SHORT[other]}: ~{fmtTHB(otherFare.monthly_fare_thb)}/mo · {fmtHours(otherFare.monthly_hours)}/mo
          </div>
        )}
      </div>

      {/* tags */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {r.vibe && (
          <span className="text-[11px] font-medium px-2 py-1 rounded-lg bg-white/[0.04] text-white/60">
            {r.vibe === "quiet" ? "🌿 quiet" : "✨ lively"}
          </span>
        )}
        {r.met_nearby.map((m) => (
          <span
            key={m}
            className="text-[11px] font-medium px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-300"
          >
            📍 {m.replace(/_/g, " ")}
          </span>
        ))}
        {r.matched_amenities.map((a) => (
          <span
            key={a}
            className="text-[11px] font-medium px-2 py-1 rounded-lg bg-white/[0.04] text-white/60"
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
              <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
                <span className="uppercase tracking-wide">{label}</span>
                <span className="text-white/55 font-semibold">{pct}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* review */}
      {r.reviews.length > 0 && (
        <p className="mt-4 text-sm text-white/55 italic leading-relaxed">
          "{r.reviews[0].text}"
          <span className="not-italic text-amber-300 ml-1">
            {"★".repeat(Math.max(0, Math.min(5, r.reviews[0].stars)))}
          </span>
        </p>
      )}

      {/* map link */}
      <a
        href={osmLink(r.lat, r.lon)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-300 hover:text-indigo-200"
      >
        <MapIcon className="h-3.5 w-3.5" /> View on map
      </a>
    </article>
  );
}
