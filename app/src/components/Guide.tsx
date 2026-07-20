import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { GUIDE, PRE_DEPARTURE, type GuideItem } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { VendorPicker } from "./VendorPicker";

function Accordion({ items, keyPrefix }: { items: GuideItem[]; keyPrefix: string }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      {items.map((g, i) => {
        const isOpen = open === i;
        return (
          <div key={keyPrefix + g.q} className="sf-card overflow-hidden">
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
              <div className="px-4 pb-4 pl-16">
                <p className="text-sm text-muted leading-relaxed font-medium">{g.a}</p>
                {g.vendors && (
                  <div className="mt-3">
                    <VendorPicker group={g.vendors} />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Guide() {
  return (
    <div className="space-y-6 animate-sift-fade">

      <div className="space-y-3">
        <p className="text-xs text-muted font-medium">
          Avoid the classic newcomer mistakes — SiftPlace's quick checklist.
        </p>
        <Accordion items={GUIDE} keyPrefix="guide-" />
      </div>

      {/* pre-departure checklist — static "before you move" content */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-ink">🧳 Before you move</h3>
        <p className="text-xs text-muted font-medium">
          The boring-but-vital admin, in order. Sort these before your flight and week one takes
          care of itself.
        </p>
        <Accordion items={PRE_DEPARTURE} keyPrefix="pre-" />
        <p className="text-[10px] text-muted/70 font-medium px-1">
          Some checklist links are affiliate links — booking through them supports SiftPlace at no
          extra cost to you. SiftPlace stays free for students.
        </p>
      </div>
    </div>
  );
}
