import type { Metadata } from "next";
import "./globals.css";
import Eruda from "./Eruda";
import AuthInitializer from "@/components/AuthInitializer";
import ToastContainer from "@/components/Toast";
import AnalyticsBeacon from "@/components/AnalyticsBeacon";
import { DynamicIsland } from "@/components/DynamicIsland";
import DesktopTopBar from "@/components/DesktopTopBar";

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
        <div className="lg:hidden">
          <DynamicIsland />
        </div>
      </body>
    </html>
  );
}
