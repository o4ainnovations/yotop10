import type { Metadata } from "next";
import "./globals.css";
import Eruda from "./Eruda";
import AuthInitializer from "@/components/AuthInitializer";
import ToastContainer from "@/components/Toast";
import HeaderBells from "@/components/HeaderBells";
import AnalyticsBeacon from "@/components/AnalyticsBeacon";
import Link from "next/link";

export const metadata: Metadata = {
  title: "YoTop10 — Fact Mine. Debate Ground.",
  description: "The open catalog of ranked lists.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="h-full bg-zinc-950 text-zinc-100">
        <nav className="sticky top-0 z-50 border-b border-white/5 bg-zinc-950/70 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3">
            <div className="flex items-center gap-4 sm:gap-8">
              <Link href="/" className="text-base font-bold tracking-tight sm:text-lg">
                <span className="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
                  YoTop10
                </span>
              </Link>
              <div className="hidden gap-1 text-xs font-medium text-zinc-400 sm:flex sm:text-sm">
                <Link href="/" className="rounded-lg px-2.5 py-1.5 transition hover:bg-white/5 hover:text-white sm:px-3">Feed</Link>
                <Link href="/categories" className="rounded-lg px-2.5 py-1.5 transition hover:bg-white/5 hover:text-white sm:px-3">Categories</Link>
                <Link href="/search" className="rounded-lg px-2.5 py-1.5 transition hover:bg-white/5 hover:text-white sm:px-3">Search</Link>
                <Link href="/submit" className="rounded-lg px-2.5 py-1.5 transition hover:bg-white/5 hover:text-white sm:px-3">Submit</Link>
              </div>
            </div>
            <HeaderBells />
          </div>
          {/* Mobile nav bar */}
          <div className="flex gap-0 border-t border-white/5 px-3 py-1.5 sm:hidden">
            <Link href="/" className="flex-1 rounded-md py-2 text-center text-[11px] font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white">Feed</Link>
            <Link href="/categories" className="flex-1 rounded-md py-2 text-center text-[11px] font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white">Categories</Link>
            <Link href="/search" className="flex-1 rounded-md py-2 text-center text-[11px] font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white">Search</Link>
            <Link href="/submit" className="flex-1 rounded-md py-2 text-center text-[11px] font-bold text-orange-400 transition hover:bg-orange-500/10">Submit</Link>
          </div>
        </nav>
        <AuthInitializer />
        <main className="flex-1">{children}</main>
        <Eruda />
        <ToastContainer />
        <AnalyticsBeacon />
      </body>
    </html>
  );
}
