import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/src/auth/session-provider";
import { AppShell } from "@/src/components/app-shell";
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
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
