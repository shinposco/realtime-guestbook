type LinkType = "email" | "recovery";

export type EmailLink = { type: LinkType } & (
  { tokenHash: string } |
  { accessToken: string; refreshToken: string }
);

export function readEmailLink(hash: string): EmailLink | "expired" | null {
  const params = new URLSearchParams(hash.slice(1));
  if (params.has("error_code") && params.has("error")) return "expired";

  const kind = params.get("type");
  if (kind !== "email" && kind !== "signup" && kind !== "recovery") return null;
  const type = kind === "recovery" ? "recovery" : "email";
  const tokenHash = params.get("token_hash");
  if (tokenHash) return { type, tokenHash };

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  return accessToken && refreshToken ? { type, accessToken, refreshToken } : null;
}
