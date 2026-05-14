import type { Metadata } from "next";
import "./globals.css";
import Eruda from "./Eruda";
import AuthInitializer from "@/components/AuthInitializer";
import ToastContainer from "@/components/Toast";
import HeaderBells from "@/components/HeaderBells";
import AnalyticsBeacon from "@/components/AnalyticsBeacon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FloatingDock } from "@/components/FloatingDock";
import { NavUserAvatar } from "@/components/NavUserAvatar";
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
            <Link href="/" className="flex items-baseline gap-0 text-lg">
              <span className="font-light text-zinc-400">Yo</span>
              <span className="font-extrabold bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
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
        <FloatingDock />
        <Eruda />
        <ToastContainer />
        <AnalyticsBeacon />
      </body>
    </html>
  );
}
