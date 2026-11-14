import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "모아 · 전자 방명록",
  description: "사진과 손그림으로 오늘의 흔적을 남기는 방명록",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}
