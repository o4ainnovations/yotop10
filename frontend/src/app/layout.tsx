import type { Metadata } from "next";
import "./globals.css";
import Eruda from "./Eruda";
import AuthInitializer from "@/components/AuthInitializer";
import ToastContainer from "@/components/Toast";
import HeaderBells from "@/components/HeaderBells";
import AnalyticsBeacon from "@/components/AnalyticsBeacon";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";

export const metadata: Metadata = {
  title: "YoTop10 — Fact Mine. Debate Ground.",
  description: "The open catalog of ranked lists. Anyone can browse, submit, and debate without creating an account.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 20px',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-primary)',
            position: 'sticky',
            top: 0,
            zIndex: 50,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <Link
              href="/"
              style={{
                fontWeight: 800,
                fontSize: '16px',
                letterSpacing: '-0.01em',
                textDecoration: 'none',
                background: 'linear-gradient(135deg, #ff3b30 0%, #ff2d78 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              YoTop10
            </Link>
            <nav style={{ display: 'flex', gap: '4px', fontSize: '13px' }}>
              {[
                { href: '/', label: 'Feed' },
                { href: '/categories', label: 'Categories' },
                { href: '/search', label: 'Search' },
                { href: '/submit', label: 'Submit' },
              ].map(l => (
                <Link
                  key={l.href}
                  href={l.href}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-secondary)',
                    textDecoration: 'none',
                    fontWeight: 500,
                    transition: 'all var(--transition)',
                  }}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HeaderBells />
            <ThemeToggle />
          </div>
        </header>
        <AuthInitializer />
        <main style={{ flex: 1 }}>{children}</main>
        <Eruda />
        <ToastContainer />
        <AnalyticsBeacon />
      </body>
    </html>
  );
}
