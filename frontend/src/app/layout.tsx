import type { Metadata } from "next";
import "./globals.css";
import Eruda from "./Eruda";
import AuthInitializer from "@/components/AuthInitializer";
import ToastContainer from "@/components/Toast";
import AnalyticsBeacon from "@/components/AnalyticsBeacon";
import { DynamicIsland } from "@/components/DynamicIsland";
import DesktopTopBar from "@/components/DesktopTopBar";
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";

export const metadata: Metadata = {
  title: "YoTop10 — Fact Mine. Debate Ground.",
  description: "The open catalog of ranked lists.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="h-full bg-[#05050f] text-[#eaeaef]">
        <DesktopTopBar />
        <AuthInitializer />
        <main className="flex-1 pt-14">{children}</main>
        <Eruda />
        <ToastContainer />
        <AnalyticsBeacon />

        {/* Hanging + button — mobile only, positioned above DynamicIsland */}
        <Link
          href="/submit"
          className="lg:hidden fixed bottom-24 right-6 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/30 transition hover:scale-110 active:scale-95"
          aria-label="Submit"
        >
          <Icon name="Plus" size={24} />
        </Link>

        <div className="lg:hidden">
          <DynamicIsland />
        </div>
      </body>
    </html>
  );
}
