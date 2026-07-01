import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { GUIDE } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Guide() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-3 animate-sift-fade">
      <p className="text-xs text-muted font-medium">
        Avoid the classic newcomer mistakes — SiftPlace's quick checklist.
      </p>
      {GUIDE.map((g, i) => {
        const isOpen = open === i;
        return (
          <div
            key={g.q}
            className="sf-card overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-center gap-3 p-4 text-left cursor-pointer"
            >
              <span className="h-9 w-9 rounded-2xl bg-surface-c flex items-center justify-center text-lg shrink-0">
                {g.icon}
              </span>
              <span className="flex-1 text-sm font-bold text-ink">{g.q}</span>
              <ChevronDown
                className={cn("h-4 w-4 text-muted transition-transform shrink-0", isOpen && "rotate-180")}
              />
            </button>
            {isOpen && (
              <p className="px-4 pb-4 pl-16 text-sm text-muted leading-relaxed font-medium">{g.a}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
