import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";
import type { AffiliateGroup } from "@/lib/affiliates";

// Vendor picker for the pre-departure checklist: one CTA button per category;
// clicking opens a popup listing every vendor in the group so the student
// compares and chooses — we never funnel them to a single site. The vendor
// list itself lives in lib/affiliates.ts (one object per vendor).

export function VendorPicker({ group }: { group: AffiliateGroup }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (group.offers.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 sf-cta px-4 py-2 text-xs cursor-pointer"
      >
        {group.button}
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={group.title}
          >
            <div
              className="sf-card w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-b-none sm:rounded-b-3xl p-5 animate-sift-fade"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-bold text-ink leading-tight">{group.title}</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="h-9 w-9 shrink-0 rounded-full border-2 border-line bg-lowest text-muted hover:text-ink flex items-center justify-center cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-xs text-muted font-medium">
                A few options students use — compare and pick what fits your stay.
              </p>

              <div className="mt-4 space-y-2.5">
                {group.offers.map((o) => (
                  <a
                    key={o.name}
                    href={o.href}
                    target="_blank"
                    rel={o.sponsored ? "noopener noreferrer nofollow sponsored" : "noopener noreferrer"}
                    className="flex items-center justify-between gap-3 rounded-2xl border-2 border-line bg-lowest px-4 py-3 hover:bg-surface-c transition group"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-ink">{o.name}</span>
                      <span className="block text-[11px] text-muted font-medium">{o.blurb}</span>
                    </span>
                    <span className="sf-cta shrink-0 inline-flex items-center gap-1 px-3.5 py-1.5 text-xs">
                      Visit <ExternalLink className="h-3 w-3" />
                    </span>
                  </a>
                ))}
              </div>

              <p className="mt-4 text-[10px] text-muted/70 font-medium">
                Some links are affiliate links — booking through them supports SiftPlace at no
                extra cost to you. SiftPlace stays free for students.
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
