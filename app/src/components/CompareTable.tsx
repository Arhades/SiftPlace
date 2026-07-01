import type { ListingResult } from "@/lib/api";
import { fmtTHB } from "@/lib/fare";
import { cn } from "@/lib/utils";

function avgStars(r: ListingResult): number | null {
  if (!r.reviews.length) return null;
  return r.reviews.reduce((sum, rv) => sum + rv.stars, 0) / r.reviews.length;
}

interface Row {
  label: string;
  value: (r: ListingResult) => string;
  /** Numeric basis for the "best in row" highlight, with direction. */
  best?: { metric: (r: ListingResult) => number | null; dir: "min" | "max" };
}

const ROWS: Row[] = [
  { label: "Match", value: (r) => `${r.score}%`, best: { metric: (r) => r.score, dir: "max" } },
  {
    label: "Rent /mo",
    value: (r) => (r.price_known && r.rent != null ? fmtTHB(r.rent) : "On request"),
    best: { metric: (r) => (r.price_known ? r.rent : null), dir: "min" },
  },
  {
    label: "Est. commute fare /mo",
    value: (r) => fmtTHB(r.monthly_fare),
    best: { metric: (r) => r.monthly_fare, dir: "min" },
  },
  {
    label: "True cost /mo",
    value: (r) => (r.true_cost != null ? fmtTHB(r.true_cost) : "—"),
    best: { metric: (r) => r.true_cost, dir: "min" },
  },
  {
    label: "Distance to anchor",
    value: (r) => `~${r.commute_min} min`,
    best: { metric: (r) => r.commute_min, dir: "min" },
  },
  {
    label: "Living (reviews)",
    value: (r) => {
      const a = avgStars(r);
      return a == null ? "No reviews yet" : `${"★".repeat(Math.round(a))} (${r.reviews.length})`;
    },
    best: { metric: avgStars, dir: "max" },
  },
];

function bestIndex(row: Row, items: ListingResult[]): number | null {
  if (!row.best) return null;
  const { metric, dir } = row.best;
  let bi = -1;
  let bv: number | null = null;
  items.forEach((r, i) => {
    const m = metric(r);
    if (m == null) return;
    if (bv == null || (dir === "min" ? m < bv : m > bv)) {
      bv = m;
      bi = i;
    }
  });
  return bi >= 0 ? bi : null;
}

export function CompareTable({ items }: { items: ListingResult[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-white/[0.08]">
            <th className="sticky left-0 z-10 bg-[#0a0a0a] text-left text-[11px] uppercase tracking-wider text-white/40 font-semibold p-3 min-w-32">
              Metric
            </th>
            {items.map((r, i) => (
              <th key={r.name + i} className="text-left p-3 min-w-44 align-top">
                <div className="text-white font-semibold leading-tight">{r.name}</div>
                <div className="text-[11px] text-white/40 mt-0.5">{r.area || r.type || "—"}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            const bi = bestIndex(row, items);
            return (
              <tr key={row.label} className="border-b border-white/[0.05] last:border-0">
                <td className="sticky left-0 z-10 bg-[#0a0a0a] text-[11px] uppercase tracking-wider text-white/45 font-semibold p-3">
                  {row.label}
                </td>
                {items.map((r, i) => (
                  <td
                    key={r.name + i}
                    className={cn(
                      "p-3 text-white/80 whitespace-nowrap",
                      bi === i && "text-emerald-300 font-semibold",
                    )}
                  >
                    {row.value(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
