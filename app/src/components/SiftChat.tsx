import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { SiftBot } from "@/components/SiftBot";
import { chat, type ChatMessage, type ParsedNotes } from "@/lib/api";
import { cn } from "@/lib/utils";

// The "Sift" mascot chatbot — a floating avatar that follows the user (fixed
// position) and opens a chat panel. The student describes what they want in
// plain language; the backend LLM chain (Agnes AI -> OpenAI -> offline rules)
// replies AND extracts structured demands, which we hand to the app to apply
// to the filters and re-run the search — the chips under the reply make that
// visible ("Got it — added quiet + near gym").
//
// The avatar is "Sift" the robot (SiftBot.tsx) — a cute humanoid robot whose
// face screen shows the house logo for now; the character art can evolve later.

interface Bubble {
  role: "user" | "assistant";
  content: string;
  /** Filter chips this turn added — rendered under the reply. */
  chips?: string[];
}

const GREETING =
  "Hi, I'm Sift! 👋 Tell me about your ideal place — like \"somewhere quiet near " +
  "Chula, under ฿15k, with a real desk\" — and I'll set the filters for you.";

/** Streamed-feel reply: reveal ~3 characters per tick. */
const STREAM_CHARS_PER_TICK = 3;
const STREAM_TICK_MS = 18;

export function SiftChat({
  filtersSummary,
  onDemands,
}: {
  /** Short human-readable summary of the current filters (context for the LLM). */
  filtersSummary: string;
  /** Apply extracted demands to the filters + re-run the search. */
  onDemands: (parsed: ParsedNotes, userText: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
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

  const send = async () => {
    const text = input.trim();
    if (!text || typing) return;
    setInput("");
    const history: Bubble[] = [...bubbles, { role: "user", content: text }];
    setBubbles(history);
    setTyping(true);
    try {
      // full transcript (minus chips) so the LLM keeps conversational context
      const messages: ChatMessage[] = history
        .map(({ role, content }) => ({ role, content }))
        .slice(-12);
      const res = await chat(messages, filtersSummary);
      setTyping(false);
      const chips = res.parsed.detected;
      streamIn({ role: "assistant", content: res.reply, chips: chips.length ? chips : undefined });
      if (chips.length) onDemands(res.parsed, text);
    } catch {
      setTyping(false);
      streamIn({
        role: "assistant",
        content:
          "I couldn't reach my brain just now 😅 — your words still work in the " +
          "\"Anything else?\" box in Filters, or try me again in a moment.",
      });
    }
  };

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
          className="fixed bottom-36 right-4 z-40 w-[min(94vw,380px)] h-[min(65vh,520px)] sf-card p-0 flex flex-col overflow-hidden animate-sift-fade"
          role="dialog"
          aria-label="Sift chat"
        >
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line bg-surface-low">
            <SiftBot size={38} />
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink leading-tight">Sift</p>
              <p className="text-[11px] text-muted font-medium leading-tight">
                your housing buddy — I set the filters for you
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
                    {b.chips && (!streaming || streaming.index !== i) && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {b.chips.map((c) => (
                          <span
                            key={c}
                            className="px-2 py-0.5 rounded-full bg-ok-soft text-ok text-[10px] font-bold"
                          >
                            ✓ {c}
                          </span>
                        ))}
                      </div>
                    )}
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

          <div className="flex items-center gap-2 px-3 py-3 border-t border-line bg-surface-low">
            <input
              className="sf-field flex-1 min-w-0 text-sm"
              placeholder="quiet, near a gym, under ฿15k…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="button"
              aria-label="Send"
              onClick={() => void send()}
              disabled={typing || !input.trim()}
              className="sf-cta h-10 w-10 shrink-0 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
