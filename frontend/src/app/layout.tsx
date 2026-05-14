import type { Metadata } from "next";
import "./globals.css";
import Eruda from "./Eruda";
import AuthInitializer from "@/components/AuthInitializer";
import ToastContainer from "@/components/Toast";
import HeaderBells from "@/components/HeaderBells";
import AnalyticsBeacon from "@/components/AnalyticsBeacon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavUserAvatar } from "@/components/NavUserAvatar";
import { DynamicIsland } from "@/components/DynamicIsland";
import { Icon } from "@/components/icons/Icon";
import Link from "next/link";

export const metadata: Metadata = {
  title: "YoTop10 — Fact Mine. Debate Ground.",
  description: "The open catalog of ranked lists.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="h-full bg-zinc-950 text-zinc-100">
        <nav className="sticky top-0 z-50 border-b border-white/5 bg-zinc-950/60 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-2.5 sm:px-6">
            <Link href="/" className="flex items-baseline gap-0">
              <span className="font-accent gradient-text text-2xl">YO</span>
              <span className="font-display text-2xl text-white dark:text-black tracking-tight">
                Top10
              </span>
            </Link>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                href="/search"
                className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
              >
                <Icon name="Search" size={18} />
              </Link>
              <ThemeToggle />
              <NavUserAvatar />
              <HeaderBells />
            </div>
          </div>
        </nav>
        <AuthInitializer />
        <main className="flex-1">{children}</main>
        <Eruda />
        <ToastContainer />
        <AnalyticsBeacon />
        <DynamicIsland />
      </body>
    </html>
  );
}
