import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/src/auth/session-provider";
import { AppNav } from "@/src/components/app-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "TREAZRISLAND",
  description: "Self-hosted retro gaming, SNES-inspired."
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className="bg-background text-foreground">
      <body className="min-h-screen bg-background font-sans antialiased text-foreground">
        <AuthProvider>
          <div className="relative min-h-screen overflow-hidden">
            <div className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-br from-night via-night to-ink" />
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(93,187,205,0.25),_transparent_55%)]" />
            <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
              <AppNav />
              {children}
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
