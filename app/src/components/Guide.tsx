import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { GUIDE } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Guide() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-3 animate-sift-fade">
      <p className="text-xs text-white/40">
        Avoid the classic newcomer mistakes — SiftPlace's quick checklist.
      </p>
      {GUIDE.map((g, i) => {
        const isOpen = open === i;
        return (
          <div
            key={g.q}
            className="bg-white/[0.02] border border-white/[0.08] rounded-2xl overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-center gap-3 p-4 text-left cursor-pointer"
            >
              <span className="h-9 w-9 rounded-xl bg-white/[0.04] flex items-center justify-center text-lg shrink-0">
                {g.icon}
              </span>
              <span className="flex-1 text-sm font-semibold text-white">{g.q}</span>
              <ChevronDown
                className={cn("h-4 w-4 text-white/40 transition-transform shrink-0", isOpen && "rotate-180")}
              />
            </button>
            {isOpen && (
              <p className="px-4 pb-4 pl-16 text-sm text-white/50 leading-relaxed">{g.a}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
