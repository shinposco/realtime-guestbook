"use client";

import { useCallback, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AccountControls, useGuestbookAuth } from "./auth";
import { Artwork } from "./artwork";
import { Drawing } from "./drawing";
import { Frame } from "./frame";
import { limits, pendingWrite, photoTypes, saveEntry, writeErrorMessage } from "../lib/guestbook";
import type { MediaKind, PendingWrite } from "../lib/guestbook";

export function Compose() {
  const router = useRouter();
  const { authorId } = useGuestbookAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const requestId = useRef<PendingWrite>();
  const [mode, setMode] = useState<MediaKind>("photo");
  const [photo, setPhoto] = useState<File | null>(null);
  const [drawing, setDrawing] = useState<Promise<Blob | null>>(() => Promise.resolve(null));
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const changeDrawing = useCallback((image: Promise<Blob | null>) => {
    requestId.current = undefined;
    setDrawing(image);
  }, []);

  function choosePhoto(file: File | undefined) {
    if (!file) return;
    if (!photoTypes.includes(file.type) || file.size === 0 || file.size > limits.photo) {
      setError("5 MB 이하의 JPG, PNG, WebP 사진을 선택해 주세요.");
      return;
    }
    setPhoto(file);
    requestId.current = undefined;
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !authorId) return;
    setSaving(true);
    setError("");
    try {
      const image = mode === "photo" ? photo : await drawing;
      if (!image) {
        setError(mode === "photo" ? "첨부할 사진을 선택해 주세요." : "캔버스에 그림을 그려 주세요.");
        setSaving(false);
        return;
      }
      const { id } = requestId.current = pendingWrite(requestId.current, authorId);
      await saveEntry({ id, image, kind: mode, nickname: nickname.trim() || "익명", message: message.trim() }, authorId);
      router.push(`/board?new=${id}`);
    } catch (error) {
      setError(writeErrorMessage(error, "방명록을 저장하지 못했어요. 다시 시도해 주세요."));
      setSaving(false);
    }
  }

  return (
    <Frame page="write">
      <section className="mb-9 sm:mb-11">
        <h1 className="display-title">오늘의 흔적을<br className="sm:hidden" /> 남겨요<span className="text-[#ad5339]">.</span></h1>
        <p className="mt-4 text-sm leading-7 text-stone-600 sm:text-base">사진 한 장이나 손그림으로 지금 이 순간을 기록해 보세요.</p>
      </section>
      <section aria-label="계정" className="panel mb-6">
        <AccountControls action="방명록을 남기" />
      </section>
      <form onSubmit={submit} onChange={() => { requestId.current = undefined; }}>
        <fieldset disabled={saving} className="grid min-w-0 items-start gap-6 lg:grid-cols-[1.55fr_1fr]">
          <section className="panel min-w-0">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold">사진 또는 손그림</h2>
              <div className="flex gap-1 rounded-full bg-[#f0ede3] p-1" role="group" aria-label="이미지 등록 방식">
                <button type="button" className="mode-button" aria-pressed={mode === "photo"} onClick={() => { requestId.current = undefined; setMode("photo"); setError(""); }}>사진 첨부</button>
                <button type="button" className="mode-button" aria-pressed={mode === "drawing"} onClick={() => { requestId.current = undefined; setMode("drawing"); setError(""); }}>손그림</button>
              </div>
            </div>
            <div hidden={mode !== "photo"}>
              <input hidden ref={fileInput} type="file" accept={photoTypes.join(",")} onChange={(event) => {
                choosePhoto(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }} />
              <div className="upload-area" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
                event.preventDefault();
                if (!saving) choosePhoto(event.dataTransfer.files[0]);
              }}>
                {photo ? (
                  <>
                    <Artwork image={photo} alt="첨부 사진 미리보기" className="h-52 w-full rounded-xl bg-white object-contain" />
                    <div className="mt-3 flex w-full flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{photo.name}</span>
                      <button className="tool" type="button" onClick={() => fileInput.current?.click()}>사진 변경</button>
                      <button className="tool" type="button" onClick={() => { requestId.current = undefined; setPhoto(null); setError(""); }}>삭제</button>
                    </div>
                  </>
                ) : (
                  <>
                    <span aria-hidden="true" className="mb-4 grid size-14 place-items-center rounded-2xl border border-[#e6dfcf] bg-[#f7efda] text-2xl text-moss">↥</span>
                    <button className="secondary" type="button" onClick={() => fileInput.current?.click()}>사진 선택</button>
                    <p className="mt-3 text-center text-xs leading-5 text-stone-600">여기로 끌어 놓아도 돼요<br />JPG, PNG, WebP · 최대 5 MB</p>
                  </>
                )}
              </div>
            </div>
            <div hidden={mode !== "drawing"}><Drawing onChange={changeDrawing} /></div>
          </section>
          <section className="panel">
            <h2 className="mb-5 text-lg font-extrabold">방명록 내용</h2>
            <label className="form-label" htmlFor="nickname">닉네임 <span>선택</span></label>
            <input id="nickname" className="field" maxLength={limits.nickname} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="비워 두면 익명으로 남아요" />
            <label className="form-label mt-5" htmlFor="message">한마디 <span>선택</span></label>
            <textarea id="message" className="field min-h-28 resize-y" maxLength={limits.message} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="사진이나 그림에 담긴 이야기를 들려주세요." />
            <p className="mt-1 text-right text-xs tabular-nums text-stone-600">{message.length}/{limits.message}</p>
            {error && <p role="alert" className="mt-3 text-sm text-[#9b352a]">{error}</p>}
            <button className="primary mt-5 w-full" disabled={!authorId} type="submit">{saving ? "저장 중…" : "방명록 남기기 →"}</button>
          </section>
        </fieldset>
      </form>
    </Frame>
  );
}
