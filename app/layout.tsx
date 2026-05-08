import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { AppNavbar } from "@/components/app-navbar";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Lesson Generator",
  description: "Generate and view TypeScript-backed lessons.",
  icons: {
    icon: "/icon.svg",
  },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.className} bg-[#f6f3ec] antialiased`}>
        <AppNavbar />
        {children}
      </body>
    </html>
  );
}
