import { List, Heart, Map, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tab = "listings" | "saved" | "areas" | "guide";

const TABS: { id: Tab; label: string; Icon: typeof List }[] = [
  { id: "listings", label: "Listings", Icon: List },
  { id: "saved", label: "Saved", Icon: Heart },
  { id: "areas", label: "Areas", Icon: Map },
  { id: "guide", label: "Guide", Icon: Shield },
];

export function BottomNav({
  tab,
  onTab,
  savedCount,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  savedCount: number;
}) {
  return (
    <nav className="sticky bottom-0 z-40 border-t border-line bg-lowest/95 backdrop-blur-md">
      <div className="max-w-3xl mx-auto flex justify-around px-2 py-2">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTab(id)}
              className={cn(
                "relative flex flex-col items-center gap-1 px-4 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer",
                active ? "text-secondary" : "text-muted hover:text-ink",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
              {id === "saved" && savedCount > 0 && (
                <span className="absolute top-0 right-1.5 min-w-4 h-4 px-1 rounded-full bg-secondary text-on-secondary text-[9px] font-bold flex items-center justify-center">
                  {savedCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
