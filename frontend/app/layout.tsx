import type { Metadata } from "next";
import { headers } from "next/headers";
import { Press_Start_2P } from "next/font/google";
import { unstable_setNonce } from "next/script";
import type { ReactNode } from "react";
import { AuthProvider } from "@/src/auth/session-provider";
import { AppShell } from "@/src/components/app-shell";
import "./globals.css";

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
});

export const metadata: Metadata = {
  title: "TREAZRISLAND",
  description: "Self-hosted retro gaming, SNES-inspired."
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  const headerStore = headers();
  const nonce = headerStore.get("x-csp-nonce");
  if (nonce) {
    unstable_setNonce(nonce);
  }

  return (
    <html lang="en" className={`${pressStart.variable} bg-background text-foreground`}>
      <body className="min-h-screen bg-background font-sans antialiased text-foreground">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
