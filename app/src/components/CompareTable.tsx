import type { ListingResult } from "@/lib/api";
import { fmtMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";

function avgStars(r: ListingResult): number | null {
  if (!r.reviews.length) return null;
  return r.reviews.reduce((sum, rv) => sum + rv.stars, 0) / r.reviews.length;
}

interface Row {
  label: string;
  /** Money rows format through the user's selected currency, not hardcoded THB. */
  value: (r: ListingResult, currency: string) => string;
  /** Numeric basis for the "best in row" highlight, with direction. */
  best?: { metric: (r: ListingResult) => number | null; dir: "min" | "max" };
}

const ROWS: Row[] = [
  { label: "Match", value: (r) => `${r.score}%`, best: { metric: (r) => r.score, dir: "max" } },
  {
    label: "Rent /mo",
    value: (r, c) => (r.price_known && r.rent != null ? fmtMoney(r.rent, c) : "On request"),
    best: { metric: (r) => (r.price_known ? r.rent : null), dir: "min" },
  },
  {
    label: "Est. commute fare /mo",
    value: (r, c) => fmtMoney(r.monthly_fare, c),
    best: { metric: (r) => r.monthly_fare, dir: "min" },
  },
  {
    label: "True cost /mo",
    value: (r, c) => (r.true_cost != null ? fmtMoney(r.true_cost, c) : "—"),
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

export function CompareTable({
  items,
  currency = "THB",
}: {
  items: ListingResult[];
  currency?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-line">
            <th className="sticky left-0 z-10 bg-surface-c text-left text-[11px] uppercase tracking-wider text-muted font-bold p-3 min-w-32">
              Metric
            </th>
            {items.map((r, i) => (
              <th key={r.name + i} className="text-left p-3 min-w-44 align-top bg-lowest">
                <div className="text-ink font-bold leading-tight">{r.name}</div>
                <div className="text-[11px] text-muted mt-0.5 font-medium">{r.area || r.type || "—"}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            const bi = bestIndex(row, items);
            return (
              <tr key={row.label} className="border-b border-line last:border-0">
                <td className="sticky left-0 z-10 bg-surface-c text-[11px] uppercase tracking-wider text-muted font-bold p-3">
                  {row.label}
                </td>
                {items.map((r, i) => (
                  <td
                    key={r.name + i}
                    className={cn(
                      "p-3 text-ink whitespace-nowrap bg-lowest font-medium",
                      bi === i && "text-ok font-bold",
                    )}
                  >
                    {row.value(r, currency)}
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
