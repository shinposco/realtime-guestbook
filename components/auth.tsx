"use client";

import { createContext, useContext, useEffect, useId, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { isAuthError } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { readEmailLink } from "../lib/auth-links";
import { supabase } from "../lib/supabase";

const AuthContext = createContext<{ user: User | null | undefined; unavailable: boolean }>({
  user: undefined, unavailable: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>();
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const { pathname, hash } = window.location;
    // The hosted Auth service may redirect older links to the configured Site URL.
    if (pathname !== "/auth/confirm" && pathname !== "/auth/confirm/" && readEmailLink(hash)) {
      window.location.replace(`/auth/confirm${hash}`);
      return;
    }
    try {
      const { data: { subscription } } = supabase().auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });
      return () => subscription.unsubscribe();
    } catch {
      setUnavailable(true);
    }
  }, []);

  return <AuthContext.Provider value={{ user, unavailable }}>{children}</AuthContext.Provider>;
}

export function useGuestbookAuth() {
  const { user, unavailable } = useContext(AuthContext);
  return {
    user, unavailable,
    authorId: user?.role === "authenticated" && !user.is_anonymous && user.email && user.email_confirmed_at
      ? user.id : undefined,
  };
}

type Mode = "login" | "signup" | "reset" | "resend";
const titles = { login: "로그인", signup: "회원가입", reset: "재설정 링크 보내기", resend: "가입 확인 메일 다시 보내기" };

function authMessage(error: unknown, mode: Mode) {
  if (isAuthError(error)) {
    if (error.code === "email_not_confirmed") return "가입 메일에서 이메일을 확인해 주세요. 메일을 찾을 수 없으면 가입 확인 메일을 다시 요청하세요.";
    if (error.code === "invalid_credentials") return "이메일과 비밀번호를 확인해 주세요. 가입에 사용한 비밀번호가 기억나지 않으면 재설정해 주세요.";
    if (error.code === "weak_password") return "더 강한 비밀번호를 입력해 주세요.";
    if (error.code === "email_address_not_authorized") return "현재 이 주소로 인증 메일을 보낼 수 없어요. 서비스 관리자에게 문의해 주세요.";
    if (error.code === "signup_disabled" || error.code === "email_provider_disabled") return "현재 이메일 가입을 받지 않아요. 서비스 관리자에게 문의해 주세요.";
    if (error.status === 429) return "메일 요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.";
  }
  return mode === "login" ? "로그인하지 못했어요. 잠시 후 다시 시도해 주세요."
    : "요청을 처리하지 못했어요. 입력 내용을 확인하고 잠시 후 다시 시도해 주세요.";
}

export function AccountControls({ action }: { action?: string }) {
  const { user, authorId, unavailable } = useGuestbookAuth();
  const formId = useId();
  const [mode, setMode] = useState<Mode>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function changeMode(next?: Mode) {
    setMode(next);
    setPassword("");
    setError("");
    setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mode || busy) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const auth = supabase().auth;
      const callback = new URL("/auth/confirm", window.location.origin).href;
      const address = email.trim();
      if (mode === "login") {
        const { error } = await auth.signInWithPassword({ email: address, password });
        if (error) throw error;
        changeMode();
      } else if (mode === "signup") {
        const { error } = await auth.signUp({ email: address, password, options: { emailRedirectTo: callback } });
        if (error) throw error;
        setNotice("새 계정이면 가입 확인 메일이 도착합니다. 이미 가입했다면 로그인하거나 비밀번호를 재설정해 주세요.");
      } else if (mode === "resend") {
        const { error } = await auth.resend({ type: "signup", email: address, options: { emailRedirectTo: callback } });
        if (error) throw error;
        setNotice("이메일 확인을 기다리는 계정이라면 확인 메일이 다시 도착합니다.");
      } else {
        const { error } = await auth.resetPasswordForEmail(address, { redirectTo: callback });
        if (error) throw error;
        setNotice("가입한 이메일이라면 비밀번호 재설정 링크가 도착합니다.");
      }
    } catch (error) {
      setError(authMessage(error, mode));
    } finally {
      setPassword("");
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    changeMode();
    try {
      const { error } = await supabase().auth.signOut({ scope: "local" });
      if (error) throw error;
      setEmail("");
    } catch {
      setError("로그아웃하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (unavailable) return <p role="status" className="text-sm text-stone-600">로그인 서비스를 사용할 수 없어요.</p>;
  if (user === undefined) return <p role="status" className="text-sm text-stone-600">로그인 상태 확인 중…</p>;

  return (
    <div className="text-sm">
      {user ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 break-all text-stone-600">
            {authorId ? "로그인됨" : "이메일 인증을 마친 계정으로 다시 로그인해 주세요."}
          </span>
          <button className="tool" type="button" disabled={busy} onClick={signOut}>로그아웃</button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {action && <p className="text-stone-600">{action}려면 로그인해 주세요.</p>}
            <button className="secondary" type="button" aria-expanded={!!mode} aria-controls={formId}
              disabled={busy} onClick={() => changeMode(mode ? undefined : "login")}>
              {mode ? "로그인 화면 닫기" : "로그인"}
            </button>
          </div>
          <div id={formId} hidden={!mode}>
            {mode && (
              <form className="mt-3 rounded-xl border border-line bg-white p-4" aria-label={titles[mode]} onSubmit={submit}>
                <fieldset disabled={busy} className="grid gap-3">
                  <label className="grid gap-1 font-semibold">이메일
                    <input className="field" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
                  </label>
                  {(mode === "login" || mode === "signup") && (
                    <label className="grid gap-1 font-semibold">비밀번호
                      <input className="field" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required
                        minLength={mode === "signup" ? 8 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} />
                    </label>
                  )}
                  <button className="primary" type="submit">{busy ? "처리 중…" : titles[mode]}</button>
                  <div className="flex flex-wrap gap-2">
                    {mode !== "login" && <button className="tool" type="button" onClick={() => changeMode("login")}>로그인으로 돌아가기</button>}
                    {mode === "login" && <button className="tool" type="button" onClick={() => changeMode("signup")}>회원가입</button>}
                    {mode === "login" && <button className="tool" type="button" onClick={() => changeMode("reset")}>비밀번호 재설정</button>}
                    {(mode === "login" || mode === "signup") && <button className="tool" type="button" onClick={() => changeMode("resend")}>가입 확인 메일 재발송</button>}
                  </div>
                </fieldset>
              </form>
            )}
          </div>
        </>
      )}
      {notice && <p role="status" className="mt-2 text-moss">{notice}</p>}
      {error && <p role="alert" className="mt-2 text-[#9b352a]">{error}</p>}
    </div>
  );
}
