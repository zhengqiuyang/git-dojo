import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Git 练功房 — 新手友好的 Git 闯关学习平台",
  description: "在真实沙盒里敲 git 命令闯关学习，分支图实时可视化，配套场景速查手册。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
