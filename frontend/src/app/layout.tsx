import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YoTop10 - Top 10 Lists Platform",
  description: "An open Wikipedia-style platform for top 10 lists with a social UI. Anyone can browse, submit, and comment without creating an account.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script src="//cdn.jsdelivr.net/npm/eruda"></script>
        <script>eruda.init();</script>
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
