import type { Metadata } from "next";
import { Suspense } from "react";
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Anton&family=Monoton&display=swap" rel="stylesheet" />
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
      <body className="h-full bg-[var(--color-bg)] text-[#eaeaef]" suppressHydrationWarning>
        {/* Critical: hydrates first — hamburger, search, logo */}
        <DesktopTopBar />
        <SlideMenuPanel />

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
