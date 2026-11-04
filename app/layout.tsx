import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jobs",
  description: "Search current job openings across multiple platforms.",
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
