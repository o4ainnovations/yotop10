import type { Metadata } from "next";
import "./globals.css";
import Eruda from "./Eruda";
import AuthInitializer from "@/components/AuthInitializer";
import ToastContainer from "@/components/Toast";
import AnalyticsBeacon from "@/components/AnalyticsBeacon";
import { DynamicIsland } from "@/components/DynamicIsland";
import DesktopTopBar from "@/components/DesktopTopBar";
import { SlideMenuPanel } from "@/components/SlideMenuPanel";
import SWRegister from "@/components/SWRegister";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";

export const metadata: Metadata = {
  title: "YoTop10 — Fact Mine. Debate Ground.",
  description: "The open catalog of ranked lists.",
  manifest: "/manifest.json",
  themeColor: "#05050f",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "YoTop10",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var theme = localStorage.getItem('yotop10_theme');
              if (theme === 'light') {
                document.documentElement.classList.add('light');
              }
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className="h-full bg-[var(--color-bg)] text-[#eaeaef]" suppressHydrationWarning>
        <DesktopTopBar />
        <SlideMenuPanel />
        <AuthInitializer />
        <main className="flex-1 pt-14">{children}</main>
        <Eruda />
        <ToastContainer />
        <AnalyticsBeacon />
        <SWRegister />
        <PWAInstallPrompt />

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
