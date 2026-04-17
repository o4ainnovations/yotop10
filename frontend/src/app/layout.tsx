import type { Metadata } from "next";
import Script from "next/script";
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
      <body className="min-h-full flex flex-col">{children}</body>
      <Script src="//cdn.jsdelivr.net/npm/eruda" onLoad={() => {
        // @ts-expect-error
        window.eruda.init();
      }} />
    </html>
  );
}
