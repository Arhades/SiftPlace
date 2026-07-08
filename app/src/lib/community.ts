// Community listing reviews on Supabase — a space for students to share what a
// place / building community is really like. Talks straight to Supabase's
// PostgREST API with the public anon key (no SDK dependency); Row Level
// Security on the table is the real gate (see docs/supabase-community.sql).
//
// This is the same Supabase project that hosted the waitlist — the waitlist is
// being retired and the project repurposed for community content. When the env
// vars are missing the whole feature quietly disappears (communityEnabled).

const SUPABASE_URL = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "")
  .trim()
  .replace(/\/+$/, "");
const SUPABASE_ANON_KEY = ((import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "").trim();

export const communityEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export interface StudentComment {
  id: string;
  listing_key: string;
  listing_name: string;
  author: string | null;
  body: string;
  created_at: string; // ISO timestamp
}

/** Stable identity for a listing across searches: name + rounded coordinates
 *  (~11 m at 4 dp), matching how the backend keys accuracy votes. */
export function listingKey(name: string, lat: number, lon: number): string {
  return `${name.trim().toLowerCase()}|${lat.toFixed(4)}|${lon.toFixed(4)}`;
}

const TABLE = "listing_comments";
const MAX_BODY = 600;

async function sb<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(init?.method === "POST" ? { Prefer: "return=representation" } : {}),
      ...init?.headers,
    },
  });
  if (!r.ok) throw new Error(`Community request failed (${r.status}).`);
  return r.json();
}

export function fetchComments(key: string): Promise<StudentComment[]> {
  const params = new URLSearchParams({
    listing_key: `eq.${key}`,
    select: "id,listing_key,listing_name,author,body,created_at",
    order: "created_at.desc",
    limit: "25",
  });
  return sb<StudentComment[]>(`${TABLE}?${params}`);
}

export async function postComment(input: {
  key: string;
  listingName: string;
  author: string;
  body: string;
}): Promise<StudentComment> {
  const rows = await sb<StudentComment[]>(TABLE, {
    method: "POST",
    body: JSON.stringify({
      listing_key: input.key,
      listing_name: input.listingName.slice(0, 200),
      author: input.author.trim().slice(0, 40) || null,
      body: input.body.trim().slice(0, MAX_BODY),
    }),
  });
  return rows[0];
}

/** "How many students viewed this property" — counts one view per browser
 *  session per listing (sessionStorage guard) via the bump_listing_view RPC;
 *  re-opening the detail just reads the current count. Null = feature off. */
export async function bumpViews(key: string): Promise<number | null> {
  if (!communityEnabled) return null;
  const guard = `siftplace:viewed:${key}`;
  let alreadyCounted = false;
  try {
    alreadyCounted = sessionStorage.getItem(guard) != null;
    sessionStorage.setItem(guard, "1");
  } catch {
    // storage blocked (private mode) — fall through and count the view
  }
  try {
    return await sb<number>("rpc/bump_listing_view", {
      method: "POST",
      body: JSON.stringify({ p_listing_key: key, p_increment: !alreadyCounted }),
    });
  } catch {
    return null;
  }
}

export { MAX_BODY as COMMENT_MAX_LENGTH };
