import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RAILVYN — Every journey. Precisely placed.",
    template: "%s · RAILVYN",
  },
  description:
    "RAILVYN is an independent demonstration railway coach and journey-aware seat allocation system. Not an official IRCTC or Indian Railways service.",
  applicationName: "RAILVYN",
};

export const viewport: Viewport = {
  themeColor: "#080A09",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-canvas text-fg">
        <a
          href="#main-content"
          className="sr-only-focusable fixed left-4 top-4 z-50 rounded-chip bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
