import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "인생은 객관식 — Jev가 고르는 객관식",
  description: "상황과 질문을 넣으면 Jev가 확률로 답합니다. 동전을 던져 구경할 수도 있어요.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
