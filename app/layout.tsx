import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Balnced",
    template: "%s | Balnced",
  },
  description:
    "Know what you can safely spend before payday. Balnced helps you plan bills, track spending, and see a clear safe-to-spend number with daily limits and calm guidance.",
  appleWebApp: {
    title: "Balnced",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-slate-950 antialiased text-slate-100`}
      >
        {children}
      </body>
    </html>
  );
}
