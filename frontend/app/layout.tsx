import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TREAZRISLAND",
  description: "Self-hosted retro gaming, SNES-inspired."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-background text-foreground">
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6">
          {children}
        </div>
      </body>
    </html>
  );
}
