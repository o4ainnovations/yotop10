import type { Metadata } from "next";
import "./globals.css";
import Eruda from "./Eruda";
import AuthInitializer from "@/components/AuthInitializer";
import ToastContainer from "@/components/Toast";
import HeaderBells from "@/components/HeaderBells";
import AnalyticsBeacon from "@/components/AnalyticsBeacon";

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
      <body className="min-h-full flex flex-col">
        <header style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 20px', borderBottom: '1px solid #eee', background: '#fafafa', position: 'sticky', top: 0, zIndex: 50 }}>
          <HeaderBells />
        </header>
        <AuthInitializer />
        {children}
        <Eruda />
        <ToastContainer />
        <AnalyticsBeacon />
      </body>
    </html>
  );
}
