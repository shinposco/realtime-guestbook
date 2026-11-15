"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { readEmailLink } from "../../../lib/auth-links";
import type { EmailLink } from "../../../lib/auth-links";
import { createGuestbookClient } from "../../../lib/supabase";

export default function ConfirmPage() {
  const [link, setLink] = useState<EmailLink | null>();
  const [complete, setComplete] = useState<EmailLink["type"]>();
  const [recovering, setRecovering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const recoveryClient = useRef<ReturnType<typeof createGuestbookClient>>();

  useEffect(() => {
    const result = readEmailLink(window.location.hash);
    if (result === "expired") {
      setError("링크가 만료됐거나 이미 사용됐어요. 가입을 마쳤다면 로그인하고, 비밀번호를 잊었다면 새 재설정 링크를 요청해 주세요.");
      setLink(null);
    } else {
      setLink(result);
    }
  }, []);

  async function verifyLink() {
    if (!link || busy) return;
    setBusy(true);
    setError("");
    try {
      // Recovery must update the email link's account even if another account is logged in.
      const client = createGuestbookClient(false);
      const { data, error } = "tokenHash" in link
        ? await client.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type })
        : await client.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
      if (error || !data.session) throw error ?? new Error("Missing verification session");
      window.history.replaceState(window.history.state, "", window.location.pathname);
      setLink(null);
      if (link.type === "recovery") {
        recoveryClient.current = client;
        setRecovering(true);
      } else {
        setComplete("email");
      }
    } catch {
      setError("링크를 확인할 수 없어요. 링크가 만료됐다면 새로 요청해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = recoveryClient.current;
    if (!client || busy) return;
    const fields = new FormData(event.currentTarget);
    const password = String(fields.get("password") ?? "");
    if (password.length < 8 || password !== fields.get("confirmation")) {
      setError("8자 이상의 비밀번호를 두 칸에 동일하게 입력해 주세요.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      recoveryClient.current = undefined;
      setRecovering(false);
      setComplete("recovery");
    } catch {
      setError("비밀번호를 변경하지 못했어요. 기존과 다른 비밀번호로 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap py-10 sm:py-14">
      <section className="panel mx-auto max-w-md space-y-4" aria-labelledby="confirm-title">
        <h1 id="confirm-title" className="text-xl font-extrabold">
          {recovering || link?.type === "recovery" || complete === "recovery" ? "비밀번호 재설정" : "이메일 인증"}
        </h1>
        {complete && <p role="status">{complete === "recovery" ? "비밀번호를 변경했어요. 새 비밀번호로 로그인해 주세요."
          : "이메일 인증이 완료됐어요. 방명록 화면에서 로그인해 주세요."}</p>}
        {!complete && !recovering && (
          link ? <button className="primary" type="button" disabled={busy} onClick={verifyLink}>
            {busy ? "확인 중…" : link.type === "recovery" ? "재설정 링크 확인" : "이메일 확인"}
          </button> : !error && <p role="status">{link === undefined ? "링크 확인 중…" : "인증 메일에 있는 링크를 다시 열어 주세요."}</p>
        )}
        {recovering && (
          <form onSubmit={changePassword}>
            <fieldset disabled={busy} className="grid gap-3">
              <label className="grid gap-1">새 비밀번호 (8자 이상)
                <input required minLength={8} className="field" type="password" name="password" autoComplete="new-password" />
              </label>
              <label className="grid gap-1">새 비밀번호 확인
                <input required minLength={8} className="field" type="password" name="confirmation" autoComplete="new-password" />
              </label>
              <button className="primary" type="submit">{busy ? "저장 중…" : "비밀번호 변경"}</button>
            </fieldset>
          </form>
        )}
        {error && <p role="alert" className="text-sm text-[#9b352a]">{error}</p>}
        <Link className="secondary" href="/">방명록으로 돌아가기</Link>
      </section>
    </main>
  );
}
