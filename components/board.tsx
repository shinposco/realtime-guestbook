"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AccountControls, useGuestbookAuth } from "./auth";
import { Artwork } from "./artwork";
import { Frame } from "./frame";
import { limits, pendingWrite, readBoard, readComments, saveComment, subscribeToBoard, subscribeToComments, writeErrorMessage } from "../lib/guestbook";
import type { Comment, Entry, PendingWrite } from "../lib/guestbook";

const paperColors = ["#f8eab3", "#deebd6", "#f4dce2", "#e6e2f6", "#dcebf0"];
const dateFormat = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });

function Details({ entry, dismiss, onSave }: {
  entry: Entry;
  dismiss: () => void;
  onSave: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { authorId } = useGuestbookAuth();
  const requestId = useRef<PendingWrite>();
  const commentRevision = useRef(0);
  const [comments, setComments] = useState<Comment[]>();
  const [readError, setReadError] = useState(false);
  const [nickname, setNickname] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const entryId = entry.id;
  const refreshComments = useCallback(async () => {
    const revision = ++commentRevision.current;
    try {
      const next = await readComments(entryId);
      if (revision !== commentRevision.current) return;
      setComments(next);
      setReadError(false);
    } catch {
      if (revision === commentRevision.current) setReadError(true);
    }
  }, [entryId]);

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToComments(entryId, refreshComments);
    void refreshComments();
    return () => {
      ++commentRevision.current;
      unsubscribe();
    };
  }, [entryId, refreshComments]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !authorId) return;
    if (!body.trim()) {
      setError("댓글을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { id } = requestId.current = pendingWrite(requestId.current, authorId);
      await saveComment({
        id, entryId: entry.id,
        nickname: nickname.trim() || "익명", body: body.trim(),
      }, authorId);
      requestId.current = undefined;
      setBody("");
      await Promise.all([onSave(), refreshComments()]);
    } catch (error) {
      setError(writeErrorMessage(error, "댓글을 저장하지 못했어요. 다시 시도해 주세요."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} className="detail" aria-labelledby="detail-title" onClose={dismiss} onClick={(event) => {
      if (event.target === event.currentTarget) dialog.current?.close();
    }}>
      <div className="p-5 sm:p-7">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="detail-title" className="break-all text-xl font-extrabold">{entry.nickname}님의 포스트잇</h2>
            <time dateTime={new Date(entry.createdAt).toISOString()} className="mt-1 block text-xs text-stone-600">{dateFormat.format(entry.createdAt)}</time>
          </div>
          <button className="tool shrink-0" type="button" onClick={() => dialog.current?.close()}>닫기 <span aria-hidden="true">×</span></button>
        </div>
        <Artwork image={entry.image} alt={entry.kind === "photo" ? "첨부 사진" : "손그림"} className="h-64 w-full rounded-2xl bg-white object-contain sm:h-80" />
        {entry.message && <p className="mt-4 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{entry.message}</p>}
        <section className="mt-6 border-t border-line pt-5">
          <h3 className="font-extrabold">댓글 <span aria-live="polite">{comments?.length ?? entry.commentCount}</span></h3>
          {readError && <p role="alert" className="mt-2 text-sm text-[#9b352a]">댓글을 불러오지 못했어요. <button type="button" className="tool" onClick={refreshComments}>다시 시도</button></p>}
          {!comments && !readError && <p role="status" className="mt-2 text-sm text-stone-600">댓글을 불러오는 중…</p>}
          {!!comments?.length && (
            <ul className="mt-3 grid gap-2" aria-label="댓글 목록">
              {comments.map((comment) => (
                <li key={comment.id} className="rounded-xl bg-white px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <strong className="break-all">{comment.nickname}</strong>
                    <time dateTime={new Date(comment.createdAt).toISOString()} className="text-xs text-stone-600">{dateFormat.format(comment.createdAt)}</time>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{comment.body}</p>
                </li>
              ))}
            </ul>
          )}
          {comments?.length === 0 && <p className="mt-2 text-sm text-stone-600">첫 댓글을 남겨 보세요.</p>}
          <div className="mt-5"><AccountControls action="댓글을 남기" /></div>
          <form onSubmit={submit} onChange={() => { requestId.current = undefined; }} className="mt-5">
            <fieldset disabled={saving}>
              <label htmlFor="comment-nickname" className="form-label">닉네임 <span>선택</span></label>
              <input id="comment-nickname" className="field" placeholder="익명" maxLength={limits.nickname} value={nickname} onChange={(event) => setNickname(event.target.value)} />
              <label htmlFor="comment-body" className="form-label mt-3">댓글 내용</label>
              <textarea id="comment-body" className="field min-h-20 resize-y" required maxLength={limits.comment} value={body} onChange={(event) => setBody(event.target.value)} placeholder="포스트잇에 답장을 남겨 보세요." />
              {error && <p role="alert" className="mt-2 text-sm text-[#9b352a]">{error}</p>}
              <button type="submit" disabled={!authorId} className="primary mt-3">{saving ? "저장 중…" : "댓글 남기기"}</button>
            </fieldset>
          </form>
        </section>
      </div>
    </dialog>
  );
}

export function Board() {
  const [entries, setEntries] = useState<Entry[]>();
  const [selected, setSelected] = useState<string>();
  const [highlight, setHighlight] = useState<string>();
  const [error, setError] = useState(false);
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++revision.current;
    try {
      const next = await readBoard();
      if (current !== revision.current) return;
      setEntries(next);
      setError(false);
    } catch {
      if (current === revision.current) setError(true);
    }
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("new");
    setHighlight(id ?? undefined);
    const timer = id ? window.setTimeout(() => setHighlight(undefined), 4500) : undefined;
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribeToBoard(refresh);
    } catch {
      setError(true);
    }
    void refresh();
    return () => {
      ++revision.current;
      unsubscribe?.();
      window.clearTimeout(timer);
    };
  }, [refresh]);

  const selectedEntry = entries?.find((entry) => entry.id === selected);

  return (
    <Frame page="board">
      <section className="mb-9 flex flex-wrap items-end justify-between gap-5 sm:mb-11">
        <div>
          <h1 className="display-title">포스트잇 보드<span className="text-[#ad5339]">.</span></h1>
          <p className="mt-4 text-sm leading-7 text-stone-600 sm:text-base">한 장씩 열어 보고, 댓글로 답장을 남겨 보세요.</p>
        </div>
        <Link className="primary" href="/">+ 포스트잇 남기기</Link>
      </section>
      <section aria-label="계정" className="panel mb-6"><AccountControls /></section>
      {error && (
        <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-5 py-3 text-sm">
          <p>방명록을 불러오지 못했어요.</p>
          <button type="button" className="secondary" onClick={refresh}>다시 시도</button>
        </div>
      )}
      {!entries && !error && <p role="status" className="panel text-sm">포스트잇을 불러오는 중…</p>}
      {entries?.length === 0 && (
        <section className="empty-board">
          <span aria-hidden="true" className="empty-note">✳</span>
          <h2 className="mt-7 text-xl font-extrabold">아직 붙은 포스트잇이 없어요.</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">첫 사진이나 손그림으로 보드를 채워 주세요.</p>
        </section>
      )}
      {!!entries?.length && (
        <ul className="grid gap-x-6 gap-y-8 pt-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="방명록 포스트잇">
          {entries.map((entry, index) => (
            <li key={entry.id} className="min-w-0">
              <button type="button" onClick={() => setSelected(entry.id)} className="note group" data-new={highlight === entry.id || undefined}
                style={{ backgroundColor: paperColors[parseInt(entry.id[0], 16) % paperColors.length], rotate: index % 2 ? "0.65deg" : "-0.65deg" }}>
                <Artwork image={entry.image} alt={entry.kind === "photo" ? "첨부 사진" : "손그림"} className={`aspect-[16/10] w-full rounded-lg bg-white/70 ${entry.kind === "photo" ? "object-cover" : "object-contain"}`} />
                <p className="mt-4 min-h-12 text-base font-bold leading-6 line-clamp-2 [overflow-wrap:anywhere]">{entry.message || (entry.kind === "photo" ? "사진으로 남긴 방명록" : "손그림으로 남긴 방명록")}</p>
                <span className="mt-3 flex items-start justify-between gap-2 border-t border-black/10 pt-3 text-sm text-stone-700">
                  <span className="min-w-0 truncate font-semibold">{entry.nickname}</span>
                  <span className="shrink-0">댓글 {entry.commentCount} <span aria-hidden="true">↗</span></span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selectedEntry && <Details key={selectedEntry.id} entry={selectedEntry} dismiss={() => setSelected(undefined)} onSave={refresh} />}
    </Frame>
  );
}
