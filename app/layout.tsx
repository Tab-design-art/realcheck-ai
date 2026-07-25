import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "鉴真 AI｜图片真实性审核平台",
  description: "面向设计与电商团队的图片 AI 感检测、问题定位与审核报告平台。",
  openGraph: {
    title: "鉴真 AI｜图片真实性审核平台",
    description: "定位问题 · 解释原因 · 给出建议",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "鉴真 AI｜图片真实性审核平台",
    description: "定位问题 · 解释原因 · 给出建议",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
