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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(405, { error: "Method not allowed" });
  if (Number(request.headers.get("content-length")) > limits.photo + 65536) {
    return reply(413, { error: "Payload too large" });
  }

  try {
    const form = await request.formData();
    const action = field(form, "action");
    const id = field(form, "id");
    const nickname = field(form, "nickname") || "익명";
    if (!uuid.test(id) || nickname.length > limits.nickname) return reply(400, { error: "Invalid author or ID" });

    if (action === "comment") {
      const entryId = field(form, "entryId");
      const body = field(form, "body");
      if (!uuid.test(entryId) || !body || body.length > limits.comment) return reply(400, { error: "Invalid comment" });
      const { error } = await db.from("comments").upsert(
        { id, entry_id: entryId, nickname, body },
        { onConflict: "id", ignoreDuplicates: true },
      );
      if (error) {
        if (error.code === "23503") return reply(404, { error: "Entry not found" });
        throw error;
      }
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

    const existing = await db.from("entries").select("id").eq("id", id).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return reply(200, { id });

    // A content hash makes upload retries safe, including overlapping requests.
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
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
    const saved = await db.from("entries").upsert(
      { id, nickname, message, image_type: kind, image_path: path },
      { onConflict: "id", ignoreDuplicates: true },
    ).select("id").maybeSingle();
    if (saved.error) throw saved.error;
    if (!saved.data) {
      const winner = await db.from("entries").select("image_path").eq("id", id).single();
      if (!winner.error && winner.data.image_path !== path) await bucket.remove([path]);
    }
    return reply(200, { id });
  } catch (error) {
    console.error(error);
    return reply(500, { error: "Save failed" });
  }
});
