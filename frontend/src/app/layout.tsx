import type { Metadata } from "next";
import { Suspense } from "react";
import { Anton, Monoton } from "next/font/google";
import "./globals.css";
import AuthInitializer from "@/components/AuthInitializer";
import ToastContainer from "@/components/Toast";
import AnalyticsBeacon from "@/components/AnalyticsBeacon";
import { DynamicIsland } from "@/components/DynamicIsland";
import { SubmitFAB } from "@/components/SubmitFAB";
import { AppFooter } from "@/components/AppFooter";
import DesktopTopBar from "@/components/DesktopTopBar";
import DesktopTopBarMinimal from "@/components/DesktopTopBarMinimal";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { SlideMenuRouter } from "@/components/SlideMenuRouter";
// import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { FingerprintMergeDetector } from "@/components/FingerprintMergeDialog";

const anton = Anton({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--font-display' });
const monoton = Monoton({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--font-accent' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://yotop10.com'),
  title: "YoTop10 — Fact Mine. Debate Ground.",
  description: "The open catalog of ranked lists. Submit your list. Defend your rankings.",
  manifest: "/manifest.json",
  themeColor: "#05050f",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "YoTop10",
  },
  openGraph: {
    title: "YoTop10 — Fact Mine. Debate Ground.",
    description: "The open catalog of ranked lists. Submit your list. Defend your rankings.",
    url: "https://yotop10.com",
    siteName: "YoTop10",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "YoTop10 — Fact Mine. Debate Ground.",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "YoTop10 — Fact Mine. Debate Ground.",
    description: "The open catalog of ranked lists. Submit your list. Defend your rankings.",
    images: ["/og-image.jpg"],
  },
  other: {
    "msapplication-TileColor": "#05050f",
    "msapplication-TileImage": "/mstile-150x150.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Organization',
              '@id': `${process.env.NEXT_PUBLIC_SITE_URL || 'https://yotop10.com'}/#organization`,
              name: 'YoTop10',
              url: process.env.NEXT_PUBLIC_SITE_URL || 'https://yotop10.com',
              logo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://yotop10.com'}/icon-512.png`,
              sameAs: ['https://twitter.com/yotop10', 'https://reddit.com/r/yotop10'],
              foundingDate: '2025',
            },
            {
              '@type': 'WebSite',
              '@id': `${process.env.NEXT_PUBLIC_SITE_URL || 'https://yotop10.com'}/#website`,
              url: process.env.NEXT_PUBLIC_SITE_URL || 'https://yotop10.com',
              name: 'YoTop10',
              description: 'The open catalog of ranked lists. Submit your list. Defend your rankings.',
              publisher: { '@id': `${process.env.NEXT_PUBLIC_SITE_URL || 'https://yotop10.com'}/#organization` },
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://yotop10.com'}/search?q={search_term_string}`,
                },
                'query-input': 'required name=search_term_string',
              },
            },
          ],
        }).replace(/<\//gi, '<\\/') }} />
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
      <body className={`${anton.variable} ${monoton.variable} min-h-screen flex flex-col bg-[var(--color-bg)] text-[#eaeaef]`} suppressHydrationWarning>
        {/* Mobile top bar */}
        <Suspense fallback={<div className="h-14 bg-[var(--color-bg)] animate-pulse" />}>
          <div className="lg:hidden">
            <DesktopTopBar />
          </div>
        </Suspense>

        {/* Desktop sidebar */}
        <Suspense fallback={<div className="hidden lg:block fixed top-0 left-0 z-40 h-full w-64 lg:w-72 bg-[var(--color-bg)] animate-pulse" />}>
          <div className="hidden lg:block">
            <DesktopSidebar />
          </div>
        </Suspense>

        {/* Desktop minimal top bar */}
        <Suspense fallback={<div className="hidden lg:block h-14 bg-[var(--color-bg)] animate-pulse" />}>
          <div className="hidden lg:block">
            <DesktopTopBarMinimal />
          </div>
        </Suspense>

        <Suspense fallback={<div className="fixed inset-0 z-40 bg-[var(--color-bg)]/50" />}>
          <SlideMenuRouter />
        </Suspense>
        <Suspense>
          <AuthInitializer />
        </Suspense>
        <main className="flex-1 pt-14 lg:pt-14 lg:ml-64 xl:ml-72 transition-[margin] duration-300 ease-out">
          {children}
          <AppFooter />
        </main>
        <Suspense>
          <ToastContainer />
        </Suspense>
        <Suspense>
          <AnalyticsBeacon />
        </Suspense>
        {/* <Suspense>
          <PWAInstallPrompt />
        </Suspense> */}
        <Suspense fallback={<div className="h-0" />}>
          <FingerprintMergeDetector />
        </Suspense>
        <Suspense fallback={null}>
          <DynamicIsland />
        </Suspense>
        <Suspense fallback={null}>
          <SubmitFAB />
        </Suspense>
      </body>
    </html>
  );
}
