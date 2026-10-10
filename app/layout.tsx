import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Bengali, Noto_Sans_Devanagari } from "next/font/google";
import Link from "next/link";
import "./globals.css";

// Noto Sans for Latin text; the Bengali (Assamese script) and Devanagari (Hindi) fonts are the fallbacks
// that make Indian scripts render properly.
const notoSans = Noto_Sans({ variable: "--font-noto-sans", subsets: ["latin"], display: "swap" });
const notoBengali = Noto_Sans_Bengali({ variable: "--font-noto-bengali", subsets: ["bengali"], display: "swap" });
const notoDevanagari = Noto_Sans_Devanagari({ variable: "--font-noto-devanagari", subsets: ["devanagari"], display: "swap" });

const description =
  "Describe a civic problem in English, Hindi or Assamese. Haq finds the right office, drafts your complaint and RTI application, and tracks your deadlines.";

export const metadata: Metadata = {
  title: { default: "Haq · হক · हक़ — Your right, in your language", template: "%s · Haq" },
  description,
  applicationName: "Haq",
  openGraph: { title: "Haq · হক · हक़", description, type: "website", locale: "en_IN" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f5c63" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${notoSans.variable} ${notoBengali.variable} ${notoDevanagari.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="no-print border-b border-line bg-surface">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="text-xl font-bold tracking-tight text-accent-strong">
              Haq <span aria-hidden="true">·</span> হক <span aria-hidden="true">·</span> हक़
            </Link>
            <span className="hidden text-sm text-muted sm:block">Your right, in your language</span>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="no-print border-t border-line bg-surface">
          <p className="mx-auto w-full max-w-5xl px-4 py-5 text-sm text-muted sm:px-6">
            Not legal advice. For complex cases, contact your District Legal Services Authority for free legal aid.
          </p>
        </footer>
      </body>
    </html>
  );
}
