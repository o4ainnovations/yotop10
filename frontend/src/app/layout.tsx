import type { Metadata } from "next";
import "./globals.css";
import Eruda from "./Eruda";
import AuthInitializer from "@/components/AuthInitializer";
import ToastContainer from "@/components/Toast";
import NotificationBell from "@/components/NotificationBell";

export const metadata: Metadata = {
  title: "YoTop10 - Top 10 Lists Platform",
  description: "An open Wikipedia-style platform for top 10 lists with a social UI. Anyone can browse, submit, and comment without creating an account.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthInitializer />
        <NotificationBell />
        {children}
        <Eruda />
        <ToastContainer />
      </body>
    </html>
  );
}
