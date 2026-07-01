import type { CSSProperties } from "react";
import type { Weights } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SliderDef {
  key: keyof Weights;
  name: string;
  desc: string;
  lo: string;
  hi: string;
}

const DEFS: SliderDef[] = [
  { key: "cost", name: "Budget", desc: "Staying within your cash", lo: "Flexible", hi: "Frugal" },
  { key: "location", name: "Location", desc: "Commute & what's nearby", lo: "Flexible", hi: "Next to work" },
  { key: "living", name: "Room & comfort", desc: "Space, desk, amenities", lo: "Basic is ok", hi: "Must be nice" },
];

const VERDICTS = [
  "Don't mind", "Don't mind", "Flexible", "Flexible", "Balanced", "Balanced",
  "Balanced", "Leaning", "Leaning", "Crucial", "Crucial",
];

export const WEIGHT_CAP = 20;

export function WeightSliders({
  weights,
  onChange,
}: {
  weights: Weights;
  onChange: (w: Weights) => void;
}) {
  const total = weights.cost + weights.location + weights.living;
  const over = total > WEIGHT_CAP;
  const set = (key: keyof Weights, value: number) => onChange({ ...weights, [key]: value });

  return (
    <div className="space-y-6">
      {DEFS.map((d) => {
        const v = weights[d.key];
        return (
          <div key={d.key}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">{d.name}</div>
                <div className="text-[11px] text-white/40">{d.desc}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="min-w-7 text-center text-sm font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2 py-0.5">
                  {v}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45 w-14 text-right">
                  {VERDICTS[v]}
                </span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              value={v}
              onChange={(e) => set(d.key, Number(e.target.value))}
              className="sift-slider"
              style={{ "--pct": (v / 10) * 100 } as CSSProperties}
              aria-label={d.name}
            />
            <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-white/35 mt-0.5">
              <span>{d.lo}</span>
              <span>{d.hi}</span>
            </div>
          </div>
        );
      })}

      <div
        className={cn(
          "inline-flex items-center gap-2 text-xs font-semibold rounded-full px-4 py-2 border",
          over
            ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
            : "bg-white/[0.03] border-white/[0.08] text-white/60",
        )}
      >
        Attention spent: {total} / {WEIGHT_CAP}
        {over ? " — ease one down" : ""}
      </div>
    </div>
  );
}
