import { createClient } from "@supabase/supabase-js";
import { limits, photoTypes } from "../supabase/functions/moa-write/limits";

export { limits, photoTypes };
export type MediaKind = "photo" | "drawing";

type EntryDraft = { id: string; nickname: string; message: string; image: Blob; kind: MediaKind };
export type Entry = Omit<EntryDraft, "image"> & { image: string; createdAt: number; commentCount: number };

type CommentDraft = { id: string; entryId: string; nickname: string; body: string };
export type Comment = CommentDraft & { createdAt: number };
type EntryRow = {
  id: string; nickname: string; message: string; image_path: string; image_type: MediaKind;
  created_at: string; comments: { count: number }[];
};
type CommentRow = { id: string; entry_id: string; nickname: string; body: string; created_at: string };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let client: ReturnType<typeof createClient> | undefined;

function supabase() {
  if (!url || !anonKey) throw new Error("Supabase environment variables are missing");
  return client ??= createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function readBoard(): Promise<Entry[]> {
  const db = supabase();
  const { data, error } = await db.from("entries")
    .select("id,nickname,message,image_path,image_type,created_at,comments(count)")
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100)
    .overrideTypes<EntryRow[], { merge: false }>();
  if (error) throw error;
  return data.map((row) => ({
    id: row.id, nickname: row.nickname, message: row.message, kind: row.image_type,
    image: db.storage.from("moa-artwork").getPublicUrl(row.image_path).data.publicUrl,
    createdAt: Date.parse(row.created_at), commentCount: row.comments[0]?.count ?? 0,
  }));
}

export async function readComments(entryId: string): Promise<Comment[]> {
  const db = supabase();
  const comments: Comment[] = [];
  const pageSize = 200;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from("comments").select("id,entry_id,nickname,body,created_at")
      .eq("entry_id", entryId).order("created_at").order("id").range(from, from + pageSize - 1)
      .overrideTypes<CommentRow[], { merge: false }>();
    if (error) throw error;
    comments.push(...data.map((row) => ({
      id: row.id, entryId: row.entry_id, nickname: row.nickname, body: row.body, createdAt: Date.parse(row.created_at),
    })));
    if (data.length < pageSize) return comments;
  }
}

async function write(action: "entry" | "comment", fields: Record<string, string | Blob>) {
  const body = new FormData();
  body.set("action", action);
  for (const [name, value] of Object.entries(fields)) body.set(name, value);
  if (!url || !anonKey) throw new Error("Supabase environment variables are missing");
  const result = await fetch(`${url}/functions/v1/moa-write`, {
    method: "POST", headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }, body,
  });
  if (!result.ok) throw new Error(`Save failed (${result.status})`);
}

export function saveEntry(entry: EntryDraft) {
  return write("entry", entry);
}

export function saveComment(comment: CommentDraft) {
  return write("comment", comment);
}

function listen(channel: ReturnType<ReturnType<typeof supabase>["channel"]>, onChange: () => void) {
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") onChange();
  });
  window.addEventListener("focus", onChange);
  window.addEventListener("online", onChange);
  return () => {
    window.removeEventListener("focus", onChange);
    window.removeEventListener("online", onChange);
    void supabase().removeChannel(channel);
  };
}

export function subscribeToBoard(onChange: () => void) {
  const channel = supabase().channel(`moa-board:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "entries" }, onChange)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "entries" }, onChange)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments" }, onChange);
  return listen(channel, onChange);
}

export function subscribeToComments(entryId: string, onChange: () => void) {
  const channel = supabase().channel(`moa-comments:${entryId}:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments", filter: `entry_id=eq.${entryId}` }, onChange);
  return listen(channel, onChange);
}
