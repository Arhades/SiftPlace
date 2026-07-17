import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { SiftBot } from "@/components/SiftBot";
import {
  chat,
  type ChatListingContext,
  type ChatMessage,
  type ListingResult,
} from "@/lib/api";
import {
  SIFT_QUESTION_CATEGORIES,
  type SiftQuestionCategoryId,
} from "@/data/siftQuestions";
import { cn } from "@/lib/utils";

// The "Sift" mascot chatbot — a fixed-question in-app guide. Users choose from
// the supported catalogue instead of entering arbitrary prompts.
//
// The avatar is "Sift" the robot (SiftBot.tsx) — a cute humanoid robot whose
// face screen shows the house logo for now; the character art can evolve later.

interface Bubble {
  role: "user" | "assistant";
  content: string;
}

const GREETING =
  "Hi, I'm Sift! 👋 Choose a question below and I'll guide you through SiftPlace.";

/** Streamed-feel reply: reveal ~3 characters per tick. */
const STREAM_CHARS_PER_TICK = 3;
const STREAM_TICK_MS = 18;

export function SiftChat({
  filtersSummary,
  currentSection,
  listings,
}: {
  /** Short human-readable summary of the current filters (context for the LLM). */
  filtersSummary: string;
  /** Current bottom-navigation tab, used to make directions contextual. */
  currentSection: "listings" | "saved" | "areas" | "guide";
  /** Current results or saved shortlist, used only for grounded comparisons. */
  listings: ListingResult[];
}) {
  const [open, setOpen] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([{ role: "assistant", content: GREETING }]);
  const [categoryId, setCategoryId] = useState<SiftQuestionCategoryId>("how_to");
  const [typing, setTyping] = useState(false);
  // index of the bubble currently being "streamed" + how much of it is shown
  const [streaming, setStreaming] = useState<{ index: number; shown: number } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const streamTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // keep the newest message in view
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [bubbles, typing, streaming]);

  useEffect(() => () => {
    if (streamTimer.current) clearInterval(streamTimer.current);
  }, []);

  const streamIn = (bubble: Bubble) => {
    setBubbles((prev) => {
      const index = prev.length;
      setStreaming({ index, shown: 0 });
      if (streamTimer.current) clearInterval(streamTimer.current);
      streamTimer.current = setInterval(() => {
        setStreaming((s) => {
          if (!s || s.index !== index) return s;
          const shown = s.shown + STREAM_CHARS_PER_TICK;
          if (shown >= bubble.content.length) {
            if (streamTimer.current) clearInterval(streamTimer.current);
            return null; // fully revealed
          }
          return { ...s, shown };
        });
      }, STREAM_TICK_MS);
      return [...prev, bubble];
    });
  };

  const send = async (question: string) => {
    const text = question.trim();
    if (!text || typing || streaming) return;
    const history: Bubble[] = [...bubbles, { role: "user", content: text }];
    setBubbles(history);
    setTyping(true);
    try {
      // full transcript (minus chips) so the LLM keeps conversational context
      const messages: ChatMessage[] = history
        .map(({ role, content }) => ({ role, content }))
        .slice(-12);
      const listingContext: ChatListingContext[] = listings.slice(0, 8).map((listing) => ({
        name: listing.name,
        area: listing.area,
        score: listing.score,
        rent: listing.rent,
        true_cost: listing.true_cost,
        true_cost_incl_time: listing.true_cost_incl_time,
        price_known: listing.price_known,
        commute_min: listing.commute_min,
        monthly_fare: listing.monthly_fare,
        monthly_hours: listing.monthly_hours,
        time_cost: listing.time_cost,
        mode: listing.mode,
        subscores: listing.subscores,
        badge: listing.badge,
        matched_amenities: listing.matched_amenities,
      }));
      const res = await chat(messages, filtersSummary, currentSection, listingContext);
      setTyping(false);
      streamIn({ role: "assistant", content: res.reply });
    } catch {
      setTyping(false);
      streamIn({
        role: "assistant",
        content:
          "I couldn't connect just now 😅. Please choose the question again in a moment.",
      });
    }
  };

  const activeCategory =
    SIFT_QUESTION_CATEGORIES.find((category) => category.id === categoryId)
    ?? SIFT_QUESTION_CATEGORIES[0];

  return (
    <>
      {/* floating robot mascot — follows the user on scroll */}
      <button
        type="button"
        aria-label={open ? "Close Sift chat" : "Chat with Sift"}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed bottom-20 right-4 z-40 transition hover:scale-105 active:scale-95 cursor-pointer",
          open
            ? "h-14 w-14 rounded-full shadow-[0_10px_28px_-8px_rgba(44,22,14,0.45)] border-2 border-primary-dim bg-lowest flex items-center justify-center"
            : "drop-shadow-[0_10px_14px_rgba(44,22,14,0.35)]",
        )}
      >
        {open ? <X className="h-5 w-5 text-muted" /> : <SiftBot size={82} />}
        {!open && (
          <span className="absolute top-3 -right-1 h-3.5 w-3.5 rounded-full bg-primary border-2 border-lowest animate-pulse" />
        )}
      </button>

      {/* chat panel */}
      {open && (
        <div
          className="fixed bottom-36 right-4 z-40 w-[min(94vw,400px)] h-[min(72vh,600px)] sf-card p-0 flex flex-col overflow-hidden animate-sift-fade"
          role="dialog"
          aria-label="Sift chat"
        >
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line bg-surface-low">
            <SiftBot size={38} />
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink leading-tight">Sift</p>
              <p className="text-[11px] text-muted font-medium leading-tight">
                your SiftPlace guide — choose a fixed question
              </p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {bubbles.map((b, i) => {
              const streamed =
                streaming && streaming.index === i
                  ? b.content.slice(0, streaming.shown)
                  : b.content;
              return (
                <div key={i} className={cn("flex", b.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm font-medium leading-relaxed",
                      b.role === "user"
                        ? "bg-primary/25 text-ink rounded-br-md"
                        : "bg-surface-c text-ink rounded-bl-md",
                    )}
                  >
                    {streamed}
                  </div>
                </div>
              );
            })}
            {typing && (
              <div className="flex justify-start">
                <div className="bg-surface-c rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce"
                      style={{ animationDelay: `${d * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-line bg-surface-low px-3 py-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
              Choose a question
            </p>
            <div className="mb-2 grid grid-cols-2 gap-1.5" role="tablist" aria-label="Question categories">
              {SIFT_QUESTION_CATEGORIES.map((category) => {
                const active = category.id === categoryId;
                return (
                  <button
                    key={category.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setCategoryId(category.id)}
                    className={cn(
                      "rounded-xl px-2 py-2 text-[11px] font-bold transition cursor-pointer",
                      active
                        ? "bg-primary/25 text-ink"
                        : "bg-lowest text-muted hover:bg-surface-c hover:text-ink",
                    )}
                  >
                    {category.icon} {category.label}
                  </button>
                );
              })}
            </div>
            <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
              {activeCategory.questions.map((question) => (
                <button
                  key={question}
                  type="button"
                  disabled={typing || streaming !== null}
                  onClick={() => void send(question)}
                  className="w-full rounded-xl border border-line bg-lowest px-3 py-2 text-left text-xs font-semibold text-ink transition hover:bg-surface-c cursor-pointer disabled:cursor-wait disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
