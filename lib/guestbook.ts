import { limits, photoTypes } from "../supabase/functions/moa-write/limits";
import { supabase, supabasePublicKey, supabaseUrl } from "./supabase";

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

class WriteError extends Error {
  constructor(readonly status: number) {
    super(`Save failed (${status})`);
  }
}

export function writeErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof WriteError)) return fallback;
  if (error.status === 401) return "로그인 세션이 만료됐거나 계정이 바뀌었어요. 로그인 상태를 확인한 뒤 다시 제출해 주세요.";
  if (error.status === 403) return "이메일 인증을 마친 계정으로 로그인해 주세요.";
  if (error.status === 409) return "이미 처리된 요청과 충돌했어요. 보드에서 등록 여부를 확인해 주세요.";
  if (error.status === 503) return "지금은 로그인 정보를 확인할 수 없어요. 잠시 후 다시 시도해 주세요.";
  return fallback;
}

export type PendingWrite = { id: string; authorId: string };

export function pendingWrite(previous: PendingWrite | undefined, authorId: string): PendingWrite {
  return previous?.authorId === authorId ? previous : { id: crypto.randomUUID(), authorId };
}

async function write(action: "entry" | "comment", fields: Record<string, string | Blob>, authorId: string) {
  const { data: { session }, error } = await supabase().auth.getSession();
  if (error && (!error.status || error.status === 429 || error.status >= 500)) throw new WriteError(503);
  if (!session || session.user.id !== authorId) throw new WriteError(401);
  const body = new FormData();
  body.set("action", action);
  for (const [name, value] of Object.entries(fields)) body.set(name, value);
  const result = await fetch(`${supabaseUrl}/functions/v1/moa-write`, {
    method: "POST", headers: { apikey: supabasePublicKey!, Authorization: `Bearer ${session.access_token}` }, body,
  });
  if (!result.ok) throw new WriteError(result.status);
}

export function saveEntry(entry: EntryDraft, authorId: string) {
  return write("entry", entry, authorId);
}

export function saveComment(comment: CommentDraft, authorId: string) {
  return write("comment", comment, authorId);
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
