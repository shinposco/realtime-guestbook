import Link from "next/link";
import type { ReactNode } from "react";

export function Frame({ page, children }: { page: "write" | "board"; children: ReactNode }) {
  return (
    <>
      <header className="border-b border-line bg-paper">
        <div className="wrap flex min-h-20 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 text-xl font-black tracking-tight">
            <span className="brand-mark" aria-hidden="true">✳</span> 모아
          </Link>
          <nav aria-label="방명록 메뉴" className="flex gap-1 rounded-full border border-line bg-white/50 p-1 text-sm font-semibold">
            <Link href="/" className="nav-link" aria-current={page === "write" ? "page" : undefined}>방명록 쓰기</Link>
            <Link href="/board" className="nav-link" aria-current={page === "board" ? "page" : undefined}>보드 보기</Link>
          </nav>
        </div>
      </header>
      <main className="wrap py-10 sm:py-14">{children}</main>
    </>
  );
}
