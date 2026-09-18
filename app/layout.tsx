import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "巴塞罗那德国馆 · Barcelona Pavilion",
  description: "探索巴塞罗那德国馆的连续空间：完整三维建筑、屋面展开、构件分解与竖向剖切。",
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
