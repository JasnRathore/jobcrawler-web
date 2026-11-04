import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crawler | Job search",
  description:
    "Search current openings from Greenhouse, Lever, Lever EU, Workable, and Ashby in one place.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <Script src="/theme-preference.js" strategy="beforeInteractive" />
      </head>
      <body className="min-h-full">
        {children}
      </body>
    </html>
  );
}
