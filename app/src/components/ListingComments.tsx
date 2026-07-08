import { useEffect, useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import type { ListingResult } from "@/lib/api";
import {
  COMMENT_MAX_LENGTH,
  communityEnabled,
  fetchComments,
  listingKey,
  postComment,
  type StudentComment,
} from "@/lib/community";
import { cn } from "@/lib/utils";

// Community listing reviews (Supabase) — students share what living there is
// actually like: the building, the street, the neighbours. Experiences, not
// accusations; scam signals go through the 👍/👎 accuracy vote next to this.
//
// Two variants: "card" = collapsible section on a ResultCard; "detail" =
// always-open section inside the ListingDetail panel.

function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(iso).toLocaleDateString("en-GB");
}

export function ListingComments({
  r,
  variant = "card",
}: {
  r: ListingResult;
  variant?: "card" | "detail";
}) {
  const embedded = variant === "detail";
  const [open, setOpen] = useState(embedded);
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [comments, setComments] = useState<StudentComment[]>([]);
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const usable = communityEnabled && r.lat != null && r.lon != null && r.source !== "featured";
  const key = usable ? listingKey(r.name, r.lat as number, r.lon as number) : null;

  const load = () => {
    if (!key) return;
    setState("loading");
    fetchComments(key)
      .then((c) => {
        setComments(c);
        setState("ok");
      })
      .catch(() => setState("error"));
  };

  // the detail panel opens straight onto the conversation
  useEffect(() => {
    if (embedded && usable && state === "idle") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, usable]);

  if (!usable) {
    // inside the detail panel, say WHY there's no comment box yet
    if (embedded) {
      return (
        <p className="text-xs text-muted font-medium">
          {communityEnabled
            ? "Community comments open up on live search listings."
            : "Community comments are coming soon — this build isn't connected to the community database yet."}
        </p>
      );
    }
    return null;
  }

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && state === "idle") load();
  };

  const send = async () => {
    const text = body.trim();
    if (!text || sending || !key) return;
    setSending(true);
    try {
      const created = await postComment({ key, listingName: r.name, author, body: text });
      setComments((prev) => [created, ...prev]);
      setBody("");
    } catch {
      // leave the draft in place so nothing typed is lost
    } finally {
      setSending(false);
    }
  };

  const bodyContent = (
    <div className={cn("space-y-2.5", !embedded && "px-4 pb-3 animate-sift-fade")}>
      {state === "loading" && (
        <p className="text-xs text-muted font-medium">Loading comments…</p>
      )}
      {state === "error" && (
        <p className="text-xs text-muted font-medium">
          Couldn't load comments right now —{" "}
          <button type="button" onClick={load} className="font-bold text-secondary-dim cursor-pointer">
            try again
          </button>
          .
        </p>
      )}
      {state === "ok" && comments.length === 0 && (
        <p className="text-xs text-muted font-medium">
          No comments yet — lived here or viewed it? Help the next student out.
        </p>
      )}
      {comments.map((c) => (
        <div key={c.id} className="rounded-xl bg-surface-low px-3 py-2">
          <p className="text-xs text-ink font-medium leading-relaxed">{c.body}</p>
          <p className="mt-0.5 text-[10px] text-muted font-semibold">
            {c.author || "anonymous student"} · {timeAgo(c.created_at)}
          </p>
        </div>
      ))}

      <div className="pt-1 space-y-2">
        <input
          className="sf-field text-xs"
          placeholder="Name (optional)"
          value={author}
          maxLength={40}
          onChange={(e) => setAuthor(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <input
            className="sf-field flex-1 min-w-0 text-xs"
            placeholder="Share your experience of this place…"
            value={body}
            maxLength={COMMENT_MAX_LENGTH}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || !body.trim()}
            className="sf-cta px-3.5 py-2 text-xs shrink-0 cursor-pointer disabled:opacity-50"
          >
            Post
          </button>
        </div>
        <p className="text-[10px] text-muted/70 font-medium">
          Shared publicly with other students. Experiences, not accusations — use the 👍/👎
          accuracy vote to flag inaccurate or scammy listings.
        </p>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div>
        <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
          <MessageCircle className="h-3.5 w-3.5" /> Student comments
          {state === "ok" && comments.length > 0 && (
            <span className="normal-case tracking-normal text-ink">· {comments.length}</span>
          )}
        </p>
        {bodyContent}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-line bg-lowest">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer"
      >
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
          <MessageCircle className="h-3.5 w-3.5" /> Student comments
          {state === "ok" && comments.length > 0 && (
            <span className="normal-case tracking-normal text-ink">· {comments.length}</span>
          )}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && bodyContent}
    </div>
  );
}
