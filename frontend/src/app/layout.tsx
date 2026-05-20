import type { Metadata } from "next";
import { Suspense } from "react";
import { Anton, Monoton } from "next/font/google";
import "./globals.css";
import Eruda from "./Eruda";
import AuthInitializer from "@/components/AuthInitializer";
import ToastContainer from "@/components/Toast";
import AnalyticsBeacon from "@/components/AnalyticsBeacon";
import { DynamicIsland } from "@/components/DynamicIsland";
import DesktopTopBar from "@/components/DesktopTopBar";
import { SlideMenuRouter } from "@/components/SlideMenuRouter";
import { FloatingDock } from "@/components/FloatingDock";
import SWRegister from "@/components/SWRegister";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

const anton = Anton({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--font-display' });
const monoton = Monoton({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--font-accent' });

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
                document.documentElement.classList.add('light-mode');
              }
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className={`${anton.variable} ${monoton.variable} h-full bg-[var(--color-bg)] text-[#eaeaef]`} suppressHydrationWarning>
        {/* Critical: hydrates first — hamburger, search, logo */}
        <DesktopTopBar />
        <SlideMenuRouter />
        <FloatingDock />

        {/* Non-critical: deferred hydration */}
        <Suspense>
          <AuthInitializer />
        </Suspense>

        <main className="flex-1 pt-14">{children}</main>

        <Suspense>
          <Eruda />
        </Suspense>
        <Suspense>
          <ToastContainer />
        </Suspense>
        <Suspense>
          <AnalyticsBeacon />
        </Suspense>
        <Suspense>
          <SWRegister />
        </Suspense>
        <Suspense>
          <PWAInstallPrompt />
        </Suspense>

        <Suspense>
          <div className="lg:hidden">
            <DynamicIsland />
          </div>
        </Suspense>
      </body>
    </html>
  );
}
