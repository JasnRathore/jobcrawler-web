import type { Metadata } from "next";
import { LiquidGlassProvider } from "@/components/ui/opaline/liquid-glass";
import "./globals.css";

export const metadata: Metadata = {
  title: "Discover your next opportunity | Crawler",
  description:
    "Explore job opportunities, compare roles, and find work that fits your next career move.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <LiquidGlassProvider ior={1.9} surface="lip" specular={0.5}>
          {children}
        </LiquidGlassProvider>
      </body>
    </html>
  );
}
