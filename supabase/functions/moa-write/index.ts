import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { limits, photoTypes } from "./limits.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, data: object) {
  return Response.json(data, { status, headers });
}

const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const auth = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function field(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function detectType(bytes: Uint8Array) {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  const prefix = new TextDecoder().decode(bytes);
  if (prefix.startsWith("RIFF") && prefix.slice(8, 12) === "WEBP") return "image/webp";
  return "";
}

async function sha256(bytes: ArrayBuffer | Uint8Array<ArrayBuffer>) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fingerprint(fields: string[]) {
  return sha256(new TextEncoder().encode(JSON.stringify(fields)));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(405, { error: "Method not allowed" });
  if (Number(request.headers.get("content-length")) > limits.photo + 65536) {
    return reply(413, { error: "Payload too large" });
  }

  try {
    const token = request.headers.get("authorization")?.match(/^Bearer ([^\s,]+)$/i)?.[1];
    if (!token || token === anonKey) return reply(401, { error: "Sign in required" });

    const { data: { user }, error: authError } = await auth.auth.getUser(token);
    if (authError) {
      const status = authError.status;
      if (!status || status === 429 || status >= 500) return reply(503, { error: "Auth unavailable" });
      return reply(401, { error: "Invalid session" });
    }
    if (!user) return reply(401, { error: "Invalid session" });
    if (user.role !== "authenticated" || user.is_anonymous || !user.email || !user.email_confirmed_at) {
      return reply(403, { error: "Verified email required" });
    }

    const form = await request.formData().catch(() => null);
    if (!form) return reply(400, { error: "Invalid form" });
    const action = field(form, "action");
    const id = field(form, "id").toLowerCase();
    const nickname = field(form, "nickname") || "익명";
    if (!uuid.test(id) || nickname.length > limits.nickname) return reply(400, { error: "Invalid author or ID" });

    if (action === "comment") {
      const entryId = field(form, "entryId").toLowerCase();
      const body = field(form, "body");
      if (!uuid.test(entryId) || !body || body.length > limits.comment) return reply(400, { error: "Invalid comment" });
      const { data: saved, error } = await db.rpc("register_guestbook_comment", {
        p_id: id, p_author_id: user.id, p_fingerprint: await fingerprint([entryId, nickname, body]),
        p_entry_id: entryId, p_nickname: nickname, p_body: body,
      });
      if (error) {
        if (error.code === "23503") return reply(404, { error: "Entry not found" });
        throw error;
      }
      if (saved !== true) return reply(409, { error: "Request ID conflict" });
      return reply(200, { id });
    }

    if (action !== "entry") return reply(400, { error: "Unknown action" });
    const message = field(form, "message");
    const kind = field(form, "kind");
    const file = form.get("image");
    if (message.length > limits.message || (kind !== "photo" && kind !== "drawing") ||
        !(file instanceof File) || !file.size || file.size > limits.photo) {
      return reply(400, { error: "Invalid entry" });
    }
    const type = detectType(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
    if (!photoTypes.includes(type) || file.type !== type || (kind === "drawing" && type !== "image/png")) {
      return reply(415, { error: "Unsupported image" });
    }

    const hash = await sha256(await file.arrayBuffer());
    const path = `${id}/${hash}.${type.split("/")[1]}`;
    const bucket = db.storage.from("moa-artwork");
    const upload = await bucket.upload(path, file, { contentType: type });
    if (upload.error) {
      const status = "statusCode" in upload.error ? String(upload.error.statusCode) : "";
      if (status !== "409" && status !== "400") throw upload.error;
      // Storage versions report duplicate uploads as either 400 or 409.
      const stored = await bucket.info(path);
      if (stored.error || !stored.data) throw upload.error;
    }
    const { data: saved, error } = await db.rpc("register_guestbook_entry", {
      p_id: id, p_author_id: user.id, p_fingerprint: await fingerprint([nickname, message, kind, type, hash]),
      p_nickname: nickname, p_message: message, p_image_type: kind, p_image_path: path,
    });
    // Keep the object on failure. A concurrent request or later retry may reference it.
    if (error) throw error;
    if (saved !== true) return reply(409, { error: "Request ID conflict" });
    return reply(200, { id });
  } catch (error) {
    console.error(error);
    return reply(500, { error: "Save failed" });
  }
});
